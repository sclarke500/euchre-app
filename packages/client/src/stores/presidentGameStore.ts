import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  PresidentPhase,
  PlayerRank,
  type PresidentGameState,
  type PresidentPlayer,
  type PresidentPile,
  type StandardCard,
  type PresidentRules,
  type PendingExchange,
  createPresidentGame,
  dealPresidentCards,
  processPlay,
  processPass,
  processGiveBackCards,
  getExchangeInfo,
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
  DEFAULT_PRESIDENT_RULES,
} from '@euchre/shared'
import { useSettingsStore } from './settingsStore'

export const usePresidentGameStore = defineStore('presidentGame', () => {
  // Settings
  const settings = useSettingsStore()

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
  
  // Rules
  const rules = ref<PresidentRules>({ ...DEFAULT_PRESIDENT_RULES })
  
  // Exchange tracking
  const pendingExchanges = ref<PendingExchange[]>([])
  const awaitingGiveBack = ref<number | null>(null)

  // Card exchange state - only for human player's exchange
  const exchangeInfo = ref<{
    youGive: StandardCard[]
    youReceive: StandardCard[]
    otherPlayerName: string
    yourRole: string
  } | null>(null)

  // Track if we're waiting for user to acknowledge exchange
  const waitingForExchangeAck = ref(false)

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
    rules: rules.value,
    pendingExchanges: pendingExchanges.value,
    awaitingGiveBack: awaitingGiveBack.value,
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
    return findValidPlays(human.hand, currentPile.value, rules.value.superTwosMode)
  })

  const canHumanPlay = computed(() => {
    const human = humanPlayer.value
    if (!human) return false
    return canPlay(human.hand, currentPile.value, rules.value.superTwosMode)
  })
  
  // Check if human needs to give cards back (President/VP giving phase)
  const isHumanGivingCards = computed(() => {
    const human = humanPlayer.value
    return human && 
           phase.value === PresidentPhase.PresidentGiving && 
           awaitingGiveBack.value === human.id
  })
  
  // Get number of cards human needs to give
  const cardsToGiveCount = computed(() => {
    const human = humanPlayer.value
    if (!human || !isHumanGivingCards.value) return 0
    if (human.rank === PlayerRank.President) return 2
    if (human.rank === PlayerRank.VicePresident) return 1
    return 0
  })

  // Actions
  function startNewGame(numPlayers: number = 4) {
    // Get random AI names
    const aiNames = getRandomAINames(numPlayers - 1)

    // Use stored nickname if available
    const playerName = localStorage.getItem('odusNickname')?.trim() || 'You'

    // Create player names array
    const playerNames = [playerName, ...aiNames]

    // Build rules from settings
    rules.value = {
      superTwosMode: settings.isSuperTwosAndJokers(),
      whoLeads: 'president', // TODO: Add to settings
      playStyle: 'multiLoop', // TODO: Add to settings
    }

    // Create game with rules
    const state = createPresidentGame(playerNames, 0, rules.value)

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
    pendingExchanges.value = []
    awaitingGiveBack.value = null

    // Deal cards and start
    startRound()
  }

  function startRound() {
    phase.value = PresidentPhase.Dealing

    // Use shared startNewRound which handles dealing and exchange setup
    const state = startNewRound(gameState.value)
    
    // Apply state
    players.value = state.players
    currentPile.value = state.currentPile
    consecutivePasses.value = state.consecutivePasses
    finishedPlayers.value = state.finishedPlayers
    lastPlayerId.value = state.lastPlayerId
    lastPlayedCards.value = null
    pendingExchanges.value = state.pendingExchanges
    awaitingGiveBack.value = state.awaitingGiveBack
    roundNumber.value = state.roundNumber

    setTimeout(() => {
      phase.value = state.phase
      
      if (state.phase === PresidentPhase.PresidentGiving) {
        // Card exchange phase - check if human needs to give cards
        handleGivingPhase()
      } else if (state.phase === PresidentPhase.Playing) {
        // First round or exchange complete
        currentPlayer.value = state.currentPlayer
        processAITurn()
      }
    }, 1200)
  }
  
  function handleGivingPhase() {
    const human = humanPlayer.value
    
    if (human && awaitingGiveBack.value === human.id) {
      // Human is President or VP - needs to select cards to give
      // Get info about what they received
      const info = getExchangeInfo(gameState.value, human.id)
      if (info) {
        const scum = players.value.find(p => p.rank === PlayerRank.Scum)
        const viceScum = players.value.find(p => 
          p.finishOrder === players.value.length - 1 && p.rank !== PlayerRank.Scum
        )
        const recipient = human.rank === PlayerRank.President ? scum : viceScum
        
        exchangeInfo.value = {
          youGive: [], // Will be filled by user selection
          youReceive: info.receivedCards,
          otherPlayerName: recipient?.name ?? 'Scum',
          yourRole: info.yourRole,
        }
        waitingForExchangeAck.value = false // User needs to select, not just ack
      }
    } else {
      // AI is President/VP - let them give cards automatically
      processAIGiveBack()
    }
  }
  
  function processAIGiveBack() {
    // AI President/VP selects cards to give back
    const givingPlayer = players.value.find(p => p.id === awaitingGiveBack.value)
    if (!givingPlayer) return
    
    // AI chooses lowest cards (simple strategy)
    const cardsCount = givingPlayer.rank === PlayerRank.President ? 2 : 1
    const cardsToGive = chooseCardsToGive(givingPlayer, cardsCount)
    
    // Process the give back
    const state = processGiveBackCards(gameState.value, givingPlayer.id, cardsToGive)
    applyState(state)
    
    // Check if more giving needed or start playing
    if (state.phase === PresidentPhase.PresidentGiving) {
      setTimeout(() => handleGivingPhase(), 500)
    } else if (state.phase === PresidentPhase.Playing) {
      setTimeout(() => processAITurn(), 500)
    }
  }
  
  // Human President/VP gives cards back
  function giveCardsBack(cards: StandardCard[]) {
    const human = humanPlayer.value
    if (!human || awaitingGiveBack.value !== human.id) return
    
    const expectedCount = human.rank === PlayerRank.President ? 2 : 1
    if (cards.length !== expectedCount) return
    
    // Process the give back
    const state = processGiveBackCards(gameState.value, human.id, cards)
    applyState(state)
    
    // Clear exchange info
    exchangeInfo.value = null
    
    // Check if VP also needs to give or start playing
    if (state.phase === PresidentPhase.PresidentGiving) {
      setTimeout(() => handleGivingPhase(), 500)
    } else if (state.phase === PresidentPhase.Playing) {
      setTimeout(() => processAITurn(), 500)
    }
  }
  
  // Helper to apply state from shared functions
  function applyState(state: PresidentGameState) {
    players.value = state.players
    phase.value = state.phase
    currentPile.value = state.currentPile
    currentPlayer.value = state.currentPlayer
    consecutivePasses.value = state.consecutivePasses
    finishedPlayers.value = state.finishedPlayers
    lastPlayerId.value = state.lastPlayerId
    pendingExchanges.value = state.pendingExchanges
    awaitingGiveBack.value = state.awaitingGiveBack
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

  // acknowledgeExchange is used when human is Scum (just acknowledges what was taken/given)
  function acknowledgeExchange() {
    waitingForExchangeAck.value = false
    exchangeInfo.value = null

    // Continue with the giving phase or start playing
    if (phase.value === PresidentPhase.PresidentGiving) {
      handleGivingPhase()
    } else if (phase.value === PresidentPhase.Playing) {
      processAITurn()
    }
  }

  function playCards(cards: StandardCard[]) {
    if (cards.length === 0) return

    const playingPlayer = currentPlayer.value
    const state = processPlay(gameState.value, playingPlayer, cards)

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

    // Check if joker was played - auto-clear pile since nothing can beat it
    const playedJoker = cards.some(c => c.rank === 'Joker')
    if (playedJoker && rules.value.superTwosMode) {
      // Brief pause to show the joker, then auto-clear
      setTimeout(() => {
        currentPile.value = createEmptyPile()
        currentPlayer.value = playingPlayer // Joker player leads again
        consecutivePasses.value = 0
        lastPlayedCards.value = null
        setTimeout(() => {
          processAITurn()
        }, 300)
      }, 800)
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
    exchangeInfo,
    waitingForExchangeAck,
    gameState,
    rules,
    awaitingGiveBack,

    // Computed
    activePlayers,
    humanPlayer,
    isHumanTurn,
    validPlays,
    canHumanPlay,
    isHumanGivingCards,
    cardsToGiveCount,

    // Actions
    startNewGame,
    startRound,
    playCards,
    pass,
    giveCardsBack,
    getPlayerRankDisplay,
    acknowledgeExchange,
  }
})
