/**
 * President Director
 *
 * Watches the PresidentGameAdapter and translates game state changes into
 * imperative commands on the CardTableEngine. Similar pattern to EuchreDirector
 * but adapted for President's mechanics: multi-card plays, accumulating center
 * pile, pile clear sweep, variable player count, card exchange phases.
 */

import { watch, nextTick, computed, ref, type Ref } from 'vue'
import { PresidentPhase, sortHandByRank } from '@67cards/shared'
import type { StandardCard, PendingExchange, ServerMessage } from '@67cards/shared'
import type { PresidentGameAdapter } from './usePresidentGameAdapter'
import type { CardTableEngine } from '@/composables/useCardTable'
import { computeTableLayout, type TableLayoutResult } from '@/composables/useTableLayout'
import type { EngineCard, CardPosition } from '@/components/cardContainers'
import { AnimationDurations, AnimationDelays, AnimationBuffers, sleep } from '@/utils/animationTimings'

// ── Animation timing ─────────────────────────────────────────────────────────

const DEAL_FLIGHT_MS = AnimationDurations.fast
const DEAL_STAGGER_MS = AnimationDelays.dealStagger
const CARD_PLAY_MS = AnimationDurations.slow
const PILE_SWEEP_MS = AnimationDurations.medium
const PILE_SWEEP_PAUSE_MS = AnimationDurations.slow
const DECK_EXIT_MS = AnimationDurations.slow

// ── Scale constants ──────────────────────────────────────────────────────────

const DECK_SCALE = 0.8
const PILE_CARD_SCALE = 1.0

// ── Helpers ──────────────────────────────────────────────────────────────────

function cardToEngineCard(card: StandardCard): EngineCard {
  return { id: card.id, suit: card.suit, rank: card.rank }
}

// ── Director ─────────────────────────────────────────────────────────────────

export interface PresidentDirectorOptions {
  boardRef: Ref<HTMLElement | null>
}

export function usePresidentDirector(
  game: PresidentGameAdapter,
  engine: CardTableEngine,
  options: PresidentDirectorOptions
) {
  const { boardRef } = options

  // Animation dedup state
  const lastAnimatedPhase = ref<PresidentPhase | null>(null)
  const isAnimating = ref(false)

  // MP queue processing state
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let processingActive = false
  let mpPilePlayCount = 0  // Tracks pile play count for position calculations in MP

  // Player status messages keyed by seat index
  const playerStatuses = ref<string[]>([])

  // ── Computed state for CardTable props ───────────────────────────────────

  const playerCount = computed(() => game.players.value.length)

  const playerNames = computed(() => game.players.value.map(p => p.name))

  const currentTurnSeat = computed(() => {
    const cp = game.currentPlayer.value
    return cp >= 0 ? playerIdToSeatIndex(cp) : -1
  })

  // ── Seat ↔ player mapping ─────────────────────────────────────────────

  function playerIdToSeatIndex(playerId: number): number {
    const myId = game.humanPlayer.value?.id ?? 0
    const count = playerCount.value
    return (playerId - myId + count) % count
  }

  function seatIndexToPlayerId(seatIndex: number): number {
    const myId = game.humanPlayer.value?.id ?? 0
    const count = playerCount.value
    return (seatIndex + myId) % count
  }

  // ── Layout helpers ────────────────────────────────────────────────────

  function getTableLayout(): TableLayoutResult | null {
    if (!boardRef.value) return null
    const layout = playerCount.value > 5 ? 'wide' : 'normal'
    return computeTableLayout(boardRef.value.offsetWidth, boardRef.value.offsetHeight, layout, playerCount.value)
  }

  /**
   * Position for a card in the center pile.
   * Each play group is stacked at center with slight random offset;
   * cards within a play spread horizontally.
   */
  function getPileCardPosition(playIndex: number, cardInPlayIndex: number, totalInPlay: number): CardPosition {
    const tl = getTableLayout()
    if (!tl) return { x: 0, y: 0, rotation: 0, zIndex: 500 }

    const center = tl.tableCenter
    // Each play group offset slightly from center
    const groupOffsetX = (playIndex % 3 - 1) * 12
    const groupOffsetY = -playIndex * 2
    // Cards within a play spread horizontally
    const middleIdx = (totalInPlay - 1) / 2
    const cardSpread = (cardInPlayIndex - middleIdx) * 22
    // Slight rotation per play group (deterministic pseudo-random)
    const seed = playIndex * 7919
    const groupRot = Math.sin(seed) * 5

    return {
      x: center.x + groupOffsetX + cardSpread,
      y: center.y + groupOffsetY,
      rotation: groupRot,
      zIndex: 500 + playIndex * 4 + cardInPlayIndex,
      scale: PILE_CARD_SCALE,
      flipY: 180,
    }
  }

  // ── Setup ─────────────────────────────────────────────────────────────

  function setupTable() {
    const tl = getTableLayout()
    if (!tl) return

    engine.reset()

    // Initialize statuses array
    playerStatuses.value = new Array(playerCount.value).fill('')

    // Create deck at center
    engine.createDeck(tl.tableCenter, DECK_SCALE)

    // Create center pile for played cards
    engine.createPile('center', tl.tableCenter, PILE_CARD_SCALE)

    // Create hands for each seat
    for (let i = 0; i < tl.seats.length; i++) {
      const seat = tl.seats[i]!
      const isUser = seat.isUser
      engine.createHand(`player-${i}`, seat.handPosition, {
        faceUp: false,
        fanDirection: 'horizontal',
        fanSpacing: isUser ? 18 : 10,
        rotation: seat.rotation,
        scale: 1.0,
        fanCurve: 0,
        angleToCenter: seat.angleToCenter,
        isUser,
      })
    }
  }

  // ── Deal animation ────────────────────────────────────────────────────

  async function animateDeal() {
    if (!boardRef.value || isAnimating.value) return
    isAnimating.value = true

    const deck = engine.getDeck()
    if (!deck) { isAnimating.value = false; return }

    const players = game.players.value
    const count = playerCount.value

    // Build deal queue: one card to each player, round-robin
    const maxCards = Math.max(...players.map(p => p.hand.length))
    const dealQueue: { seatIdx: number; card: EngineCard }[] = []
    for (let round = 0; round < maxCards; round++) {
      for (let seatIdx = 0; seatIdx < count; seatIdx++) {
        const player = players[seatIndexToPlayerId(seatIdx)]
        const card = player?.hand[round]
        if (card) dealQueue.push({ seatIdx, card: cardToEngineCard(card) })
      }
    }

    // Add to deck in reverse (LIFO — first deal entry goes on top)
    for (let i = dealQueue.length - 1; i >= 0; i--) {
      engine.addCardToDeck(dealQueue[i]!.card, false)
    }

    engine.refreshCards()
    await nextTick()

    // Snap all cards to deck position
    for (let i = 0; i < deck.cards.length; i++) {
      deck.cards[i]?.ref?.setPosition(deck.getCardPosition(i))
    }
    await nextTick()

    // Deal each card to its correct hand
    const hands = engine.getHands()
    const allFlights: Promise<any>[] = []
    for (let i = 0; i < dealQueue.length; i++) {
      const hand = hands[dealQueue[i]!.seatIdx]
      if (!hand || !deck.cards.length) continue
      allFlights.push(engine.dealCard(deck, hand, DEAL_FLIGHT_MS))
      // Stagger every full round of players
      if ((i + 1) % count === 0) {
        await sleep(DEAL_STAGGER_MS)
      }
    }
    await Promise.all(allFlights)

    // Stage 1: Move user hand to bottom, enlarge, flip face-up
    const userHand = hands[0]
    const userCardCount = players[seatIndexToPlayerId(0)]?.hand.length ?? 13
    if (userHand && boardRef.value) {
      const targetX = boardRef.value.offsetWidth / 2
      const targetY = boardRef.value.offsetHeight - 20
      // Scale down slightly for larger hands
      const targetScale = userCardCount > 10 ? 1.5 : 1.7

      userHand.position = { x: targetX, y: targetY }
      userHand.scale = targetScale
      userHand.fanSpacing = Math.min(20, 300 / userCardCount)

      for (const managed of userHand.cards) {
        const cardRef = engine.getCardRef(managed.card.id)
        if (cardRef) {
          cardRef.moveTo({
            ...cardRef.getPosition(),
            x: targetX, y: targetY, scale: targetScale, flipY: 180,
          }, AnimationDurations.slow)
        }
      }
      await sleep(AnimationDurations.slow + AnimationBuffers.settle)
    }

    // Stage 2: Shrink opponents + fan all hands
    for (let i = 1; i < hands.length; i++) {
      const h = hands[i]
      if (h) h.scale = 0.5
    }
    await Promise.all(hands.map(h => h.setMode('fanned', AnimationDurations.medium)))

    // Stage 3: Sort user hand
    await sortUserHand(AnimationDurations.medium)

    // Stage 4: Slide deck offscreen
    await animateDeckOffscreen()

    engine.refreshCards()
    isAnimating.value = false

    // Signal the store that dealing visuals are done — game can now advance
    game.dealAnimationComplete()
  }

  // ── Sort user hand ────────────────────────────────────────────────────

  async function sortUserHand(duration: number = AnimationDurations.medium) {
    const userHand = engine.getHands()[0]
    if (!userHand || userHand.cards.length === 0) return

    const humanHand = game.humanPlayer.value?.hand ?? []
    const sorted = sortHandByRank(humanHand)
    const sortedIds = sorted.map(c => c.id)

    const cardMap = new Map(userHand.cards.map(m => [m.card.id, m]))
    const reordered = sortedIds
      .map(id => cardMap.get(id))
      .filter((m): m is NonNullable<typeof m> => m != null)

    // Append any engine-only cards not in game state
    for (const m of userHand.cards) {
      if (!sortedIds.includes(m.card.id)) reordered.push(m)
    }

    userHand.cards = reordered
    await userHand.repositionAll(duration)
  }

  // ── Card exchange animation ──────────────────────────────────────────

  const EXCHANGE_MS = AnimationDurations.slow

  async function animateExchange(exchanges: PendingExchange[]) {
    const hands = engine.getHands()

    // Collect all card moves: remove from source, then add to dest + animate
    const moves: Array<{
      managed: ReturnType<typeof hands[0]['removeCard']> & {}
      toHand: typeof hands[0]
      toSeat: number
      cardId: string
    }> = []

    // Phase 1: Remove all exchanged cards from their source hands
    for (const exchange of exchanges) {
      const fromSeat = playerIdToSeatIndex(exchange.fromPlayerId)
      const toSeat = playerIdToSeatIndex(exchange.toPlayerId)
      const fromHand = hands[fromSeat]
      const toHand = hands[toSeat]
      if (!fromHand || !toHand) continue

      // Disable arc fan for user cards being moved away
      if (fromSeat === 0) {
        for (const card of exchange.cards) {
          engine.getCardRef(card.id)?.setArcFan(false)
        }
      }

      for (const card of exchange.cards) {
        const managed = fromHand.removeCard(card.id)
        if (managed) {
          moves.push({ managed, toHand, toSeat, cardId: card.id })
        }
      }
    }

    if (moves.length === 0) return

    // Phase 2: Add all cards to destination hands
    for (const move of moves) {
      move.toHand.addManagedCard(move.managed)
    }

    engine.refreshCards()
    await nextTick()

    // Phase 3: Animate all moves in parallel
    const animPromises: Promise<void>[] = []
    for (const move of moves) {
      const cardRef = engine.getCardRef(move.cardId)
      if (!cardRef) continue

      // Wire ref to new container
      move.toHand.setCardRef(move.cardId, cardRef)

      const index = move.toHand.cards.findIndex(m => m.card.id === move.cardId)
      // Face-up (flipY:180) for user hand, face-down (flipY:0) for opponents
      const flipY = move.toSeat === 0 ? 180 : 0
      const target = {
        ...move.toHand.getCardPosition(index >= 0 ? index : move.toHand.cards.length - 1),
        flipY,
      }

      animPromises.push(cardRef.moveTo(target, EXCHANGE_MS))
    }

    await Promise.all(animPromises)

    // Phase 4: Re-sort user hand and re-fan all affected hands
    const refanPromises: Promise<void>[] = []
    refanPromises.push(sortUserHand(AnimationDurations.medium))
    for (let i = 1; i < hands.length; i++) {
      if (hands[i]) refanPromises.push(hands[i]!.setMode('fanned', AnimationDurations.medium))
    }
    await Promise.all(refanPromises)
  }

  // ── Deck offscreen ────────────────────────────────────────────────────

  async function animateDeckOffscreen() {
    const deck = engine.getDeck()
    if (!deck || deck.cards.length === 0) return
    const tl = getTableLayout()
    if (!tl) return

    const offY = tl.tableBounds.top - 300

    await Promise.all(deck.cards.map(m => {
      const ref = engine.getCardRef(m.card.id)
      return ref?.moveTo({
        x: tl.tableCenter.x, y: offY, rotation: 0, zIndex: 50, scale: 1.0,
      }, DECK_EXIT_MS)
    }))

    deck.cards = []
    engine.refreshCards()
  }

  // ── Card play animation ───────────────────────────────────────────────

  async function animateCardPlay(
    play: { cards: StandardCard[]; playerId: number },
    playIndex: number
  ) {
    const tl = getTableLayout()
    if (!tl) return

    const seatIndex = playerIdToSeatIndex(play.playerId)
    const hand = engine.getHands()[seatIndex]
    const centerPile = engine.getPiles().find(p => p.id === 'center')
    if (!hand || !centerPile) return

    // Disable arc fan for user cards being played
    if (seatIndex === 0) {
      for (const card of play.cards) {
        engine.getCardRef(card.id)?.setArcFan(false)
      }
    }

    // Animate all cards in the play — target 180° so all cards land vertically
    const movePromises = play.cards.map((card, i) => {
      const targetPos = getPileCardPosition(playIndex, i, play.cards.length)
      // Fixed 180° target ensures vertical orientation regardless of source seat
      // (left/right cards spin 90°/270°, top/bottom spin 180°)
      targetPos.rotation = 180 + (targetPos.rotation ?? 0)
      centerPile.setCardTargetPosition(card.id, targetPos)
      return engine.moveCard(card.id, hand, centerPile, targetPos, CARD_PLAY_MS)
    })
    await Promise.all(movePromises)

    // Re-sort user hand or re-fan opponent hand
    if (seatIndex === 0) {
      await sortUserHand(AnimationDurations.fast)
    } else {
      await hand.setMode('fanned', AnimationDurations.fast)
    }
  }

  // ── MP card play animation ───────────────────────────────────────────

  async function animateCardPlayMP(cards: StandardCard[], playerId: number) {
    const tl = getTableLayout()
    if (!tl) return

    const seatIndex = playerIdToSeatIndex(playerId)
    const hand = engine.getHands()[seatIndex]
    const centerPile = engine.getPiles().find(p => p.id === 'center')
    if (!hand || !centerPile) return

    const playIndex = mpPilePlayCount
    mpPilePlayCount++

    // For user's own play: cards are real cards already in hand
    // For opponent play: consume placeholder cards, replace with real card data
    const cardIdsToMove: string[] = []

    for (const card of cards) {
      const hasCard = hand.cards.some(m => m.card.id === card.id)
      if (hasCard) {
        cardIdsToMove.push(card.id)
      } else if (seatIndex !== 0 && hand.cards.length > 0) {
        // Opponent placeholder — consume last placeholder, swap visual data
        const managed = hand.cards[hand.cards.length - 1]!
        const effectiveId = managed.card.id
        managed.card = { id: effectiveId, suit: card.suit, rank: card.rank }
        engine.refreshCards()
        cardIdsToMove.push(effectiveId)
      }
    }

    // Disable arc fan for user cards being played
    if (seatIndex === 0) {
      for (const id of cardIdsToMove) {
        engine.getCardRef(id)?.setArcFan(false)
      }
    }

    // Animate all cards to pile position
    const movePromises = cardIdsToMove.map((cardId, i) => {
      const targetPos = getPileCardPosition(playIndex, i, cards.length)
      targetPos.rotation = 180 + (targetPos.rotation ?? 0)
      centerPile.setCardTargetPosition(cardId, targetPos)
      return engine.moveCard(cardId, hand, centerPile, targetPos, CARD_PLAY_MS)
    })
    await Promise.all(movePromises)

    // Re-sort user hand or re-fan opponent hand
    if (seatIndex === 0) {
      await sortUserHand(AnimationDurations.fast)
    } else {
      await hand.setMode('fanned', AnimationDurations.fast)
    }
  }

  // ── Pile sync (for resync after server restart) ────────────────────────
  // Only syncs when there's a clear mismatch - avoids interfering with normal animations

  function syncVisualPileWithServer(serverPile: { plays?: Array<{ cards: StandardCard[] }> } | null) {
    const centerPile = engine.getPiles().find(p => p.id === 'center')
    if (!centerPile) return

    // Count cards in server pile
    let serverCardCount = 0
    let serverPlayCount = 0
    if (serverPile?.plays) {
      serverPlayCount = serverPile.plays.length
      for (const play of serverPile.plays) {
        serverCardCount += play.cards.length
      }
    }

    const visualCardCount = centerPile.cards.length

    // Only clear if server says pile is empty but we have visual cards
    // (this handles the case where pile was cleared on server but we missed the message)
    if (serverCardCount === 0 && visualCardCount > 0) {
      console.log('[PresidentDirector] Pile sync: server pile empty, clearing', visualCardCount, 'stale visual cards')
      centerPile.clear()
      engine.refreshCards()
      mpPilePlayCount = 0
    }
    
    // Also sync mpPilePlayCount if it drifted significantly
    // (allows animations to use correct play indices after resync)
    if (Math.abs(mpPilePlayCount - serverPlayCount) > 1) {
      console.log('[PresidentDirector] Pile sync: correcting mpPilePlayCount from', mpPilePlayCount, 'to', serverPlayCount)
      mpPilePlayCount = serverPlayCount
    }
  }

  // ── Pile sweep animation ──────────────────────────────────────────────

  async function animatePileSweep() {
    const centerPile = engine.getPiles().find(p => p.id === 'center')
    if (!centerPile || centerPile.cards.length === 0) return

    const tl = getTableLayout()
    if (!tl) return

    // Brief pause to show the final state of the pile
    await sleep(PILE_SWEEP_PAUSE_MS)

    // Sweep all cards to the right offscreen
    const offX = tl.tableBounds.right + 300

    await Promise.all(centerPile.cards.map(m => {
      const ref = engine.getCardRef(m.card.id)
      return ref?.moveTo({
        x: offX,
        y: tl.tableCenter.y,
        rotation: 30,
        zIndex: 50,
        scale: 0.5,
      }, PILE_SWEEP_MS)
    }))

    centerPile.clear()
    engine.refreshCards()
  }

  // ── Phase handler ─────────────────────────────────────────────────────

  async function handlePhase(newPhase: PresidentPhase) {
    if (newPhase === lastAnimatedPhase.value) return
    lastAnimatedPhase.value = newPhase

    switch (newPhase) {
      case PresidentPhase.Dealing:
        clearPlayerStatuses()
        setupTable()
        await nextTick()
        await animateDeal()
        break

      case PresidentPhase.PresidentGiving:
        // Exchange phase — hands are equal from deal, no changes needed yet
        break

      case PresidentPhase.Playing:
        // Exchange animations are handled via store callbacks — nothing to do here
        break

      case PresidentPhase.RoundComplete:
        updateFinishStatuses()
        break
    }
  }

  function updateFinishStatuses() {
    const finished = game.finishedPlayers.value
    for (let i = 0; i < finished.length; i++) {
      const playerId = finished[i]!
      const seat = playerIdToSeatIndex(playerId)
      const rankDisplay = game.getPlayerRankDisplay(playerId)
      setPlayerStatus(seat, rankDisplay || `#${i + 1}`)
    }
  }

  // ── MP phase transition handler ──────────────────────────────────────

  async function handlePhaseTransitionMP(newPhase: PresidentPhase, oldPhase: PresidentPhase) {
    if (newPhase === lastAnimatedPhase.value) return
    lastAnimatedPhase.value = newPhase

    switch (newPhase) {
      case PresidentPhase.Dealing:
        clearPlayerStatuses()
        setupTable()
        await nextTick()
        await animateDeal()
        mpPilePlayCount = 0
        break

      case PresidentPhase.PresidentGiving:
        // Exchange phase — no extra animation needed yet
        break

      case PresidentPhase.Playing:
        mpPilePlayCount = 0
        break

      case PresidentPhase.RoundComplete:
        updateFinishStatuses()
        break
    }
  }

  // ── MP message processing loop ─────────────────────────────────────

  async function processMessageQueue() {
    if (processingActive) return
    if (!boardRef.value) return
    if (!game.getQueueLength || game.getQueueLength() === 0) return

    processingActive = true
    try {
      while (game.getQueueLength!() > 0) {
        const msg = game.dequeueMessage!()
        if (!msg) break
        await processOneMessage(msg)
      }
    } catch (err) {
      console.error('[PresidentDirector] Error processing message queue:', err)
    } finally {
      processingActive = false
    }
  }

  async function processOneMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'president_play_made': {
        isAnimating.value = true
        try {
          await animateCardPlayMP(msg.cards, msg.playerId)
        } finally {
          isAnimating.value = false
        }
        game.applyMessage!(msg)
        break
      }

      case 'president_passed': {
        const seat = playerIdToSeatIndex(msg.playerId)
        setPlayerStatus(seat, 'Pass', 1500)
        game.applyMessage!(msg)
        // Brief pause so "Pass" is visible
        if (seat !== 0) {
          await sleep(800)
        }
        break
      }

      case 'president_pile_cleared': {
        isAnimating.value = true
        try {
          await animatePileSweep()
          mpPilePlayCount = 0
        } finally {
          isAnimating.value = false
        }
        game.applyMessage!(msg)
        break
      }

      case 'president_player_finished': {
        const seat = playerIdToSeatIndex(msg.playerId)
        setPlayerStatus(seat, 'Out!')
        game.applyMessage!(msg)
        break
      }

      case 'president_game_state': {
        const oldPhase = game.phase.value
        game.applyMessage!(msg)
        const newPhase = msg.state.phase as PresidentPhase
        if (newPhase !== oldPhase) {
          await handlePhaseTransitionMP(newPhase, oldPhase)
        }
        // Sync visual pile with server state (handles resync after server restart)
        syncVisualPileWithServer(msg.state.currentPile)
        // Sync pile play count from game state
        mpPilePlayCount = msg.state.currentPile?.plays?.length ?? 0
        break
      }

      case 'president_round_complete': {
        updateFinishStatuses()
        game.applyMessage!(msg)
        break
      }

      default:
        // president_your_turn, exchange messages, error, player_timed_out, etc.
        game.applyMessage!(msg)
        break
    }
  }

  // ── Watchers / MP setup ─────────────────────────────────────────────

  if (game.isMultiplayer) {
    // ── Multiplayer: queue-based processing ──
    game.enableQueueMode?.()
    pollTimer = setInterval(processMessageQueue, 16)

    // Handle boardRef becoming available (component mount)
    watch(boardRef, async (newRef) => {
      if (!newRef) return
      // If state already exists (messages arrived before mount), catch up
      const phase = game.phase.value
      if (phase !== PresidentPhase.Setup && lastAnimatedPhase.value === null) {
        setupTable()
        await nextTick()
        if (phase === PresidentPhase.Dealing) {
          await animateDeal()
        }
        lastAnimatedPhase.value = phase
      }
    })
  } else {
    // ── Singleplayer: watcher-based reactivity ──

    // Phase changes - must be async and await handlePhase
    watch(
      () => game.phase.value,
      async (newPhase) => {
        // Wait for board to be ready
        if (!boardRef.value) {
          await nextTick()
          if (!boardRef.value) return
        }
        await handlePhase(newPhase)
      },
      { immediate: true }
    )

    // Board mount — handle mid-game join
    watch(boardRef, async (newRef) => {
      if (newRef && lastAnimatedPhase.value === null) {
        const phase = game.phase.value
        if (phase !== PresidentPhase.Setup) await handlePhase(phase)
      }
    })

    // Register animation callbacks — store awaits these before advancing turns
    game.setPlayAnimationCallback?.(async (play) => {
      isAnimating.value = true
      await animateCardPlay(play, play.playIndex)
      isAnimating.value = false
    })

    game.setPileClearedCallback?.(async () => {
      isAnimating.value = true
      await animatePileSweep()
      isAnimating.value = false
    })

    game.setExchangeAnimationCallback?.(async (exchanges) => {
      isAnimating.value = true
      await animateExchange(exchanges)
      isAnimating.value = false
    })

    // Player finish tracking
    watch(() => game.finishedPlayers.value.length, (newLen, oldLen) => {
      if (newLen > oldLen) {
        const lastFinished = game.finishedPlayers.value[newLen - 1]
        if (lastFinished !== undefined) {
          const seat = playerIdToSeatIndex(lastFinished)
          setPlayerStatus(seat, 'Out!')
        }
      }
    })
  }

  // ── Player status management ──────────────────────────────────────────

  const statusTimers: (ReturnType<typeof setTimeout> | null)[] = []

  function setPlayerStatus(seatIndex: number, message: string, autoExpireMs: number = 0) {
    while (statusTimers.length < playerCount.value) statusTimers.push(null)
    if (statusTimers[seatIndex]) clearTimeout(statusTimers[seatIndex]!)

    const updated = [...playerStatuses.value]
    updated[seatIndex] = message
    playerStatuses.value = updated

    if (message && autoExpireMs > 0) {
      statusTimers[seatIndex] = setTimeout(() => {
        const cleared = [...playerStatuses.value]
        cleared[seatIndex] = ''
        playerStatuses.value = cleared
      }, autoExpireMs)
    }
  }

  function clearPlayerStatuses() {
    playerStatuses.value = new Array(playerCount.value).fill('')
  }

  // ── Cleanup ──────────────────────────────────────────────────────────

  function cleanup() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    game.disableQueueMode?.()
    for (const timer of statusTimers) {
      if (timer) clearTimeout(timer)
    }
  }

  // ── Public API ────────────────────────────────────────────────────────

  return {
    playerNames,
    playerStatuses,
    currentTurnSeat,
    isAnimating,
    cleanup,
  }
}
