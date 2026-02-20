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
import { useCardController, cardControllerPresets } from '@/composables/useCardController'
import { CardScales } from '@/composables/useCardSizing'
import { computeTableLayout, type TableLayoutResult } from '@/composables/useTableLayout'
import type { CardPosition } from '@/components/cardContainers'
import { AnimationDurations, AnimationDelays, AnimationBuffers, sleep } from '@/utils/animationTimings'

// ── Animation timing ─────────────────────────────────────────────────────────

const DEAL_FLIGHT_MS = AnimationDurations.fast
const DEAL_STAGGER_MS = AnimationDelays.dealStagger
const CARD_PLAY_MS = AnimationDurations.slow
const PILE_SWEEP_MS = AnimationDurations.medium
const PILE_SWEEP_PAUSE_MS = AnimationDurations.slow

// ── Scale constants ──────────────────────────────────────────────────────────

const DECK_SCALE = 0.8
const PILE_CARD_SCALE = 1.0

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

  // ── Shared card controller ───────────────────────────────────────────────

  const cardController = useCardController(engine, boardRef, {
    layout: 'normal',
    playerCount: () => playerCount.value,
    userSeatIndex: 0,
    userHandScale: CardScales.userHand,
    opponentHandScale: CardScales.opponentHand, // Same 0.65 as other games
    userFanSpacing: 18,
    opponentFanSpacing: 10,
    ...cardControllerPresets.president,
    playerIdToSeatIndex: (id) => playerIdToSeatIndex(id),
  })

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
    // Use shared cardController for table setup
    cardController.setupTable()

    // Initialize statuses array
    playerStatuses.value = new Array(playerCount.value).fill('')

    // Adjust center pile scale for President (cards displayed larger)
    const centerPile = engine.getPiles().find(p => p.id === 'center')
    if (centerPile) {
      centerPile.scale = PILE_CARD_SCALE
    }
  }

  // ── Deal animation ────────────────────────────────────────────────────

  async function animateDeal() {
    if (!boardRef.value || isAnimating.value) return
    isAnimating.value = true

    const players = game.players.value

    // Build player views for cardController (map seat index to player data)
    const playerViews = Array.from({ length: playerCount.value }, (_, seatIdx) => {
      const player = players[seatIndexToPlayerId(seatIdx)]
      return { hand: player?.hand ?? [] }
    })

    // Use shared cardController for deal animation
    await cardController.dealFromPlayers(playerViews, {
      revealUserHand: true,
      focusUserHand: true,
      dealDelayMs: DEAL_STAGGER_MS,
      dealFlightMs: DEAL_FLIGHT_MS,
      fanDurationMs: AnimationDurations.medium,
      sortUserHand: sortHandByRank,
      sortAfterDeal: true,
    })

    engine.refreshCards()
    isAnimating.value = false

    // Signal the store that dealing visuals are done — game can now advance
    game.dealAnimationComplete()
  }

  // ── Sort user hand ────────────────────────────────────────────────────

  async function sortUserHand(duration: number = AnimationDurations.medium) {
    await cardController.sortUserHand(sortHandByRank, duration)
  }

  // ── Card exchange animation ──────────────────────────────────────────

  const EXCHANGE_MS = AnimationDurations.pause  // Slower for exchange cards

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
    const usedPlaceholderIndices = new Set<number>()

    const myId = game.humanPlayer.value?.id ?? -1
    console.log(`[PresidentDirector] animateCardPlayMP: playerId=${playerId}, myId=${myId}, seat=${seatIndex}, cards=${cards.map(c => c.id).join(',')}, handSize=${hand.cards.length}`)
    if (seatIndex === 0) {
      console.log(`[PresidentDirector] User play - engine hand cards:`, hand.cards.map(m => m.card.id))
    }

    for (const card of cards) {
      const hasCard = hand.cards.some(m => m.card.id === card.id)
      console.log(`[PresidentDirector] Looking for ${card.id}, found=${hasCard}`)
      if (hasCard) {
        cardIdsToMove.push(card.id)
      } else if (seatIndex === 0) {
        // User's card not found in engine hand - this shouldn't happen
        console.warn(`[PresidentDirector] User card ${card.id} NOT FOUND in engine hand!`, 
          'Engine has:', hand.cards.map(m => m.card.id))
        // Try to find by rank/suit instead of ID
        const byRankSuit = hand.cards.find(m => m.card.rank === card.rank && m.card.suit === card.suit)
        if (byRankSuit) {
          console.log(`[PresidentDirector] Found by rank/suit: ${byRankSuit.card.id}`)
          cardIdsToMove.push(byRankSuit.card.id)
        }
      } else if (hand.cards.length > 0) {
        // Opponent placeholder — find an unused placeholder from the end
        let placeholderIdx = hand.cards.length - 1
        while (placeholderIdx >= 0 && usedPlaceholderIndices.has(placeholderIdx)) {
          placeholderIdx--
        }
        if (placeholderIdx < 0) {
          console.warn('[PresidentDirector] No available placeholder for opponent card')
          continue
        }
        usedPlaceholderIndices.add(placeholderIdx)
        
        const managed = hand.cards[placeholderIdx]!
        const effectiveId = managed.card.id
        managed.card = { id: effectiveId, suit: card.suit, rank: card.rank }
        cardIdsToMove.push(effectiveId)
      }
    }
    
    // Refresh cards after all placeholders are updated
    if (cardIdsToMove.length > 0) {
      engine.refreshCards()
    }

    // Disable arc fan for user cards being played
    if (seatIndex === 0) {
      for (const id of cardIdsToMove) {
        engine.getCardRef(id)?.setArcFan(false)
      }
    }

    console.log(`[PresidentDirector] animateCardPlayMP: moving ${cardIdsToMove.length} cards to pile:`, cardIdsToMove)
    
    if (cardIdsToMove.length === 0) {
      console.warn(`[PresidentDirector] No cards to move! seat=${seatIndex}`)
      return
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

    // Brief pause to show the final state of the pile
    await sleep(PILE_SWEEP_PAUSE_MS)

    // Sweep all cards to generic off-screen position (bottom-right)
    const sweepPos = cardController.getGenericSweepPosition()

    await Promise.all(centerPile.cards.map(m => {
      const ref = engine.getCardRef(m.card.id)
      return ref?.moveTo({
        x: sweepPos.x,
        y: sweepPos.y,
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

      case PresidentPhase.CardExchange:
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

      case PresidentPhase.CardExchange:
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
        // During exchange phases, sync user hand with server state
        // (cards may be added/removed by exchange)
        const wasInExchange = oldPhase === PresidentPhase.CardExchange
        const isInExchange = newPhase === PresidentPhase.CardExchange
        if (wasInExchange || isInExchange) {
          const myHand = game.humanPlayer.value?.hand
          if (myHand && myHand.length > 0) {
            // Use slower animation for exchange (EXCHANGE_MS = 900ms)
            await cardController.syncUserHandWithState(myHand, sortHandByRank, undefined, EXCHANGE_MS)
            // Add pause after exchange animation so user can see their new cards
            if (wasInExchange && newPhase === PresidentPhase.Playing) {
              await sleep(1200)
            }
          }
        }
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
