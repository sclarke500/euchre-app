import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  PresidentPhase,
  PlayerRank,
  type PresidentGameState,
  type PresidentPlayer,
  type PresidentPile,
  type StandardCard,
  createPresidentGame,
  dealPresidentCards,
  processPlay,
  processPass,
  assignRanks,
  startNewRound,
  getNextActivePlayer,
  createEmptyPile,
  findValidPlays,
  canPlay,
  choosePresidentPlay,
  chooseCardsToGive,
  getRankDisplayName,
  getRandomAINames,
} from '@euchre/shared'

export const usePresidentGameStore = defineStore('presidentGame', () => {
  // State
  const players = ref<PresidentPlayer[]>([])
  const phase = ref<PresidentPhase>(PresidentPhase.Setup)
  const currentPile = ref<PresidentPile>(createEmptyPile())
  const currentPlayer = ref(0)
  const consecutivePasses = ref(0)
  const finishedPlayers = ref<number[]>([])
  const roundNumber = ref(1)
  const gameOver = ref(false)
  const lastPlayerId = ref<number | null>(null)
  const lastPlayedCards = ref<StandardCard[] | null>(null)

  // Computed
  const gameState = computed<PresidentGameState>(() => ({
    gameType: 'president',
    players: players.value,
    phase: phase.value,
    currentPile: currentPile.value,
    currentPlayer: currentPlayer.value,
    consecutivePasses: consecutivePasses.value,
    finishedPlayers: finishedPlayers.value,
    roundNumber: roundNumber.value,
    gameOver: gameOver.value,
    lastPlayerId: lastPlayerId.value,
  }))

  const activePlayers = computed(() =>
    players.value.filter(p => p.finishOrder === null)
  )

  const humanPlayer = computed(() =>
    players.value.find(p => p.isHuman)
  )

  const isHumanTurn = computed(() => {
    const human = humanPlayer.value
    return human && currentPlayer.value === human.id && phase.value === PresidentPhase.Playing && human.finishOrder === null
  })

  const validPlays = computed(() => {
    const human = humanPlayer.value
    if (!human || !isHumanTurn.value) return []
    return findValidPlays(human.hand, currentPile.value)
  })

  const canHumanPlay = computed(() => {
    const human = humanPlayer.value
    if (!human) return false
    return canPlay(human.hand, currentPile.value)
  })

  // Actions
  function startNewGame(numPlayers: number = 4) {
    // Get random AI names
    const aiNames = getRandomAINames(numPlayers - 1)

    // Use stored nickname if available
    const playerName = localStorage.getItem('odusNickname')?.trim() || 'You'

    // Create player names array
    const playerNames = [playerName, ...aiNames]

    // Create game
    const state = createPresidentGame(playerNames, 0)

    // Initialize state
    players.value = state.players
    phase.value = state.phase
    currentPile.value = state.currentPile
    currentPlayer.value = state.currentPlayer
    consecutivePasses.value = state.consecutivePasses
    finishedPlayers.value = state.finishedPlayers
    roundNumber.value = state.roundNumber
    gameOver.value = state.gameOver
    lastPlayerId.value = state.lastPlayerId
    lastPlayedCards.value = null

    // Deal cards and start
    startRound()
  }

  function startRound() {
    phase.value = PresidentPhase.Dealing

    // Deal cards
    const state = dealPresidentCards(gameState.value)
    players.value = state.players
    currentPile.value = state.currentPile
    consecutivePasses.value = state.consecutivePasses
    finishedPlayers.value = state.finishedPlayers
    lastPlayerId.value = state.lastPlayerId
    lastPlayedCards.value = null

    // Check for card exchange (after first round)
    const hasRanks = players.value.some(p => p.rank !== null)

    if (hasRanks) {
      // Do card exchange
      setTimeout(() => {
        phase.value = PresidentPhase.CardExchange
        processCardExchange()
      }, 1200)
    } else {
      // First round - find starting player (has 3 of clubs)
      setTimeout(() => {
        const startingPlayer = findStartingPlayer()
        currentPlayer.value = startingPlayer
        phase.value = PresidentPhase.Playing
        processAITurn()
      }, 1200)
    }
  }

  function findStartingPlayer(): number {
    for (const player of players.value) {
      const has3Clubs = player.hand.some(
        card => card.rank === '3' && card.suit === 'clubs'
      )
      if (has3Clubs) {
        return player.id
      }
    }
    return 0
  }

  function processCardExchange() {
    // Auto-process card exchange for AI players
    // Scum gives best cards to President, President gives worst to Scum

    const president = players.value.find(p => p.rank === PlayerRank.President)
    const scum = players.value.find(p => p.rank === PlayerRank.Scum)

    if (president && scum) {
      // Scum gives 2 best cards to President
      const scumCards = chooseCardsToGive(scum, 2)
      const scumCardIds = new Set(scumCards.map(c => c.id))

      // President gives 2 worst cards to Scum
      // (simplified - just give lowest)
      const presidentCards = president.hand
        .slice()
        .sort((a, b) => {
          const rankValues: Record<string, number> = {
            '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6,
            '9': 7, '10': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12, '2': 13
          }
          return (rankValues[a.rank] ?? 0) - (rankValues[b.rank] ?? 0)
        })
        .slice(0, 2)
      const presidentCardIds = new Set(presidentCards.map(c => c.id))

      // Update hands
      players.value = players.value.map(p => {
        if (p.id === president.id) {
          const newHand = [
            ...p.hand.filter(c => !presidentCardIds.has(c.id)),
            ...scumCards
          ]
          return { ...p, hand: newHand }
        }
        if (p.id === scum.id) {
          const newHand = [
            ...p.hand.filter(c => !scumCardIds.has(c.id)),
            ...presidentCards
          ]
          return { ...p, hand: newHand }
        }
        return p
      })
    }

    // President leads
    currentPlayer.value = president?.id ?? 0
    phase.value = PresidentPhase.Playing
    processAITurn()
  }

  function playCards(cards: StandardCard[]) {
    if (cards.length === 0) return

    const state = processPlay(gameState.value, currentPlayer.value, cards)

    // Update state
    players.value = state.players
    currentPile.value = state.currentPile
    currentPlayer.value = state.currentPlayer
    consecutivePasses.value = state.consecutivePasses
    finishedPlayers.value = state.finishedPlayers
    lastPlayerId.value = state.lastPlayerId
    lastPlayedCards.value = cards

    // Check for round complete
    if (state.phase === PresidentPhase.RoundComplete) {
      handleRoundComplete()
      return
    }

    // Continue game
    processAITurn()
  }

  function pass() {
    const state = processPass(gameState.value, currentPlayer.value)

    // Update state
    currentPile.value = state.currentPile
    currentPlayer.value = state.currentPlayer
    consecutivePasses.value = state.consecutivePasses
    lastPlayedCards.value = null

    // If pile was cleared, show it briefly
    if (state.currentPile.currentRank === null && gameState.value.currentPile.currentRank !== null) {
      // Pile was cleared - brief pause
      setTimeout(() => {
        processAITurn()
      }, 500)
    } else {
      processAITurn()
    }
  }

  function handleRoundComplete() {
    phase.value = PresidentPhase.RoundComplete

    // Assign ranks based on finish order
    const state = assignRanks(gameState.value)
    players.value = state.players

    // Check if game should end (e.g., after 5 rounds)
    if (roundNumber.value >= 5) {
      gameOver.value = true
      phase.value = PresidentPhase.GameOver
    } else {
      // Start next round after delay
      setTimeout(() => {
        roundNumber.value++
        startRound()
      }, 3000)
    }
  }

  function processAITurn() {
    const player = players.value[currentPlayer.value]
    if (!player) return

    // Skip if player is finished (applies to both human and AI)
    if (player.finishOrder !== null) {
      currentPlayer.value = getNextActivePlayer(gameState.value, currentPlayer.value)
      processAITurn()
      return
    }

    // Human player - wait for input
    if (player.isHuman) {
      return
    }

    // AI turn - add delay
    setTimeout(() => {
      if (phase.value !== PresidentPhase.Playing) return

      const play = choosePresidentPlay(player, currentPile.value, gameState.value)

      if (play === null) {
        pass()
      } else {
        playCards(play)
      }
    }, 800)
  }

  function getPlayerRankDisplay(playerId: number): string {
    const player = players.value[playerId]
    if (!player || player.rank === null) return ''
    return getRankDisplayName(player.rank)
  }

  return {
    // State
    players,
    phase,
    currentPile,
    currentPlayer,
    consecutivePasses,
    finishedPlayers,
    roundNumber,
    gameOver,
    lastPlayerId,
    lastPlayedCards,
    gameState,

    // Computed
    activePlayers,
    humanPlayer,
    isHumanTurn,
    validPlays,
    canHumanPlay,

    // Actions
    startNewGame,
    startRound,
    playCards,
    pass,
    getPlayerRankDisplay,
  }
})
