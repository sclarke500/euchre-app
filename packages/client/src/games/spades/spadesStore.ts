import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  SpadesPhase,
  SpadesBidType,
  Spades,
  type SpadesGameState,
  type SpadesPlayer,
  type SpadesBid,
  type SpadesTrick,
  type SpadesTeamScore,
  type StandardCard,
  getRandomAINames,
  SpadesTracker,
  chooseSpadesCardHard,
  chooseSpadesBidHard,
  createGameTimer,
  // Chat engine
  processSpadesChat,
  type SpadesChatState,
  type ChatMode,
} from '@67cards/shared'
import { useSettingsStore } from '@/stores/settingsStore'
import { useChatStore } from '@/stores/chatStore'
import { CardTimings } from '@/utils/animationTimings'

export const useSpadesStore = defineStore('spadesGame', () => {
  const settingsStore = useSettingsStore()
  const chatStore = useChatStore()
  const tracker = new SpadesTracker()
  const timer = createGameTimer()
  
  // Chat engine state
  let previousChatState: SpadesChatState | null = null
  let chatEventFlags: { nilMade?: { playerId: number; blind: boolean }; nilFailed?: { playerId: number; blind: boolean }; setBid?: { teamId: number } } = {}

  // State
  const players = ref<SpadesPlayer[]>([])
  const phase = ref<SpadesPhase>(SpadesPhase.Setup)
  const currentTrick = ref<SpadesTrick>(Spades.createSpadesTrick())
  const completedTricks = ref<SpadesTrick[]>([])
  const currentPlayer = ref(0)
  const dealer = ref(0)
  const scores = ref<SpadesTeamScore[]>([
    { teamId: 0, score: 0, bags: 0 },
    { teamId: 1, score: 0, bags: 0 },
  ])
  const roundNumber = ref(1)
  const gameOver = ref(false)
  const winner = ref<number | null>(null)
  const spadesBroken = ref(false)
  const bidsComplete = ref(false)
  const gameLost = ref(false) // Always false for singleplayer, but keeps interface consistent
  const winScore = ref(500)
  const loseScore = ref(-200)
  const userCardsRevealed = ref(true) // Whether user can see their cards (false during blind nil decision)

  // Animation callbacks
  let dealCompleteResolve: (() => void) | null = null
  let playAnimationCallback: ((play: { card: StandardCard; playerId: number }) => Promise<void>) | null = null
  let trickCompleteCallback: ((winnerId: number) => Promise<void>) | null = null

  // Computed
  const gameState = computed<SpadesGameState>(() => ({
    gameType: 'spades',
    players: players.value,
    phase: phase.value,
    currentTrick: currentTrick.value,
    completedTricks: completedTricks.value,
    currentPlayer: currentPlayer.value,
    dealer: dealer.value,
    scores: scores.value,
    roundNumber: roundNumber.value,
    gameOver: gameOver.value,
    winner: winner.value,
    spadesBroken: spadesBroken.value,
    bidsComplete: bidsComplete.value,
    winScore: winScore.value,
    loseScore: loseScore.value,
  }))

  const humanPlayer = computed(() =>
    players.value.find(p => p.isHuman)
  )

  const isHumanTurn = computed(() => {
    const human = humanPlayer.value
    return human && currentPlayer.value === human.id
  })

  const isHumanBidding = computed(() => {
    return isHumanTurn.value && phase.value === SpadesPhase.Bidding
  })

  // Blind nil decision pending when: blind nil enabled, user's turn to bid, cards not revealed yet
  const blindNilDecisionPending = computed(() => {
    return settingsStore.spadesBlindNil && isHumanBidding.value && !userCardsRevealed.value
  })
  
  // Show normal bid wheel only after cards revealed (or blind nil disabled)
  const showBidWheel = computed(() => {
    return isHumanBidding.value && userCardsRevealed.value
  })

  const isHumanPlaying = computed(() => {
    return isHumanTurn.value && phase.value === SpadesPhase.Playing
  })

  const validPlays = computed(() => {
    const human = humanPlayer.value
    if (!human || !isHumanPlaying.value) return []
    return Spades.getLegalPlays(human.hand, currentTrick.value, spadesBroken.value)
  })

  const teamBids = computed(() => {
    return [
      Spades.getTeamBidDisplay(players.value, 0),
      Spades.getTeamBidDisplay(players.value, 1),
    ]
  })

  const teamTricks = computed<[number, number]>(() => {
    const team0 = players.value
      .filter(p => p.teamId === 0)
      .reduce((sum, p) => sum + p.tricksWon, 0)
    const team1 = players.value
      .filter(p => p.teamId === 1)
      .reduce((sum, p) => sum + p.tricksWon, 0)
    return [team0, team1]
  })

  // Animation callbacks setters
  function setPlayAnimationCallback(cb: typeof playAnimationCallback) {
    playAnimationCallback = cb
  }

  function setTrickCompleteCallback(cb: typeof trickCompleteCallback) {
    trickCompleteCallback = cb
  }

  // Chat engine helpers
  function getChatStateSnapshot(): SpadesChatState {
    return {
      phase: phase.value,
      scores: scores.value.map(s => ({ teamId: s.teamId, score: s.score, bags: s.bags })),
      currentPlayer: currentPlayer.value,
      roundNumber: roundNumber.value,
      gameOver: gameOver.value,
      winner: winner.value,
      spadesBroken: spadesBroken.value,
      players: players.value.map(p => ({
        id: p.id,
        teamId: p.teamId,
        bid: p.bid,
        tricksWon: p.tricksWon,
      })),
      ...chatEventFlags,
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

  function processChatAfterStateChange() {
    console.log('[Spades Chat] processChatAfterStateChange called')
    console.log('[Spades Chat] botChatEnabled:', settingsStore.botChatEnabled)
    
    if (!settingsStore.botChatEnabled) return
    
    const newState = getChatStateSnapshot()
    console.log('[Spades Chat] previousState phase:', previousChatState?.phase)
    console.log('[Spades Chat] newState phase:', newState.phase)
    console.log('[Spades Chat] chatEventFlags:', JSON.stringify(chatEventFlags))
    
    const chatMode: ChatMode = settingsStore.aiChatMode === 'unhinged' ? 'unhinged' : 'clean'
    
    const chatEvent = processSpadesChat(
      previousChatState,
      newState,
      getPlayersForChat(),
      chatMode
    )
    
    console.log('[Spades Chat] chatEvent:', chatEvent)
    
    if (chatEvent) {
      console.log('[Spades Chat] SENDING MESSAGE:', chatEvent.text, 'from', chatEvent.playerName)
      chatStore.receiveMessage({
        id: `ai-${chatEvent.seatIndex}-${Date.now()}`,
        odusId: chatEvent.odusId,
        seatIndex: chatEvent.seatIndex,
        playerName: chatEvent.playerName,
        text: chatEvent.text,
        timestamp: Date.now(),
      })
    }
    
    previousChatState = newState
    chatEventFlags = {}
  }

  function captureStateForChat() {
    previousChatState = getChatStateSnapshot()
  }
  
  // Detect nil/set events at round end by comparing pre and post-scoring state
  function detectRoundEndChatEvents(preScoreState: SpadesGameState, postScoreState: SpadesGameState) {
    console.log('[Spades Chat] detectRoundEndChatEvents called')
    
    for (const player of preScoreState.players) {
      if (!player.bid) continue
      
      const isNilBid = player.bid.type === SpadesBidType.Nil || player.bid.type === SpadesBidType.BlindNil
      const isBlind = player.bid.type === SpadesBidType.BlindNil
      
      if (isNilBid) {
        console.log('[Spades Chat] Player', player.id, 'had nil bid, tricks:', player.tricksWon)
        // Nil: success = 0 tricks, fail = 1+ tricks
        if (player.tricksWon === 0) {
          chatEventFlags.nilMade = { playerId: player.id, blind: isBlind }
        } else {
          chatEventFlags.nilFailed = { playerId: player.id, blind: isBlind }
        }
      }
    }
    
    // Detect set: team bid more than they got
    for (const team of [0, 1]) {
      const teamPlayers = preScoreState.players.filter(p => p.teamId === team)
      const totalBid = teamPlayers.reduce((sum, p) => {
        if (!p.bid || p.bid.type === SpadesBidType.Nil || p.bid.type === SpadesBidType.BlindNil) return sum
        return sum + p.bid.count
      }, 0)
      const totalTricks = teamPlayers.reduce((sum, p) => sum + p.tricksWon, 0)
      
      console.log('[Spades Chat] Team', team, 'bid:', totalBid, 'tricks:', totalTricks)
      
      if (totalBid > totalTricks) {
        chatEventFlags.setBid = { teamId: team }
        console.log('[Spades Chat] Team', team, 'got SET')
      }
    }
    
    console.log('[Spades Chat] Final chatEventFlags:', JSON.stringify(chatEventFlags))
  }

  function dealAnimationComplete() {
    timer.cancel('deal-fallback')  // Cancel fallback since animation completed
    if (dealCompleteResolve) {
      const resolve = dealCompleteResolve
      dealCompleteResolve = null
      resolve()
    }
  }

  // Actions
  function startNewGame() {
    // Cancel any pending timers from previous game
    timer.cancelAll()
    
    const aiNames = getRandomAINames(3)
    const playerName = localStorage.getItem('odusNickname')?.trim() || 'You'
    const playerNames = [playerName, ...aiNames]

    const state = Spades.createSpadesGame(playerNames, 0, 500, -200)
    applyState(state)

    // Deal cards
    startRound()
  }

  function startRound() {
    tracker.reset()
    const dealtState = Spades.dealSpadesCards(gameState.value)
    applyState(dealtState)
    phase.value = SpadesPhase.Dealing
    
    // Reset blind nil state: hide cards if blind nil is enabled
    userCardsRevealed.value = !settingsStore.spadesBlindNil

    // Wait for deal animation
    const advancePhase = () => {
      const biddingState = Spades.startBiddingPhase(gameState.value)
      applyState(biddingState)
      processAITurn()
    }

    dealCompleteResolve = advancePhase
    // Fallback: if no deal animation callback arrives, advance anyway.
    // Use a longer window so deal + reveal animations can finish.
    timer.schedule('deal-fallback', 6000, () => {
      if (dealCompleteResolve === advancePhase) {
        dealCompleteResolve = null
        advancePhase()
      }
    })
  }

  function startNextRound() {
    const newRoundState = Spades.startNewRound(gameState.value)
    applyState(newRoundState)
    startRound()
  }

  function makeBid(bid: SpadesBid) {
    const human = humanPlayer.value
    if (!human || !isHumanBidding.value) return

    const state = Spades.processBid(gameState.value, human.id, bid)
    applyState(state)

    if (state.phase === SpadesPhase.Playing) {
      processAITurn()
    } else {
      processAITurn()
    }
  }

  // Blind nil: user chooses to bid blind nil without seeing cards
  function submitBlindNil() {
    const human = humanPlayer.value
    if (!human || !blindNilDecisionPending.value) return
    
    // Import is at top of file
    const blindNilBid: SpadesBid = { type: SpadesBidType.BlindNil, count: 0 }
    userCardsRevealed.value = true // Reveal cards after bidding
    
    const state = Spades.processBid(gameState.value, human.id, blindNilBid)
    applyState(state)
    processAITurn()
  }

  // Blind nil: user chooses to see cards (forfeits blind nil option)
  function revealCards() {
    if (!blindNilDecisionPending.value) return
    userCardsRevealed.value = true
  }

  async function playCard(card: StandardCard) {
    const human = humanPlayer.value
    if (!human || !isHumanPlaying.value) return

    // Verify legal play
    if (!validPlays.value.some(c => c.id === card.id)) return

    await executePlayCard(human.id, card)
  }

  async function executePlayCard(playerId: number, card: StandardCard) {
    console.log('[Spades Chat] executePlayCard called, completedTricks:', completedTricks.value.length)
    
    // Capture state BEFORE applying changes for chat engine
    captureStateForChat()
    
    const prevTrickLength = currentTrick.value.cards.length
    const state = Spades.playCard(gameState.value, playerId, card)
    applyState(state)

    // Wait for play animation
    if (playAnimationCallback) {
      await playAnimationCallback({ card, playerId })
    }

    // Check if trick complete OR round complete (13th trick goes straight to round_complete)
    console.log('[Spades Chat] After playCard - phase:', state.phase, 'completedTricks:', state.completedTricks.length)
    if (state.phase === SpadesPhase.TrickComplete || state.phase === SpadesPhase.RoundComplete) {
      console.log('[Spades Chat] TRICK COMPLETE - completedTricks now:', state.completedTricks.length)
      const lastTrick = state.completedTricks[state.completedTricks.length - 1]

      // Record completed trick for hard AI tracking
      if (lastTrick) tracker.recordTrick(lastTrick)

      if (lastTrick && trickCompleteCallback) {
        // Brief pause to let user see the completed trick before sweep
        await new Promise(r => setTimeout(r, CardTimings.sweep))
        await trickCompleteCallback(lastTrick.winnerId ?? 0)
      }

      // Check if round complete
      if (state.completedTricks.length === 13) {
        console.log('[Spades Chat] ROUND COMPLETE - 13 tricks done')
        // Wait for trick-complete animation to settle before showing modal
        await new Promise(r => setTimeout(r, CardTimings.roundEnd))

        const preScoreState = gameState.value
        
        // Round is complete - apply final scoring
        const scoredState = Spades.completeRound(gameState.value)
        applyState(scoredState)
        
        // Detect nil/set events for chat
        detectRoundEndChatEvents(preScoreState, scoredState)
        
        if (scoredState.gameOver) {
          phase.value = SpadesPhase.GameOver
        } else {
          // Show round summary (UI will call startNextRound when ready)
          phase.value = SpadesPhase.RoundComplete
        }
        
        // Process chat after round complete
        processChatAfterStateChange()
        return
      }

      // Continue to next trick
      await new Promise(r => setTimeout(r, CardTimings.phaseTransition))
      const continueState = Spades.continuePlay(gameState.value)
      applyState(continueState)
      processAITurn()
    } else {
      processAITurn()
    }
  }

  function processAITurn() {
    const playerId = currentPlayer.value
    const player = players.value[playerId]
    if (!player) return

    // Human player - wait for input
    if (player.isHuman) return

    const hard = settingsStore.isHardAI()

    // AI turn - schedule with delay (cancellable via timer)
    timer.schedule('ai-turn', CardTimings.aiThink, async () => {
      // Guard: verify it's still this player's turn (state may have changed)
      if (currentPlayer.value !== playerId) {
        console.warn('[Spades] AI turn skipped - no longer this player\'s turn')
        return
      }

      // Re-fetch player from current state
      const currentPlayerObj = players.value[playerId]
      if (!currentPlayerObj || currentPlayerObj.isHuman) {
        console.warn('[Spades] AI turn skipped - player state changed')
        return
      }

      if (phase.value === SpadesPhase.Bidding) {
        const bid = hard
          ? chooseSpadesBidHard(currentPlayerObj, gameState.value)
          : Spades.chooseSpadesBid(currentPlayerObj, gameState.value)
        const state = Spades.processBid(gameState.value, playerId, bid)
        applyState(state)
        processAITurn()
      } else if (phase.value === SpadesPhase.Playing) {
        const card = hard
          ? chooseSpadesCardHard(currentPlayerObj, gameState.value, tracker)
          : Spades.chooseSpadesCard(currentPlayerObj, gameState.value)
        await executePlayCard(playerId, card)
      }
    })
  }

  function applyState(state: SpadesGameState) {
    players.value = state.players
    phase.value = state.phase
    currentTrick.value = state.currentTrick
    completedTricks.value = state.completedTricks
    currentPlayer.value = state.currentPlayer
    dealer.value = state.dealer
    scores.value = state.scores
    roundNumber.value = state.roundNumber
    gameOver.value = state.gameOver
    winner.value = state.winner
    spadesBroken.value = state.spadesBroken
    bidsComplete.value = state.bidsComplete
  }

  return {
    // State
    players,
    phase,
    currentTrick,
    completedTricks,
    currentPlayer,
    dealer,
    scores,
    roundNumber,
    gameOver,
    winner,
    spadesBroken,
    bidsComplete,
    gameLost,
    gameState,

    // Computed
    humanPlayer,
    isHumanTurn,
    isHumanBidding,
    isHumanPlaying,
    validPlays,
    teamBids,
    teamTricks,
    blindNilDecisionPending,
    showBidWheel,
    userCardsRevealed,

    // Actions
    startNewGame,
    startRound,
    startNextRound,
    makeBid,
    playCard,
    dealAnimationComplete,
    setPlayAnimationCallback,
    setTrickCompleteCallback,
    submitBlindNil,
    revealCards,
    
    // Timer control (for cleanup/pause)
    cancelTimers: () => timer.cancelAll(),
    pauseTimers: () => timer.pauseAll(),
    resumeTimers: () => timer.resumeAll(),
  }
})
