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
  // Remarks engine
  createSpadesRemarkEngine,
  type SpadesRemarkState,
  type SpadesRemarkFlags,
  type RemarkMode,
} from '@67cards/shared'
import { useSettingsStore } from '@/stores/settingsStore'
import { useChatStore } from '@/stores/chatStore'
import { CardTimings } from '@/utils/animationTimings'

export const useSpadesStore = defineStore('spadesGame', () => {
  const settingsStore = useSettingsStore()
  const chatStore = useChatStore()
  const tracker = new SpadesTracker()
  const timer = createGameTimer()
  
  // Remarks engine (holds previous state snapshot + cooldown)
  const remarkEngine = createSpadesRemarkEngine()
  let remarkEventFlags: SpadesRemarkFlags = {}

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
  const blindNilEnabled = ref(false)
  const handRevealed = ref<boolean[]>([true, true, true, true])

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
    blindNilEnabled: blindNilEnabled.value,
    handRevealed: handRevealed.value,
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

  const userCardsRevealed = computed(() => {
    const human = humanPlayer.value
    if (!human) return true
    return handRevealed.value[human.id] ?? true
  })

  // Blind nil decision pending when: pure flag says seat not revealed on bid turn
  const blindNilDecisionPending = computed(() => {
    return blindNilEnabled.value && isHumanBidding.value && !userCardsRevealed.value
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

  // Remarks engine helpers
  function getRemarkStateSnapshot(): SpadesRemarkState {
    return {
      phase: phase.value,
      scores: scores.value.map(s => ({ teamId: s.teamId, score: s.score, bags: s.bags })),
      roundNumber: roundNumber.value,
      gameOver: gameOver.value,
      winner: winner.value,
      ...remarkEventFlags,
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

    remarkEventFlags = {}
  }

  function captureStateForChat() {
    remarkEngine.capture(getRemarkStateSnapshot())
  }

  // Live nil-death detection: the trick winner was a nil bidder taking their first trick
  function flagNilBrokenIfNeeded(state: SpadesGameState, winnerId: number | undefined) {
    if (winnerId === undefined) return
    const winner = state.players[winnerId]
    if (!winner?.bid) return
    const isNilBid = winner.bid.type === SpadesBidType.Nil || winner.bid.type === SpadesBidType.BlindNil
    if (isNilBid && winner.tricksWon === 1) {
      remarkEventFlags.nilBroken = {
        playerId: winner.id,
        blind: winner.bid.type === SpadesBidType.BlindNil,
      }
    }
  }

  // Detect nil/set events at round end by comparing pre and post-scoring state
  function detectRoundEndChatEvents(preScoreState: SpadesGameState, postScoreState: SpadesGameState) {
    // Made nils only — failures are remarked live via nilBroken
    for (const player of preScoreState.players) {
      if (!player.bid) continue

      const isNilBid = player.bid.type === SpadesBidType.Nil || player.bid.type === SpadesBidType.BlindNil

      if (isNilBid && player.tricksWon === 0) {
        remarkEventFlags.nilMade = {
          playerId: player.id,
          blind: player.bid.type === SpadesBidType.BlindNil,
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
      
      if (totalBid > totalTricks) {
        remarkEventFlags.setBid = { teamId: team }
      }
    }
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

    const state = Spades.createSpadesGame(
      playerNames,
      0,
      500,
      -200,
      settingsStore.spadesBlindNil
    )
    applyState(state)

    // Deal cards
    startRound()
  }

  function waitForDealThenBid() {
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

  function startRound() {
    tracker.reset()
    const dealtState = Spades.dealSpadesCards(gameState.value)
    applyState(dealtState)
    waitForDealThenBid()
  }

  function startNextRound() {
    // Rotate dealer + deal once (do NOT call startNewRound then startRound — that double-deals)
    tracker.reset()
    const prepared: SpadesGameState = {
      ...gameState.value,
      dealer: (gameState.value.dealer + 1) % 4,
      roundNumber: gameState.value.roundNumber + 1,
    }
    const dealtState = Spades.dealSpadesCards(prepared)
    applyState(dealtState)
    waitForDealThenBid()
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

    const blindNilBid: SpadesBid = { type: SpadesBidType.BlindNil, count: 0 }
    const state = Spades.processBid(gameState.value, human.id, blindNilBid)
    if (state === gameState.value) return
    applyState(state)
    processAITurn()
  }

  // Blind nil: user chooses to see cards (forfeits blind nil option)
  function revealCards() {
    const human = humanPlayer.value
    if (!human || !blindNilDecisionPending.value) return
    const state = Spades.processRevealHand(gameState.value, human.id)
    if (state === gameState.value) return
    applyState(state)
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

      // A nil bidder taking a trick is remarked live, not at scoring
      flagNilBrokenIfNeeded(state, lastTrick?.winnerId ?? undefined)

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

        // state already has scores applied: playCard calls completeRound internally
        // on the 13th trick, so calling completeRound again would double the score.
        detectRoundEndChatEvents(state, state)

        if (state.gameOver) {
          phase.value = SpadesPhase.GameOver
        } else {
          // Show round summary (UI will call startNextRound when ready)
          phase.value = SpadesPhase.RoundComplete
        }

        // Process chat after round complete
        processChatAfterStateChange()
        return
      }

      // Surface any live trick event (broken nil) before play continues
      if (remarkEventFlags.nilBroken) {
        processChatAfterStateChange()
      }

      // Continue to next trick
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
        // AI always reveals first (does not bid BlindNil) when pure pre-look is active
        let state = gameState.value
        if (state.blindNilEnabled && !(state.handRevealed[playerId] ?? true)) {
          state = Spades.processRevealHand(state, playerId)
        }
        const bid = hard
          ? chooseSpadesBidHard(currentPlayerObj, state)
          : Spades.chooseSpadesBid(currentPlayerObj, state)
        state = Spades.processBid(state, playerId, bid)
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
    winScore.value = state.winScore
    loseScore.value = state.loseScore
    blindNilEnabled.value = state.blindNilEnabled
    handRevealed.value = state.handRevealed
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
