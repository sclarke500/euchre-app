import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  GameState,
  Player,
  Round,
  Card,
  Bid,
  TeamScore,
  EuchreGameState,
} from '@67cards/shared'
import {
  GamePhase,
  BidAction,
  createTrick,
  makeAIBidRound1,
  makeAIBidRound2,
  makeAIBidRound1Hard,
  makeAIBidRound2Hard,
  chooseCardToPlay,
  isPartnerWinning,
  chooseDealerDiscard,
  getRandomAINames,
  GameTracker,
  chooseCardToPlayHard,
  isPartnerWinningHard,
  createGameTimer,
  createEuchreRemarkEngine,
  type EuchreRemarkState,
  type RemarkMode,
  type EuchreRules,
  applyBid,
  applyDealerDiscard,
  applyPlay,
  continueAfterTrick,
  dealRound,
  startBiddingRound1,
  rotateDealer,
} from '@67cards/shared'
import { useSettingsStore } from '@/stores/settingsStore'
import { useChatStore } from '@/stores/chatStore'
import { CardTimings } from '@/utils/animationTimings'

export const useEuchreGameStore = defineStore('game', () => {
  const settingsStore = useSettingsStore()
  const chatStore = useChatStore()

  const gameTracker = new GameTracker()
  const timer = createGameTimer()
  const remarkEngine = createEuchreRemarkEngine()

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
  }

  function captureStateForChat() {
    remarkEngine.capture(getRemarkStateSnapshot())
  }

  // State
  const players = ref<Player[]>([])
  const currentRound = ref<Round | null>(null)
  const scores = ref<TeamScore[]>([
    { teamId: 0, score: 0 },
    { teamId: 1, score: 0 },
  ])
  const gameOver = ref(false)
  // UI-facing game-over flag: set only after the final play + trick sweep
  // animations finish, so the game-over modal (and confetti) don't pop while
  // the last card is still in flight. Logic paths keep using `gameOver`.
  const gameOverDisplayed = ref(false)
  const winner = ref<number | null>(null)
  const phase = ref<GamePhase>(GamePhase.Setup)
  const currentDealer = ref(0)
  const lastAIBidAction = ref<{ playerId: number; message: string } | null>(null)
  const biddingStartPlayer = ref(0)
  const passCount = ref(0)
  /** Rules frozen at game start (host contract — not live settings) */
  const gameRules = ref<EuchreRules>({
    stickTheDealer: false,
    canadianLoner: false,
  })

  // Animation callbacks — store awaits these before advancing turns
  let playAnimationCallback: ((data: { card: Card; playerId: number }) => Promise<void>) | null = null
  let trickCompleteCallback: ((winnerId: number) => Promise<void>) | null = null
  let dealAnimationCallback: (() => Promise<void>) | null = null
  let discardAnimationCallback: (() => void) | null = null

  function setPlayAnimationCallback(cb: typeof playAnimationCallback) {
    playAnimationCallback = cb
  }

  function setTrickCompleteCallback(cb: typeof trickCompleteCallback) {
    trickCompleteCallback = cb
  }

  function setDealAnimationCallback(cb: typeof dealAnimationCallback) {
    dealAnimationCallback = cb
  }

  function setDiscardAnimationCallback(cb: (() => void) | null) {
    discardAnimationCallback = cb
  }

  // ---- Pure state bridge ----

  function toPureState(): EuchreGameState {
    return {
      players: players.value,
      currentRound: currentRound.value,
      scores: scores.value,
      gameOver: gameOver.value,
      winner: winner.value,
      phase: phase.value,
      currentDealer: currentDealer.value,
      passCount: passCount.value,
      biddingStartPlayer: biddingStartPlayer.value,
      rules: gameRules.value,
    }
  }

  function applyPureState(next: EuchreGameState) {
    players.value = next.players
    currentRound.value = next.currentRound
    scores.value = next.scores
    gameOver.value = next.gameOver
    winner.value = next.winner
    phase.value = next.phase
    currentDealer.value = next.currentDealer
    passCount.value = next.passCount
    biddingStartPlayer.value = next.biddingStartPlayer
    gameRules.value = next.rules
    saveProgress()
  }

  // ---- Progress persistence ----
  //
  // Only the round boundary is persisted (scores, dealer, player names, rules).
  // Resuming redeals the interrupted hand rather than trying to rebuild a
  // half-played trick — mid-hand restore was the flaky part of the old
  // save/resume system (director animation state, AI timers, tracker).

  const SAVE_KEY = 'euchre:sp:progress'
  const SAVE_VERSION = 1

  interface SavedProgress {
    v: number
    savedAt: number
    playerNames: string[]
    scores: TeamScore[]
    currentDealer: number
    rules: EuchreRules
  }

  function saveProgress() {
    try {
      if (players.value.length !== 4) return
      if (gameOver.value || phase.value === GamePhase.GameOver || phase.value === GamePhase.Setup) {
        localStorage.removeItem(SAVE_KEY)
        return
      }
      const data: SavedProgress = {
        v: SAVE_VERSION,
        savedAt: Date.now(),
        playerNames: players.value.map(p => p.name),
        scores: scores.value.map(s => ({ ...s })),
        // On the round summary the dealer hasn't rotated yet; persist the
        // *next* hand's dealer so a resume doesn't replay the finished round.
        currentDealer: phase.value === GamePhase.RoundComplete
          ? (currentDealer.value + 1) % 4
          : currentDealer.value,
        rules: { ...gameRules.value },
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    } catch {
      // localStorage unavailable (private mode, quota) — persistence is best-effort
    }
  }

  function readSavedProgress(): SavedProgress | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return null
      const data = JSON.parse(raw) as Partial<SavedProgress>
      if (
        data.v !== SAVE_VERSION ||
        !Array.isArray(data.playerNames) || data.playerNames.length !== 4 ||
        !Array.isArray(data.scores) || data.scores.length !== 2 ||
        typeof data.currentDealer !== 'number' || data.currentDealer < 0 || data.currentDealer > 3 ||
        !data.rules
      ) {
        return null
      }
      return data as SavedProgress
    } catch {
      return null
    }
  }

  /** Saved-game summary for the resume prompt, or null if nothing worth resuming. */
  function getSavedGame(): { us: number; them: number } | null {
    const data = readSavedProgress()
    if (!data) return null
    const us = data.scores[0]?.score ?? 0
    const them = data.scores[1]?.score ?? 0
    // A 0-0 game has nothing to resume
    if (us === 0 && them === 0) return null
    return { us, them }
  }

  function clearSavedGame() {
    try { localStorage.removeItem(SAVE_KEY) } catch { /* ignore */ }
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

  const currentPlayer = computed(() => currentRound.value?.currentPlayer ?? 0)
  const trump = computed(() => currentRound.value?.trump ?? null)
  const currentTrick = computed(() => currentRound.value?.currentTrick ?? createTrick())

  const tricksTaken = computed<[number, number]>(() => {
    const tricks = currentRound.value?.tricks ?? []
    let team0 = 0
    let team1 = 0
    for (const trick of tricks) {
      if (trick.winnerId !== null) {
        if (trick.winnerId % 2 === 0) team0++
        else team1++
      }
    }
    return [team0, team1]
  })

  // ---- Deal / round lifecycle ----

  // Deal animation gate — the director calls dealAnimationComplete() when the
  // dealing visuals (flights + fan + sort) are done; only then does bidding
  // start. A fixed timer here used to race the animation, so AI bids could
  // announce before the user had even seen their hand.
  let dealCompleteResolve: (() => void) | null = null

  function dealAnimationComplete() {
    if (dealCompleteResolve) {
      const resolve = dealCompleteResolve
      dealCompleteResolve = null
      timer.cancel('deal-fallback')
      resolve()
    }
  }

  function scheduleBiddingAfterDeal() {
    const advance = () => {
      const next = startBiddingRound1(toPureState())
      applyPureState(next)
      processAITurn()
    }
    dealCompleteResolve = advance
    // Fallback: if no director signals within 15s (headless/tests, or an
    // animation path failed), advance anyway so the game can't get stuck.
    timer.schedule('deal-fallback', 15000, () => {
      if (dealCompleteResolve === advance) {
        dealCompleteResolve = null
        advance()
      }
    })
  }

  function startNewGame() {
    clearSavedGame()
    beginGame(null)
  }

  /**
   * Resume a saved game: same players, scores, rules and dealer, with the
   * interrupted hand redealt. Falls back to a new game if nothing is saved.
   */
  function resumeSavedGame() {
    beginGame(readSavedProgress())
  }

  function beginGame(saved: SavedProgress | null) {
    timer.cancelAll()
    dealCompleteResolve = null
    gameOverDisplayed.value = false

    const aiNames = getRandomAINames(3)
    const playerName = localStorage.getItem('odusNickname')?.trim() || 'You'

    // Snapshot rules at game start (not live from settings mid-round)
    gameRules.value = saved
      ? { ...saved.rules }
      : {
          stickTheDealer: settingsStore.isStickTheDealer(),
          canadianLoner: settingsStore.canadianLoner === true,
        }

    const names = saved?.playerNames
    players.value = [
      { id: 0, name: playerName, hand: [], isHuman: true, teamId: 0 },
      { id: 1, name: names?.[1] ?? aiNames[0] ?? 'Tron', hand: [], isHuman: false, teamId: 1 },
      { id: 2, name: names?.[2] ?? aiNames[1] ?? 'Data', hand: [], isHuman: false, teamId: 0 },
      { id: 3, name: names?.[3] ?? aiNames[2] ?? 'Neon', hand: [], isHuman: false, teamId: 1 },
    ]

    scores.value = saved
      ? [
          { teamId: 0, score: saved.scores[0]?.score ?? 0 },
          { teamId: 1, score: saved.scores[1]?.score ?? 0 },
        ]
      : [
          { teamId: 0, score: 0 },
          { teamId: 1, score: 0 },
        ]
    gameOver.value = false
    winner.value = null
    currentDealer.value = saved ? saved.currentDealer : Math.floor(Math.random() * 4)
    phase.value = GamePhase.Setup
    currentRound.value = null
    passCount.value = 0

    startNewRound()
  }

  function startNewRound() {
    gameTracker.reset()
    const next = dealRound(toPureState())
    applyPureState(next)
    scheduleBiddingAfterDeal()
  }

  // ---- Bidding ----

  function makeBid(bid: Bid) {
    if (!currentRound.value) return

    const prev = toPureState()
    let next = applyBid(prev, bid)
    if (next === prev) return

    applyPureState(next)

    if (next.currentRound?.trump) {
      gameTracker.setTrump(next.currentRound.trump.suit)
    }

    // R2 all-pass redeal: pure already dealt
    if (next.phase === GamePhase.Dealing) {
      scheduleBiddingAfterDeal()
      return
    }

    // AI dealer auto-discard after pickup (human waits for dealerDiscard)
    if (next.phase === GamePhase.DealerDiscard && next.currentRound?.trump) {
      const dealerSeat = next.currentRound.dealer
      const dealer = players.value[dealerSeat]
      if (dealer && !dealer.isHuman) {
        const cardToDiscard = chooseDealerDiscard(dealer.hand, next.currentRound.trump.suit)
        const before = toPureState()
        const after = applyDealerDiscard(before, cardToDiscard.id)
        if (after !== before) {
          applyPureState(after)
          // Nobody's turn during any residual anim; processAITurn will run for lead
          processAITurn()
          return
        }
      }
      // Human dealer: wait for UI
      return
    }

    if (next.phase === GamePhase.Playing) {
      processAITurn()
    } else if (
      next.phase === GamePhase.BiddingRound1 ||
      next.phase === GamePhase.BiddingRound2
    ) {
      processAITurn()
    }
  }

  /**
   * Human (or director) discards after order-up.
   * Pure apply moves to Playing; director calls startPlayingPhase after anim.
   */
  function dealerDiscard(card: Card) {
    if (!currentRound.value) return

    const prev = toPureState()
    const next = applyDealerDiscard(prev, card.id)
    if (next === prev) return

    applyPureState(next)

    // Optional SP hook (director may register a no-op to own timing)
    if (discardAnimationCallback) {
      discardAnimationCallback()
      discardAnimationCallback = null
    }
  }

  /**
   * Director calls this after discard animation completes (SP).
   * Pure state is already Playing after dealerDiscard.
   */
  function startPlayingPhase() {
    processAITurn()
  }

  // ---- Play ----

  async function playCard(card: Card, playerId: number) {
    if (!currentRound.value || !currentRound.value.trump) return

    const prev = toPureState()
    const prevTrickCount = prev.currentRound?.tricks.length ?? 0
    const next = applyPlay(prev, playerId, card.id)
    if (next === prev) return

    applyPureState(next)

    if (playAnimationCallback) {
      await playAnimationCallback({ card, playerId })
    }

    const trickJustCompleted =
      (next.currentRound?.tricks.length ?? 0) > prevTrickCount

    if (trickJustCompleted && next.currentRound) {
      const completedTrick = next.currentRound.tricks[next.currentRound.tricks.length - 1]!
      gameTracker.recordTrick(completedTrick)

      if (trickCompleteCallback && completedTrick.winnerId !== null) {
        await trickCompleteCallback(completedTrick.winnerId)
      }

      // 5th trick: pure already scored (RoundComplete / GameOver)
      if (
        next.phase === GamePhase.RoundComplete ||
        next.phase === GamePhase.GameOver ||
        next.currentRound.tricks.length >= 5
      ) {
        captureStateForChat()
        processChatAfterStateChange()

        if (next.phase === GamePhase.GameOver || next.gameOver) {
          // Final card has landed and the trick was swept (awaited above) —
          // now the game-over modal may show.
          gameOverDisplayed.value = true
          return
        }

        // Pure rotate for chip UX during pause (not a phase-machine fork)
        const beforeRotate = toPureState()
        const rotated = rotateDealer(beforeRotate)
        if (rotated !== beforeRotate) applyPureState(rotated)
        timer.schedule('next-round', 2000, () => {
          gameTracker.reset()
          // Dealer already advanced — deal only (don't double-rotate via startNextRound)
          const dealt = dealRound(toPureState())
          applyPureState(dealt)
          scheduleBiddingAfterDeal()
        })
        return
      }

      // Mid-round: continue to next trick
      const before = toPureState()
      const continued = continueAfterTrick(before)
      if (continued !== before) {
        applyPureState(continued)
      }
      processAITurn()
      return
    }

    processAITurn()
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
    void isDealer
    return ''
  }

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  async function processAITurn() {
    if (!currentRound.value) return

    const current = currentRound.value.currentPlayer
    const player = players.value[current]
    if (!player) return

    if (player.isHuman) {
      return
    }

    // Dealer discard is handled in makeBid for AI; human uses dealerDiscard
    if (phase.value === GamePhase.DealerDiscard) {
      return
    }

    await sleep(CardTimings.aiThink)
    if (!currentRound.value) return

    const hard = settingsStore.isHardAI()

    if (phase.value === GamePhase.BiddingRound1) {
      if (!currentRound.value.turnUpCard) return
      const bid = hard
        ? makeAIBidRound1Hard(player, currentRound.value.turnUpCard, currentRound.value.dealer)
        : makeAIBidRound1(player, currentRound.value.turnUpCard, currentRound.value.dealer)
      const message = getBidMessage(bid, player.id === currentRound.value.dealer)
      lastAIBidAction.value = { playerId: player.id, message }
      await sleep(800)
      lastAIBidAction.value = null
      makeBid(bid)
    } else if (phase.value === GamePhase.BiddingRound2) {
      if (!currentRound.value.turnUpCard) return
      const bid = hard
        ? makeAIBidRound2Hard(
            player,
            currentRound.value.turnUpCard.suit,
            currentRound.value.dealer,
            gameRules.value.stickTheDealer
          )
        : makeAIBidRound2(
            player,
            currentRound.value.turnUpCard.suit,
            currentRound.value.dealer,
            gameRules.value.stickTheDealer
          )
      const message = getBidMessage(bid, player.id === currentRound.value.dealer)
      lastAIBidAction.value = { playerId: player.id, message }
      await sleep(800)
      lastAIBidAction.value = null
      makeBid(bid)
    } else if (phase.value === GamePhase.Playing && currentRound.value.trump) {
      let card: Card
      if (hard) {
        const partnerWinning = isPartnerWinningHard(
          currentRound.value.currentTrick,
          player.id,
          currentRound.value.trump.suit
        )
        const isGoingAlone =
          currentRound.value.goingAlone &&
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
      await playCard(card, player.id)
    }
  }

  function nextTrick() {
    if (!currentRound.value) return
    const before = toPureState()
    if (before.phase === GamePhase.TrickComplete) {
      const continued = continueAfterTrick(before)
      if (continued !== before) applyPureState(continued)
    } else {
      currentRound.value.currentTrick = createTrick()
      phase.value = GamePhase.Playing
    }
  }

  return {
    players,
    currentRound,
    scores,
    gameOver,
    gameOverDisplayed,
    winner,
    phase,
    currentPlayer,
    trump,
    currentTrick,
    tricksTaken,
    gameState,
    lastAIBidAction,

    startNewGame,
    resumeSavedGame,
    getSavedGame,
    clearSavedGame,
    startNewRound,
    makeBid,
    playCard,
    nextTrick,
    dealerDiscard,

    setPlayAnimationCallback,
    setTrickCompleteCallback,
    setDealAnimationCallback,
    setDiscardAnimationCallback,
    startPlayingPhase,
    dealAnimationComplete,

    cancelTimers: () => timer.cancelAll(),
    pauseTimers: () => timer.pauseAll(),
    resumeTimers: () => timer.resumeAll(),
  }
})
