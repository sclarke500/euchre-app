import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  GameState,
  Player,
  Round,
  Card,
  Trick,
  Trump,
  Bid,
  TeamScore,
} from '@/models/types'
import { GamePhase, BidAction, Suit } from '@/models/types'
import { createDeck, dealCards } from '@/services/deck'
import { createTrick, playCardToTrick, completeTrick, isTrickComplete, getNextPlayer, isPlayerSittingOut } from '@/services/trick'
import { calculateRoundScore, updateScores, isGameOver, getWinner } from '@/services/scoring'
import { processBid } from '@/services/trump'
import { makeAIBidRound1, makeAIBidRound2, chooseCardToPlay, isPartnerWinning, chooseDealerDiscard } from '@/services/ai'

export const useGameStore = defineStore('game', () => {
  // State
  const players = ref<Player[]>([])
  const currentRound = ref<Round | null>(null)
  const scores = ref<TeamScore[]>([
    { teamId: 0, score: 0 },
    { teamId: 1, score: 0 },
  ])
  const gameOver = ref(false)
  const winner = ref<number | null>(null)
  const phase = ref<GamePhase>(GamePhase.Setup)
  const currentDealer = ref(0)
  const lastAIBidAction = ref<{ playerId: number; message: string } | null>(null)

  // Computed
  const gameState = computed<GameState>(() => ({
    players: players.value,
    currentRound: currentRound.value,
    scores: scores.value,
    gameOver: gameOver.value,
    winner: winner.value,
    phase: phase.value,
  }))

  const currentPlayer = computed(() => {
    return currentRound.value?.currentPlayer ?? 0
  })

  const trump = computed(() => {
    return currentRound.value?.trump ?? null
  })

  const currentTrick = computed(() => {
    return currentRound.value?.currentTrick ?? createTrick()
  })

  // Actions
  function startNewGame() {
    // Initialize 4 players (0 = human, 1-3 = AI)
    players.value = [
      {
        id: 0,
        name: 'You',
        hand: [],
        isHuman: true,
        teamId: 0,
      },
      {
        id: 1,
        name: 'AI 1',
        hand: [],
        isHuman: false,
        teamId: 1,
      },
      {
        id: 2,
        name: 'AI 2',
        hand: [],
        isHuman: false,
        teamId: 0,
      },
      {
        id: 3,
        name: 'AI 3',
        hand: [],
        isHuman: false,
        teamId: 1,
      },
    ]

    // Reset scores
    scores.value = [
      { teamId: 0, score: 0 },
      { teamId: 1, score: 0 },
    ]

    gameOver.value = false
    winner.value = null
    currentDealer.value = 0

    // Start first round
    startNewRound()
  }

  function startNewRound() {
    phase.value = GamePhase.Dealing

    // Create and deal deck
    const deck = createDeck()
    const [hand0, hand1, hand2, hand3, kitty] = dealCards(deck)

    // Update player hands
    players.value[0]!.hand = hand0
    players.value[1]!.hand = hand1
    players.value[2]!.hand = hand2
    players.value[3]!.hand = hand3

    // Turn up card is first card of kitty
    const turnUpCard = kitty[0] ?? null

    // Create new round
    currentRound.value = {
      dealer: currentDealer.value,
      trump: null,
      tricks: [],
      currentTrick: createTrick(),
      kitty,
      turnUpCard,
      biddingRound: 1,
      currentPlayer: (currentDealer.value + 1) % 4, // Player left of dealer starts
      goingAlone: false,
      alonePlayer: null,
    }

    // Start bidding phase
    setTimeout(() => {
      phase.value = GamePhase.BiddingRound1
      processAITurn()
    }, 500)
  }

  function makeBid(bid: Bid) {
    if (!currentRound.value) return

    const newTrump = processBid(bid, currentRound.value.turnUpCard, currentRound.value.trump)

    // If trump was set (someone ordered up or called)
    if (newTrump && !currentRound.value.trump) {
      currentRound.value.trump = newTrump
      currentRound.value.goingAlone = newTrump.goingAlone
      currentRound.value.alonePlayer = newTrump.goingAlone ? newTrump.calledBy : null

      // If dealer picked up, they need to discard
      if (bid.action === BidAction.PickUp || bid.action === BidAction.OrderUp) {
        handleDealerPickup()
      }

      // Start playing phase
      startPlayingPhase()
    }
    // Pass - continue bidding
    else if (bid.action === BidAction.Pass) {
      // Check if round 1 bidding is complete
      if (currentRound.value.biddingRound === 1) {
        const passCount = countPasses()
        if (passCount >= 4) {
          // Move to round 2
          currentRound.value.biddingRound = 2
          currentRound.value.currentPlayer = (currentRound.value.dealer + 1) % 4
          phase.value = GamePhase.BiddingRound2
        } else {
          currentRound.value.currentPlayer = (currentRound.value.currentPlayer + 1) % 4
        }
      } else {
        // Round 2 - continue or dealer must call
        if (currentRound.value.currentPlayer === currentRound.value.dealer) {
          // Dealer must call (stick the dealer)
          // AI will handle this automatically
        } else {
          currentRound.value.currentPlayer = (currentRound.value.currentPlayer + 1) % 4
        }
      }

      processAITurn()
    }
  }

  function handleDealerPickup() {
    if (!currentRound.value || !currentRound.value.turnUpCard) return

    const dealer = players.value[currentRound.value.dealer]
    if (!dealer) return

    const turnCard = currentRound.value.turnUpCard

    // Add turn card to dealer's hand
    dealer.hand.push(turnCard)

    // AI dealer discards automatically
    if (!dealer.isHuman && currentRound.value.trump) {
      const cardToDiscard = chooseDealerDiscard(dealer.hand, currentRound.value.trump.suit)
      const index = dealer.hand.findIndex((c) => c.id === cardToDiscard.id)
      if (index !== -1) {
        dealer.hand.splice(index, 1)
      }
    }
  }

  function startPlayingPhase() {
    if (!currentRound.value) return

    phase.value = GamePhase.Playing
    // Player left of dealer leads
    currentRound.value.currentPlayer = (currentRound.value.dealer + 1) % 4

    // Skip if player is sitting out (partner of alone player)
    if (isPlayerSittingOut(currentRound.value.currentPlayer, currentRound.value.alonePlayer)) {
      currentRound.value.currentPlayer = (currentRound.value.currentPlayer + 1) % 4
    }

    processAITurn()
  }

  function playCard(card: Card, playerId: number) {
    if (!currentRound.value || !currentRound.value.trump) return

    // Remove card from player's hand
    const player = players.value[playerId]
    if (!player) return

    const cardIndex = player.hand.findIndex((c) => c.id === card.id)
    if (cardIndex !== -1) {
      player.hand.splice(cardIndex, 1)
    }

    // Add card to current trick
    currentRound.value.currentTrick = playCardToTrick(
      currentRound.value.currentTrick,
      card,
      playerId,
      currentRound.value.trump.suit
    )

    // Check if trick is complete
    if (isTrickComplete(currentRound.value.currentTrick, currentRound.value.goingAlone)) {
      completeTrickAndContinue()
    } else {
      // Next player's turn
      const leadPlayer = currentRound.value.currentTrick.cards[0]?.playerId ?? 0
      currentRound.value.currentPlayer = getNextPlayer(currentRound.value.currentTrick, leadPlayer)

      // Skip if sitting out
      if (isPlayerSittingOut(currentRound.value.currentPlayer, currentRound.value.alonePlayer)) {
        currentRound.value.currentPlayer = (currentRound.value.currentPlayer + 1) % 4
      }

      processAITurn()
    }
  }

  function completeTrickAndContinue() {
    if (!currentRound.value || !currentRound.value.trump) return

    // Complete the trick
    const completedTrick = completeTrick(currentRound.value.currentTrick, currentRound.value.trump.suit)
    currentRound.value.tricks.push(completedTrick)

    phase.value = GamePhase.TrickComplete

    // Check if round is complete (5 tricks)
    if (currentRound.value.tricks.length === 5) {
      setTimeout(() => {
        completeRound()
      }, 1500)
    } else {
      // Start next trick
      setTimeout(() => {
        if (!currentRound.value || completedTrick.winnerId === null) return

        currentRound.value.currentTrick = createTrick()
        currentRound.value.currentPlayer = completedTrick.winnerId
        phase.value = GamePhase.Playing

        processAITurn()
      }, 1500)
    }
  }

  function completeRound() {
    if (!currentRound.value || !currentRound.value.trump) return

    phase.value = GamePhase.RoundComplete

    // Calculate score
    const roundScore = calculateRoundScore(currentRound.value.tricks, currentRound.value.trump)
    const currentScores: [number, number] = [scores.value[0]?.score ?? 0, scores.value[1]?.score ?? 0]
    const newScores = updateScores(currentScores, roundScore)

    if (scores.value[0]) scores.value[0].score = newScores[0]
    if (scores.value[1]) scores.value[1].score = newScores[1]

    // Check for game over
    if (isGameOver(newScores)) {
      winner.value = getWinner(newScores)
      gameOver.value = true
      phase.value = GamePhase.GameOver
    } else {
      // Next round
      setTimeout(() => {
        currentDealer.value = (currentDealer.value + 1) % 4
        startNewRound()
      }, 3000)
    }
  }

  function getBidMessage(bid: Bid, isDealer: boolean): string {
    if (bid.action === BidAction.Pass) {
      return 'Pass'
    } else if (bid.action === BidAction.OrderUp) {
      return bid.goingAlone ? 'Order Up (Alone)' : 'Order Up'
    } else if (bid.action === BidAction.PickUp) {
      return bid.goingAlone ? 'Pick Up (Alone)' : 'Pick Up'
    } else if (bid.action === BidAction.CallTrump && bid.suit) {
      const suitName = bid.suit.charAt(0).toUpperCase() + bid.suit.slice(1)
      return bid.goingAlone ? `${suitName} (Alone)` : suitName
    }
    return ''
  }

  function processAITurn() {
    if (!currentRound.value) return

    const current = currentRound.value.currentPlayer
    const player = players.value[current]
    if (!player) return

    // Human player - wait for input
    if (player.isHuman) return

    // AI turn - add delay for realism
    setTimeout(() => {
      if (!currentRound.value) return

      if (phase.value === GamePhase.BiddingRound1) {
        if (!currentRound.value.turnUpCard) return
        const bid = makeAIBidRound1(player, currentRound.value.turnUpCard, currentRound.value.dealer)
        const isDealer = player.id === currentRound.value.dealer
        const message = getBidMessage(bid, isDealer)

        // Show AI decision
        lastAIBidAction.value = { playerId: player.id, message }

        // Execute bid after brief display
        setTimeout(() => {
          lastAIBidAction.value = null
          makeBid(bid)
        }, 1000)
      } else if (phase.value === GamePhase.BiddingRound2) {
        if (!currentRound.value.turnUpCard) return
        const bid = makeAIBidRound2(
          player,
          currentRound.value.turnUpCard.suit,
          currentRound.value.dealer
        )
        const isDealer = player.id === currentRound.value.dealer
        const message = getBidMessage(bid, isDealer)

        // Show AI decision
        lastAIBidAction.value = { playerId: player.id, message }

        // Execute bid after brief display
        setTimeout(() => {
          lastAIBidAction.value = null
          makeBid(bid)
        }, 1000)
      } else if (phase.value === GamePhase.Playing && currentRound.value.trump) {
        const partnerWinning = isPartnerWinning(currentRound.value.currentTrick, player.id, currentRound.value.trump.suit)
        const card = chooseCardToPlay(player, currentRound.value.currentTrick, currentRound.value.trump.suit, partnerWinning)
        playCard(card, player.id)
      }
    }, 800)
  }

  function countPasses(): number {
    // This is simplified - in a real implementation, track bids
    return 4
  }

  function nextTrick() {
    if (!currentRound.value) return
    currentRound.value.currentTrick = createTrick()
    phase.value = GamePhase.Playing
  }

  function dealerDiscard(card: Card) {
    if (!currentRound.value) return

    const dealer = players.value[currentRound.value.dealer]
    if (!dealer) return

    const cardIndex = dealer.hand.findIndex((c) => c.id === card.id)
    if (cardIndex !== -1) {
      dealer.hand.splice(cardIndex, 1)
    }

    startPlayingPhase()
  }

  return {
    // State
    players,
    currentRound,
    scores,
    gameOver,
    winner,
    phase,
    currentPlayer,
    trump,
    currentTrick,
    gameState,
    lastAIBidAction,

    // Actions
    startNewGame,
    startNewRound,
    makeBid,
    playCard,
    nextTrick,
    dealerDiscard,
  }
})
