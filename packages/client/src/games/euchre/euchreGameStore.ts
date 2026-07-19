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
  applyBid,
  applyDealerDiscard,
  applyPlay,
  continueAfterTrick,
  dealRound,
  startBiddingRound1,
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
  const winner = ref<number | null>(null)
  const phase = ref<GamePhase>(GamePhase.Setup)
  const currentDealer = ref(0)
  const lastAIBidAction = ref<{ playerId: number; message: string } | null>(null)
  const biddingStartPlayer = ref(0)
  const passCount = ref(0)

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

  function rulesFromSettings() {
    return {
      stickTheDealer: settingsStore.isStickTheDealer(),
      canadianLoner: settingsStore.canadianLoner === true,
    }
  }

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
      rules: rulesFromSettings(),
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

  function scheduleBiddingAfterDeal() {
    timer.schedule('deal-fallback', CardTimings.roundEnd, () => {
      const next = startBiddingRound1(toPureState())
      applyPureState(next)
      processAITurn()
    })
  }

  function startNewGame() {
    timer.cancelAll()

    const aiNames = getRandomAINames(3)
    const playerName = localStorage.getItem('odusNickname')?.trim() || 'You'

    players.value = [
      { id: 0, name: playerName, hand: [], isHuman: true, teamId: 0 },
      { id: 1, name: aiNames[0] ?? 'Tron', hand: [], isHuman: false, teamId: 1 },
      { id: 2, name: aiNames[1] ?? 'Data', hand: [], isHuman: false, teamId: 0 },
      { id: 3, name: aiNames[2] ?? 'Neon', hand: [], isHuman: false, teamId: 1 },
    ]

    scores.value = [
      { teamId: 0, score: 0 },
      { teamId: 1, score: 0 },
    ]
    gameOver.value = false
    winner.value = null
    currentDealer.value = Math.floor(Math.random() * 4)
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
          return
        }

        // Rotate dealer now so the chip moves during the pause (matches prior UX)
        currentDealer.value = (currentDealer.value + 1) % 4
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

    if (phase.value === GamePhase.BiddingRound1) {
      if (!currentRound.value.turnUpCard) return
      const bid = makeAIBidRound1(player, currentRound.value.turnUpCard, currentRound.value.dealer)
      const message = getBidMessage(bid, player.id === currentRound.value.dealer)
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
      const message = getBidMessage(bid, player.id === currentRound.value.dealer)
      lastAIBidAction.value = { playerId: player.id, message }
      await sleep(800)
      lastAIBidAction.value = null
      makeBid(bid)
    } else if (phase.value === GamePhase.Playing && currentRound.value.trump) {
      let card: Card
      if (settingsStore.isHardAI()) {
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
    winner,
    phase,
    currentPlayer,
    trump,
    currentTrick,
    tricksTaken,
    gameState,
    lastAIBidAction,

    startNewGame,
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

    cancelTimers: () => timer.cancelAll(),
    pauseTimers: () => timer.pauseAll(),
    resumeTimers: () => timer.resumeAll(),
  }
})
