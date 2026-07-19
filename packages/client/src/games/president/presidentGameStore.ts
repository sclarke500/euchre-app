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
  confirmExchange,
  getHumanExchangeInfo,
  assignRanks,
  startNewRound,
  getNextActivePlayer,
  createEmptyPile,
  findValidPlays,
  canPlay,
  choosePresidentPlay,
  choosePresidentPlayHard,
  chooseCardsToGiveBack,
  chooseCardsToGive,
  getRankDisplayName,
  getRandomAINames,
  DEFAULT_PRESIDENT_RULES,
  createGameTimer,
  // Remarks engine
  createPresidentRemarkEngine,
  type PresidentRemarkState,
  type RemarkMode,
} from '@67cards/shared'
import { CardTimings } from '@/utils/animationTimings'
import { useSettingsStore } from '@/stores/settingsStore'
import { useChatStore } from '@/stores/chatStore'

export const usePresidentGameStore = defineStore('presidentGame', () => {
  // Settings
  const settingsStore = useSettingsStore()
  const chatStore = useChatStore()
  const timer = createGameTimer()
  
  // Remarks engine (holds previous state snapshot + cooldown)
  const remarkEngine = createPresidentRemarkEngine()
  let pileJustCleared = false

  // State
  const players = ref<PresidentPlayer[]>([])
  const phase = ref<PresidentPhase>(PresidentPhase.Setup)
  const currentPile = ref<PresidentPile>(createEmptyPile())
  const currentPlayer = ref(0)
  const consecutivePasses = ref(0)
  const finishedPlayers = ref<number[]>([])
  const passedThisTrick = ref<number[]>([])
  const roundNumber = ref(1)
  const gameOver = ref(false)
  const lastPlayerId = ref<number | null>(null)
  const lastPlayedCards = ref<StandardCard[] | null>(null)
  
  // Rules
  const rules = ref<PresidentRules>({ ...DEFAULT_PRESIDENT_RULES })
  
  // Exchange tracking
  const pendingExchanges = ref<PendingExchange[]>([])
  const awaitingGiveBack = ref<number | null>(null)
  const exchangeParticipants = ref<PresidentGameState['exchangeParticipants']>([])

  // Card exchange state - only for human player's exchange
  const exchangeInfo = ref<{
    youGive: StandardCard[]
    youReceive: StandardCard[]
    otherPlayerName: string
    yourRole: string
  } | null>(null)

  // Track if we're waiting for user to acknowledge exchange
  const waitingForExchangeAck = ref(false)

  // Round summary modal (user must click Continue)
  const showRoundSummary = ref(false)

  // Computed
  const gameState = computed<PresidentGameState>(() => ({
    gameType: 'president',
    players: players.value,
    phase: phase.value,
    currentPile: currentPile.value,
    currentPlayer: currentPlayer.value,
    consecutivePasses: consecutivePasses.value,
    passedThisTrick: passedThisTrick.value,
    finishedPlayers: finishedPlayers.value,
    roundNumber: roundNumber.value,
    gameOver: gameOver.value,
    lastPlayerId: lastPlayerId.value,
    rules: rules.value,
    pendingExchanges: pendingExchanges.value,
    awaitingGiveBack: awaitingGiveBack.value,
    exchangeParticipants: exchangeParticipants.value,
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
  
  // Human still needs to confirm as a selectable exchange seat (President/VP)
  const isHumanGivingCards = computed(() => {
    const human = humanPlayer.value
    if (!human || phase.value !== PresidentPhase.CardExchange) return false
    const part = exchangeParticipants.value.find(p => p.seatId === human.id)
    return !!(part && part.canSelect && !part.confirmed)
  })
  
  // Get number of cards human needs to give
  const cardsToGiveCount = computed(() => {
    const human = humanPlayer.value
    if (!human || phase.value !== PresidentPhase.CardExchange) return 0
    const part = exchangeParticipants.value.find(p => p.seatId === human.id)
    return part?.cardsNeeded ?? 0
  })

  // SP exchange state for Scum/ViceScum (unified with MP flow)
  const isInExchange = ref(false)
  const exchangeCanSelect = ref(false)
  const exchangePreSelectedIds = ref<string[]>([])

  // Deal animation callback — director signals when dealing visuals are done
  let dealCompleteResolve: (() => void) | null = null

  function dealAnimationComplete() {
    if (dealCompleteResolve) {
      const resolve = dealCompleteResolve
      dealCompleteResolve = null
      resolve()
    }
  }

  // Play animation callbacks — director registers these so the store
  // waits for card animations before advancing to the next turn
  let playAnimationCallback: ((play: { cards: StandardCard[], playerId: number, playIndex: number }) => Promise<void>) | null = null
  let pileClearedCallback: (() => Promise<void>) | null = null
  let exchangeAnimationCallback: ((exchanges: PendingExchange[]) => Promise<void>) | null = null

  function setPlayAnimationCallback(cb: typeof playAnimationCallback) {
    playAnimationCallback = cb
  }

  function setPileClearedCallback(cb: typeof pileClearedCallback) {
    pileClearedCallback = cb
  }

  function setExchangeAnimationCallback(cb: typeof exchangeAnimationCallback) {
    exchangeAnimationCallback = cb
  }

  // Remarks engine helpers
  function getRemarkStateSnapshot(): PresidentRemarkState {
    return {
      phase: phase.value,
      finishedPlayers: [...finishedPlayers.value],
      lastPlayerId: lastPlayerId.value,
      pileCleared: pileJustCleared,
      roundNumber: roundNumber.value,
      gameOver: gameOver.value,
      players: players.value.map(p => ({
        id: p.id,
        rank: p.rank,
      })),
    }
  }

  function getPlayersForChat() {
    return players.value.map(p => ({
      id: p.id,
      name: p.name,
      isHuman: p.id === 0,
    }))
  }

  function processChatAfterStateChange() {
    if (!settingsStore.botChatEnabled) return
    
    const newState = getRemarkStateSnapshot()
    const remarkMode: RemarkMode = settingsStore.aiChatMode === 'unhinged' ? 'spicy' : 'mild'
    
    const remark = remarkEngine.process(newState, getPlayersForChat(), remarkMode)

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

    pileJustCleared = false
  }

  function captureStateForChat() {
    remarkEngine.capture(getRemarkStateSnapshot())
  }

  // Actions
  function startNewGame(numPlayers: number = 4) {
    // Cancel any pending timers from previous game
    timer.cancelAll()
    
    // Get random AI names
    const aiNames = getRandomAINames(numPlayers - 1)

    // Use stored nickname if available
    const playerName = localStorage.getItem('odusNickname')?.trim() || 'You'

    // Create player names array
    const playerNames = [playerName, ...aiNames]

    // Build rules from settings
    rules.value = {
      superTwosMode: settingsStore.isSuperTwosAndJokers(),
      whoLeads: 'scum', // Scum leads after card exchange (standard rule)
      turnStyle: settingsStore.presidentTurnStyle,
    }

    // Create game with rules
    const state = createPresidentGame(playerNames, 0, rules.value)

    // Initialize state
    players.value = state.players
    phase.value = state.phase
    currentPile.value = state.currentPile
    currentPlayer.value = state.currentPlayer
    consecutivePasses.value = state.consecutivePasses
    passedThisTrick.value = state.passedThisTrick
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
    passedThisTrick.value = state.passedThisTrick
    finishedPlayers.value = state.finishedPlayers
    lastPlayerId.value = state.lastPlayerId
    lastPlayedCards.value = null
    pendingExchanges.value = state.pendingExchanges
    awaitingGiveBack.value = state.awaitingGiveBack
    exchangeParticipants.value = state.exchangeParticipants ?? []
    roundNumber.value = state.roundNumber

    // Wait for deal animation to complete before advancing phase.
    // The director calls dealAnimationComplete() when dealing visuals are done.
    // Fallback timeout prevents stuck state if no director is listening.
    const advancePhase = () => {
      phase.value = state.phase

      if (state.phase === PresidentPhase.CardExchange) {
        beginSimultaneousExchange()
      } else if (state.phase === PresidentPhase.Playing) {
        // First round or exchange complete
        currentPlayer.value = state.currentPlayer
        processAITurn()
      }
    }

    dealCompleteResolve = advancePhase
    // Fallback: if no director signals within 15s, advance anyway
    timer.schedule('deal-fallback', 15000, () => {
      if (dealCompleteResolve === advancePhase) {
        dealCompleteResolve = null
        advancePhase()
      }
    })
  }
  
  /**
   * Simultaneous exchange: show human UI from pure participants, auto-confirm AI seats.
   */
  function beginSimultaneousExchange() {
    const human = humanPlayer.value
    const parts = exchangeParticipants.value

    // Configure human UI if they participate and haven't confirmed
    if (human) {
      const part = parts.find(p => p.seatId === human.id && !p.confirmed)
      if (part) {
        isInExchange.value = true
        exchangeCanSelect.value = part.canSelect
        exchangePreSelectedIds.value = part.canSelect ? [] : [...part.cardIds]
        waitingForExchangeAck.value = false
      } else {
        isInExchange.value = false
      }
    }

    // Auto-confirm AI participants
    for (const part of parts) {
      const player = players.value[part.seatId]
      if (!player || player.isHuman || part.confirmed) continue
      timer.schedule(`exchange-ai-${part.seatId}`, CardTimings.aiThink, () => {
        void applyExchangeConfirm(part.seatId, part.canSelect
          ? chooseCardsToGiveBack(player, part.cardsNeeded).map(c => c.id)
          : part.cardIds)
      })
    }

    // All-AI table with no human in exchange
    if (parts.length > 0 && parts.every(p => {
      const pl = players.value[p.seatId]
      return pl && !pl.isHuman
    })) {
      // AI timers will complete the exchange
    }
  }

  async function applyExchangeConfirm(seatId: number, cardIds: string[]) {
    const prev = gameState.value
    if (prev.phase !== PresidentPhase.CardExchange) return

    const prevExchanges = prev.pendingExchanges.length
    const state = confirmExchange(prev, seatId, cardIds)
    if (state === prev) return

    const newExchanges = state.pendingExchanges.slice(prevExchanges)
    applyState(state)

    if (state.phase === PresidentPhase.Playing && exchangeAnimationCallback && newExchanges.length > 0) {
      await exchangeAnimationCallback(newExchanges)
    }

    if (state.phase === PresidentPhase.Playing) {
      const human = humanPlayer.value
      if (human) {
        const info = getHumanExchangeInfo(state.pendingExchanges, human.id, state.players)
        if (info && (info.youGive.length > 0 || info.youReceive.length > 0)) {
          exchangeInfo.value = info
          waitingForExchangeAck.value = true
          return
        }
      }
      timer.schedule('ai-turn', CardTimings.aiThink, () => processAITurn())
    }
  }

  // Human President/VP selects cards to give
  async function giveCardsBack(cards: StandardCard[]) {
    const human = humanPlayer.value
    if (!human || !isHumanGivingCards.value) return
    await applyExchangeConfirm(human.id, cards.map(c => c.id))
    isInExchange.value = false
  }

  // Human Scum/ViceScum confirms forced best cards
  async function confirmScumExchange() {
    const human = humanPlayer.value
    if (!human) return
    const part = exchangeParticipants.value.find(p => p.seatId === human.id)
    if (!part || part.canSelect) return
    isInExchange.value = false
    exchangeCanSelect.value = false
    exchangePreSelectedIds.value = []
    await applyExchangeConfirm(human.id, part.cardIds)
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
    exchangeParticipants.value = state.exchangeParticipants ?? []

    // Clear exchange UI state when moving to Playing phase
    if (state.phase === PresidentPhase.Playing) {
      isInExchange.value = false
      exchangeCanSelect.value = false
      exchangePreSelectedIds.value = []
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

  // Acknowledge exchange notification — continue game after human dismisses modal
  function acknowledgeExchange() {
    waitingForExchangeAck.value = false
    exchangeInfo.value = null

    if (phase.value === PresidentPhase.Playing) {
      timer.schedule('ai-turn', CardTimings.aiThink, () => processAITurn())
    }
  }

  async function playCards(cards: StandardCard[]) {
    if (cards.length === 0) return

    // Capture state before changes for chat
    captureStateForChat()

    const playingPlayer = currentPlayer.value
    const prev = gameState.value
    const state = processPlay(prev, playingPlayer, cards)
    if (state === prev) return

    // Update state from pure result (joker auto-clear included when superTwos)
    players.value = state.players
    currentPile.value = state.currentPile
    currentPlayer.value = state.currentPlayer
    consecutivePasses.value = state.consecutivePasses
    passedThisTrick.value = state.passedThisTrick
    finishedPlayers.value = state.finishedPlayers
    lastPlayerId.value = state.lastPlayerId
    lastPlayedCards.value = cards
    phase.value = state.phase

    // Wait for play animation before continuing
    if (playAnimationCallback) {
      // After joker clear, pile may be empty — use 0 as play index for anim hook
      const playIndex = Math.max(0, state.currentPile.plays.length - 1)
      await playAnimationCallback({ cards, playerId: playingPlayer, playIndex })
    }

    // Check for round complete
    if (state.phase === PresidentPhase.RoundComplete) {
      handleRoundComplete()
      return
    }

    // Joker clear: pure emptied pile — host only runs clear animation/callbacks
    const playedJoker = cards.some(c => c.rank === 'Joker')
    if (playedJoker && rules.value.superTwosMode && state.currentPile.plays.length === 0) {
      lastPlayedCards.value = null
      pileJustCleared = true
      processChatAfterStateChange()
      if (pileClearedCallback) await pileClearedCallback()
      processAITurn()
      return
    }

    // Continue game
    processAITurn()
  }

  async function pass() {
    // Capture state before changes for chat
    captureStateForChat()
    
    const hadCards = currentPile.value.currentRank !== null
    const state = processPass(gameState.value, currentPlayer.value)

    // Update state
    currentPile.value = state.currentPile
    currentPlayer.value = state.currentPlayer
    consecutivePasses.value = state.consecutivePasses
    passedThisTrick.value = state.passedThisTrick
    lastPlayedCards.value = null

    // Pile was cleared (everyone passed) — wait for sweep animation
    if (hadCards && state.currentPile.currentRank === null) {
      pileJustCleared = true
      processChatAfterStateChange()
      if (pileClearedCallback) await pileClearedCallback()
    }

    processAITurn()
  }

  function handleRoundComplete() {
    // Capture state before changes for chat
    captureStateForChat()
    
    phase.value = PresidentPhase.RoundComplete

    // Assign ranks based on finish order
    const state = assignRanks(gameState.value)
    players.value = state.players

    // Check if game should end (e.g., after 5 rounds)
    if (roundNumber.value >= 5) {
      gameOver.value = true
      phase.value = PresidentPhase.GameOver
    } else {
      // Show summary modal - user must click Continue to proceed
      showRoundSummary.value = true
    }
    
    // Process chat after round complete (will detect first/last out, game over)
    processChatAfterStateChange()
  }

  function dismissRoundSummary() {
    showRoundSummary.value = false
    startRound()
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
    timer.schedule('ai-turn', CardTimings.aiThink, () => {
      if (phase.value !== PresidentPhase.Playing) return

      const hard = settingsStore.isHardAI()
      const play = hard
        ? choosePresidentPlayHard(player, currentPile.value, gameState.value)
        : choosePresidentPlay(player, currentPile.value, gameState.value)

      if (play === null) {
        pass()
      } else {
        playCards(play)
      }
    })
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
    showRoundSummary,
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
    
    // Exchange state (unified with MP)
    isInExchange,
    exchangeCanSelect,
    exchangePreSelectedIds,

    // Actions
    startNewGame,
    startRound,
    playCards,
    pass,
    giveCardsBack,
    confirmScumExchange,
    getPlayerRankDisplay,
    acknowledgeExchange,
    dismissRoundSummary,
    dealAnimationComplete,
    setPlayAnimationCallback,
    setPileClearedCallback,
    setExchangeAnimationCallback,
    
    // Timer control (for cleanup/pause)
    cancelTimers: () => timer.cancelAll(),
    pauseTimers: () => timer.pauseAll(),
    resumeTimers: () => timer.resumeAll(),
  }
})
