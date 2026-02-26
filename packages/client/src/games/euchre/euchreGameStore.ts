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
} from '@67cards/shared'
import {
  GamePhase,
  BidAction,
  createDeck,
  dealCards,
  createTrick,
  playCardToTrick,
  completeTrick,
  isTrickComplete,
  isPlayerSittingOut,
  calculateRoundScore,
  updateScores,
  isGameOver,
  getWinner,
  processBid,
  makeAIBidRound1,
  makeAIBidRound2,
  chooseCardToPlay,
  isPartnerWinning,
  chooseDealerDiscard,
  getRandomAINames,
  // Hard AI
  GameTracker,
  chooseCardToPlayHard,
  isPartnerWinningHard,
  createGameTimer,
  // Remarks engine
  getEuchreRemark,
  type EuchreRemarkState,
  type RemarkMode,
} from '@67cards/shared'
import { useSettingsStore } from '@/stores/settingsStore'
import { useChatStore } from '@/stores/chatStore'
import { CardTimings } from '@/utils/animationTimings'

export const useEuchreGameStore = defineStore('game', () => {
  // Get settings
  const settingsStore = useSettingsStore()
  const chatStore = useChatStore()

  // Game tracker for hard AI (tracks cards played, voids, etc.)
  const gameTracker = new GameTracker()
  const timer = createGameTimer()

  // State snapshot for remarks engine
  let previousRemarkState: EuchreRemarkState | null = null

  function getRemarkStateSnapshot(): EuchreRemarkState {
    return {
      phase: phase.value,
      scores: scores.value.map(s => ({ teamId: s.teamId, score: s.score })),
      currentRound: currentRound.value ? {
        trump: currentRound.value.trump ? {
          suit: currentRound.value.trump.suit,
          calledBy: currentRound.value.trump.calledBy,
        } : null,
        goingAlone: currentRound.value.goingAlone,
        dealer: currentRound.value.dealer,
      } : null,
      gameOver: gameOver.value,
      winner: winner.value,
    }
  }

  function getPlayersForChat() {
    return players.value.map(p => ({
      id: p.id,
      name: p.name,
      isHuman: p.isHuman,
      teamId: p.teamId,
    }))
  }

  // Process remarks after state changes
  function processChatAfterStateChange() {
    if (!settingsStore.botChatEnabled) return

    const newState = getRemarkStateSnapshot()
    const remarkMode: RemarkMode = settingsStore.aiChatMode === 'unhinged' ? 'spicy' : 'mild'
    
    const remark = getEuchreRemark(
      previousRemarkState,
      newState,
      getPlayersForChat(),
      remarkMode
    )

    if (remark) {
      chatStore.receiveMessage({
        id: `ai-${remark.playerId}-${Date.now()}`,
        odusId: `ai-${remark.playerId}`,
        seatIndex: remark.playerId,
        playerName: remark.playerName,
        text: remark.text,
        timestamp: Date.now(),
      })
    }

    // Update previous state for next comparison
    previousRemarkState = newState
  }

  // Capture state before a potentially remark-worthy change
  function captureStateForChat() {
    previousRemarkState = getRemarkStateSnapshot()
  }

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
  const biddingStartPlayer = ref(0) // Track who started the bidding round
  const passCount = ref(0) // Track passes in current bidding round

  // Animation callbacks — store awaits these before advancing turns
  // This allows the Director to control animation timing
  let playAnimationCallback: ((data: { card: Card; playerId: number }) => Promise<void>) | null = null
  let trickCompleteCallback: ((winnerId: number) => Promise<void>) | null = null
  let dealAnimationCallback: (() => Promise<void>) | null = null

  function setPlayAnimationCallback(cb: typeof playAnimationCallback) {
    playAnimationCallback = cb
  }

  function setTrickCompleteCallback(cb: typeof trickCompleteCallback) {
    trickCompleteCallback = cb
  }

  function setDealAnimationCallback(cb: typeof dealAnimationCallback) {
    dealAnimationCallback = cb
  }

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

  const tricksTaken = computed<[number, number]>(() => {
    const tricks = currentRound.value?.tricks ?? []
    let team0 = 0
    let team1 = 0
    for (const trick of tricks) {
      if (trick.winnerId !== null) {
        // Players 0 and 2 are team 0, players 1 and 3 are team 1
        if (trick.winnerId % 2 === 0) team0++
        else team1++
      }
    }
    return [team0, team1]
  })

  // Actions
  function startNewGame() {
    // Cancel any pending timers from previous game
    timer.cancelAll()
    
    // Get random AI names for this game
    const aiNames = getRandomAINames(3)

    // Use stored nickname if available, otherwise 'You'
    const playerName = localStorage.getItem('odusNickname')?.trim() || 'You'

    // Initialize 4 players (0 = human, 1-3 = AI)
    players.value = [
      {
        id: 0,
        name: playerName,
        hand: [],
        isHuman: true,
        teamId: 0,
      },
      {
        id: 1,
        name: aiNames[0] ?? 'Tron',
        hand: [],
        isHuman: false,
        teamId: 1,
      },
      {
        id: 2,
        name: aiNames[1] ?? 'Data',
        hand: [],
        isHuman: false,
        teamId: 0,
      },
      {
        id: 3,
        name: aiNames[2] ?? 'Neon',
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
    // Random starting dealer (0-3)
    currentDealer.value = Math.floor(Math.random() * 4)

    // Start first round
    startNewRound()
  }

  function startNewRound() {
    phase.value = GamePhase.Dealing

    // Reset game tracker for hard AI
    gameTracker.reset()

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

    // Initialize bidding tracking
    biddingStartPlayer.value = (currentDealer.value + 1) % 4
    passCount.value = 0

    // Start bidding phase after dealing animation completes
    // Animation takes: 500ms delay + 600ms animation = 1100ms, add buffer
    timer.schedule('deal-fallback', CardTimings.roundEnd, () => {
      phase.value = GamePhase.BiddingRound1
      processAITurn()
    })
  }

  function makeBid(bid: Bid) {
    if (!currentRound.value) return

    const newTrump = processBid(bid, currentRound.value.turnUpCard, currentRound.value.trump)

    // If trump was set (someone ordered up or called)
    if (newTrump && !currentRound.value.trump) {
      currentRound.value.trump = newTrump
      currentRound.value.goingAlone = newTrump.goingAlone
      currentRound.value.alonePlayer = newTrump.goingAlone ? newTrump.calledBy : null

      // Set trump on game tracker for hard AI
      gameTracker.setTrump(newTrump.suit)

      // If dealer picked up, they need to discard (unless sitting out because partner is going alone)
      if (bid.action === BidAction.PickUp || bid.action === BidAction.OrderUp) {
        // Use local variable — not reactive state — to avoid proxy timing issues
        const alonePlayer = newTrump.goingAlone ? newTrump.calledBy : null
        if (!isPlayerSittingOut(currentDealer.value, alonePlayer)) {
          const needsHumanDiscard = handleDealerPickup()
          if (needsHumanDiscard) {
            // Human dealer needs to discard - set their turn
            currentRound.value.currentPlayer = currentRound.value.dealer
            phase.value = GamePhase.DealerDiscard
            return
          }
          // AI dealer discarded automatically - nobody's turn during animation
          // (startPlayingPhase will set correct player after animation)
          currentRound.value.currentPlayer = -1
        }
      }

      // Start playing phase
      startPlayingPhase()
    }
    // Pass - continue bidding
    else if (bid.action === BidAction.Pass) {
      passCount.value++

      // Check if round 1 bidding is complete (all 4 players passed)
      if (currentRound.value.biddingRound === 1) {
        if (passCount.value >= 4) {
          // Move to round 2
          currentRound.value.biddingRound = 2
          currentRound.value.currentPlayer = (currentRound.value.dealer + 1) % 4
          biddingStartPlayer.value = (currentRound.value.dealer + 1) % 4
          passCount.value = 0
          phase.value = GamePhase.BiddingRound2
        } else {
          currentRound.value.currentPlayer = (currentRound.value.currentPlayer + 1) % 4
        }
      } else {
        // Round 2 - if all 4 players pass, throw in the hand and redeal
        if (passCount.value >= 4) {
          // Everyone passed - throw in the hand, rotate dealer, redeal
          currentDealer.value = (currentDealer.value + 1) % 4
          startNewRound()
          return
        } else {
          currentRound.value.currentPlayer = (currentRound.value.currentPlayer + 1) % 4
        }
      }

      processAITurn()
    }
  }

  function handleDealerPickup(): boolean {
    if (!currentRound.value || !currentRound.value.turnUpCard) return false

    const dealer = players.value[currentRound.value.dealer]
    if (!dealer) return false

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
      return false // No human input needed
    }

    // Human dealer needs to discard
    return dealer.isHuman
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

  async function playCard(card: Card, playerId: number) {
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

    // Wait for card play animation to complete
    if (playAnimationCallback) {
      await playAnimationCallback({ card, playerId })
    }

    // Check if trick is complete
    if (isTrickComplete(currentRound.value.currentTrick, currentRound.value.goingAlone)) {
      await completeTrickAndContinue()
    } else {
      // Next player's turn - advance by 1 from current player
      currentRound.value.currentPlayer = (currentRound.value.currentPlayer + 1) % 4

      // Skip if sitting out
      if (isPlayerSittingOut(currentRound.value.currentPlayer, currentRound.value.alonePlayer)) {
        currentRound.value.currentPlayer = (currentRound.value.currentPlayer + 1) % 4
      }

      processAITurn()
    }
  }

  async function completeTrickAndContinue() {
    if (!currentRound.value || !currentRound.value.trump) return

    // Complete the trick
    const completedTrick = completeTrick(currentRound.value.currentTrick, currentRound.value.trump.suit)
    currentRound.value.tricks.push(completedTrick)

    // Record trick for hard AI tracking
    gameTracker.recordTrick(completedTrick)

    console.log(`Trick ${currentRound.value.tricks.length} complete. Winner: Player ${completedTrick.winnerId}`)

    phase.value = GamePhase.TrickComplete

    // Wait for trick complete animation (sweep to winner)
    if (trickCompleteCallback && completedTrick.winnerId !== null) {
      await trickCompleteCallback(completedTrick.winnerId)
    }

    // Check if round is complete (5 tricks)
    if (currentRound.value.tricks.length === 5) {
      console.log('All 5 tricks complete, ending round')
      completeRound()
    } else {
      // Start next trick
      console.log(`Starting trick ${currentRound.value.tricks.length + 1}...`)
      if (!currentRound.value || completedTrick.winnerId === null) {
        console.log('Early return - currentRound or winnerId is null')
        return
      }

      currentRound.value.currentTrick = createTrick()
      currentRound.value.currentPlayer = completedTrick.winnerId
      phase.value = GamePhase.Playing
      console.log(`Trick ${currentRound.value.tricks.length + 1} started. Current player: ${completedTrick.winnerId}`)

      processAITurn()
    }
  }

  function completeRound() {
    if (!currentRound.value || !currentRound.value.trump) return

    // Capture state BEFORE changes for chat engine
    captureStateForChat()

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
      
      // Process chat after all state changes (including game over)
      processChatAfterStateChange()
    } else {
      // Process chat for round complete (not game over)
      processChatAfterStateChange()
      
      // Rotate dealer immediately so chip moves during the pause
      currentDealer.value = (currentDealer.value + 1) % 4
      // Then start next round after the pause
      timer.schedule('next-round', 2000, () => {
        startNewRound()
      })
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

  // Helper for async delays
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  async function processAITurn() {
    if (!currentRound.value) return

    const current = currentRound.value.currentPlayer
    const player = players.value[current]
    if (!player) return

    // Human player - wait for input
    if (player.isHuman) {
      console.log(`Waiting for human player ${player.id} to play. Hand size: ${player.hand.length}`)
      return
    }

    // Brief "thinking" delay for realism
    await sleep(CardTimings.aiThink)
    if (!currentRound.value) return

    if (phase.value === GamePhase.BiddingRound1) {
      if (!currentRound.value.turnUpCard) return
      const bid = makeAIBidRound1(player, currentRound.value.turnUpCard, currentRound.value.dealer)
      const isDealer = player.id === currentRound.value.dealer
      const message = getBidMessage(bid, isDealer)

      // Show AI decision briefly
      lastAIBidAction.value = { playerId: player.id, message }
      await sleep(800)
      lastAIBidAction.value = null
      makeBid(bid)
    } else if (phase.value === GamePhase.BiddingRound2) {
      if (!currentRound.value.turnUpCard) return
      const bid = makeAIBidRound2(
        player,
        currentRound.value.turnUpCard.suit,
        currentRound.value.dealer,
        settingsStore.isStickTheDealer()
      )
      const isDealer = player.id === currentRound.value.dealer
      const message = getBidMessage(bid, isDealer)

      // Show AI decision briefly
      lastAIBidAction.value = { playerId: player.id, message }
      await sleep(800)
      lastAIBidAction.value = null
      makeBid(bid)
    } else if (phase.value === GamePhase.Playing && currentRound.value.trump) {
      let card: Card
      if (settingsStore.isHardAI()) {
        // Hard AI with card tracking
        const partnerWinning = isPartnerWinningHard(
          currentRound.value.currentTrick,
          player.id,
          currentRound.value.trump.suit
        )
        // Check if THIS AI is going alone (they called trump + goingAlone)
        const isGoingAlone = currentRound.value.goingAlone && 
          currentRound.value.trump.calledBy === player.id
        card = chooseCardToPlayHard(
          player,
          currentRound.value.currentTrick,
          currentRound.value.trump.suit,
          partnerWinning,
          gameTracker,
          isGoingAlone
        )
      } else {
        // Easy AI (basic strategy)
        const partnerWinning = isPartnerWinning(
          currentRound.value.currentTrick,
          player.id,
          currentRound.value.trump.suit
        )
        card = chooseCardToPlay(
          player,
          currentRound.value.currentTrick,
          currentRound.value.trump.suit,
          partnerWinning
        )
      }
      // playCard is now async and waits for animation callback
      await playCard(card, player.id)
    }
  }

  function nextTrick() {
    if (!currentRound.value) return
    currentRound.value.currentTrick = createTrick()
    phase.value = GamePhase.Playing
  }

  // Callback for director to signal discard animation complete
  let discardAnimationCallback: (() => void) | null = null

  function setDiscardAnimationCallback(cb: (() => void) | null) {
    discardAnimationCallback = cb
  }

  function dealerDiscard(card: Card) {
    if (!currentRound.value) return

    const dealer = players.value[currentRound.value.dealer]
    if (!dealer) return

    const cardIndex = dealer.hand.findIndex((c) => c.id === card.id)
    if (cardIndex !== -1) {
      dealer.hand.splice(cardIndex, 1)
    }

    // If callback is set, wait for director to signal animation complete
    // Otherwise start immediately (fallback for non-animated scenarios)
    if (discardAnimationCallback) {
      discardAnimationCallback()
      discardAnimationCallback = null
    } else {
      startPlayingPhase()
    }
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
    tricksTaken,
    gameState,
    lastAIBidAction,

    // Actions
    startNewGame,
    startNewRound,
    makeBid,
    playCard,
    nextTrick,
    dealerDiscard,

    // Animation callbacks (for Director coordination)
    setPlayAnimationCallback,
    setTrickCompleteCallback,
    setDealAnimationCallback,
    setDiscardAnimationCallback,
    startPlayingPhase,  // For director to call after discard animation
    
    // Timer control (for cleanup/pause)
    cancelTimers: () => timer.cancelAll(),
    pauseTimers: () => timer.pauseAll(),
    resumeTimers: () => timer.resumeAll(),
  }
})
