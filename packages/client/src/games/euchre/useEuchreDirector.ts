/**
 * Euchre Director
 *
 * Watches the EuchreGameAdapter and translates game state changes into imperative
 * commands on the CardTableEngine. The adapter remains the source of truth
 * for game state; the director is purely a "state → animation" translator.
 */

import { watch, nextTick, computed, ref, type Ref } from 'vue'
import { GamePhase, getEffectiveSuit, getCardValue, isPlayerSittingOut } from '@67cards/shared'
import type { Card, Suit, ServerMessage } from '@67cards/shared'
import type { EuchreGameAdapter } from './useEuchreGameAdapter'
import type { CardTableEngine } from '@/composables/useCardTable'
import { useCardController, cardControllerPresets } from '@/composables/useCardController'
import { computeTableLayout, type TableLayoutResult } from '@/composables/useTableLayout'
import type { EngineCard, CardPosition } from '@/components/cardContainers'
import { AnimationDurations, AnimationDelays, AnimationBuffers, sleep } from '@/utils/animationTimings'

// ── Animation timing ─────────────────────────────────────────────────────────

const DEAL_FLIGHT_MS = AnimationDurations.medium
const DEAL_DELAY_MS = AnimationDelays.dealStagger
const CARD_PLAY_MS = AnimationDurations.medium
const TRICK_SWEEP_MS = AnimationDurations.medium
const TRICK_PAUSE_MS = AnimationDurations.longPause

// Short card label: "9♥", "A♣", "J♦", "K♠"
const SUIT_SYM: Record<string, string> = {
  hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660',
}
function cardLabel(card: Card): string {
  return `${card.rank}${SUIT_SYM[card.suit] ?? '?'}`
}

function logTrickResult(cards: Array<{ playerId: number; card: Card }>, winnerId: number, playerNames: string[]) {
  const plays = cards.map(c => `${playerNames[c.playerId] ?? 'P' + c.playerId}: ${cardLabel(c.card)}`).join(', ')
  const winnerName = playerNames[winnerId] ?? 'P' + winnerId
  console.log(`[Trick] ${plays} → ${winnerName} wins`)
}
const DECK_SLIDE_MS = AnimationDurations.slow
const CARD_FLIP_MS = AnimationDurations.medium
const DECK_EXIT_MS = AnimationDurations.slower
const DISCARD_MS = AnimationDurations.medium
const HAND_COLLAPSE_MS = AnimationDurations.slow
const HAND_COLLAPSE_SCALE = 0.05

// ── Scale constants ──────────────────────────────────────────────────────────

const CENTER_CARD_SCALE = 0.8   // deck, kitty stack in center
const TURN_UP_SCALE = 1.0       // turn-up card (flipped face-up)
const TRICK_PLAY_SCALE = 1.0    // cards played to center trick area
const TRICK_WON_SCALE = 0.5     // won trick stacks at table edge

// ── Suit display helpers ─────────────────────────────────────────────────────

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
}
const SUIT_COLORS: Record<string, string> = {
  hearts: '#e74c3c', diamonds: '#e74c3c', clubs: '#2c3e50', spades: '#2c3e50',
}
const SUIT_ORDER: Record<string, number> = {
  spades: 0, clubs: 1, diamonds: 2, hearts: 3,
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Sort cards for euchre hand display.
 * Trump cards first (right bower → left bower → A–9), then off-suits
 * grouped by suit, each high-to-low. Without trump: group by suit, high-to-low.
 */
function sortEuchreHand(cards: Card[], trump: Suit | null): Card[] {
  return [...cards].sort((a, b) => {
    if (trump) {
      const valA = getCardValue(a, trump, null)
      const valB = getCardValue(b, trump, null)
      const aIsTrump = valA >= 50
      const bIsTrump = valB >= 50
      if (aIsTrump && !bIsTrump) return -1
      if (!aIsTrump && bIsTrump) return 1
      if (aIsTrump && bIsTrump) return valB - valA
      const suitA = getEffectiveSuit(a, trump)
      const suitB = getEffectiveSuit(b, trump)
      if (suitA !== suitB) return (SUIT_ORDER[suitA] ?? 0) - (SUIT_ORDER[suitB] ?? 0)
      return valB - valA
    }
    if (a.suit !== b.suit) return (SUIT_ORDER[a.suit] ?? 0) - (SUIT_ORDER[b.suit] ?? 0)
    return getCardValue(b, b.suit, null) - getCardValue(a, a.suit, null)
  })
}

function cardToEngineCard(card: Card): EngineCard {
  return { id: card.id, suit: card.suit, rank: card.rank }
}

// ── Director ─────────────────────────────────────────────────────────────────

export interface EuchreDirectorOptions {
  boardRef: Ref<HTMLElement | null>
  layout?: 'normal' | 'wide'
}

export function useEuchreDirector(
  game: EuchreGameAdapter,
  engine: CardTableEngine,
  options: EuchreDirectorOptions
) {
  const { boardRef } = options
  const layout = options.layout ?? 'normal'

  // Animation dedup state
  const lastAnimatedTrickCardCount = ref(0)
  const lastAnimatedPhase = ref<GamePhase | null>(null)
  const isAnimating = ref(false)

  // Track tricks won per player
  const tricksWonByPlayer = ref<Record<number, number>>({ 0: 0, 1: 0, 2: 0, 3: 0 })

  // Player status messages (bid actions, etc.) keyed by seat index
  const playerStatuses = ref<string[]>(['', '', '', ''])

  // Seat index of partner who is sitting out (when someone else goes alone)
  const alonePartnerSeat = ref<number | null>(null)

  // MP queue processing state
  let pendingTrickWinnerId: number | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let processingActive = false

  // ── Computed state for CardTable props ───────────────────────────────────

  // Map by seat index (not server player ID) so names/info align with the UI.
  // Seat 0 = user (bottom), 1 = left, 2 = top (partner), 3 = right.
  const playerNames = computed(() =>
    [0, 1, 2, 3].map(seat => {
      const pid = seatIndexToPlayerId(seat)
      return game.players.value[pid]?.name ?? `Player ${pid}`
    })
  )

  const playerInfo = computed(() =>
    [0, 1, 2, 3].map(seat => {
      const pid = seatIndexToPlayerId(seat)
      const trump = game.trump.value
      const isCaller = trump && trump.calledBy === pid
      return {
        dealer: game.dealer.value === pid,
        currentTurn: game.currentPlayer.value === pid,
        trumpSymbol: isCaller ? SUIT_SYMBOLS[trump.suit] : undefined,
        trumpColor: isCaller ? SUIT_COLORS[trump.suit] : undefined,
        tricksWon: game.tricksWonByPlayer.value[pid] ?? 0,
        goingAlone: trump?.goingAlone && trump?.calledBy === pid,
      }
    })
  )

  const dealerSeat = computed(() => {
    const d = game.dealer.value
    return d >= 0 ? playerIdToSeatIndex(d) : -1
  })

  const currentTurnSeat = computed(() => {
    // During DealerDiscard, only show turn indicator if human is dealer
    // (AI dealer swaps happen automatically - nobody's turn during that animation)
    if (game.phase.value === GamePhase.DealerDiscard) {
      return dealerSeat.value === 0 ? 0 : -1
    }
    const cp = game.currentPlayer.value
    return cp >= 0 ? playerIdToSeatIndex(cp) : -1
  })

  const validCardIds = computed(() => new Set(game.validPlays.value))

  // ── Seat ↔ player mapping ───────────────────────────────────────────────

  function playerIdToSeatIndex(playerId: number): number {
    const myId = game.myPlayerId.value
    return (playerId - myId + 4) % 4
  }

  function seatIndexToPlayerId(seatIndex: number): number {
    const myId = game.myPlayerId.value
    return (seatIndex + myId) % 4
  }

  // ── Shared card controller ──────────────────────────────────────────────

  const cardController = useCardController(engine, boardRef, {
    layout: 'normal',
    playerCount: 4,
    userSeatIndex: 0,
    playerIdToSeatIndex,
    userHandScale: 1.6,
    opponentHandScale: 0.7,
    userFanSpacing: 30,
    opponentFanSpacing: 16,
    playMoveMs: CARD_PLAY_MS,
    ...cardControllerPresets.euchre,
  })

  // ── Layout helpers ──────────────────────────────────────────────────────

  function getTableLayout(): TableLayoutResult | null {
    if (!boardRef.value) return null
    return computeTableLayout(boardRef.value.offsetWidth, boardRef.value.offsetHeight, layout, 4)
  }

  function getDealerDeckPosition(dealerSeatIndex: number, tl: TableLayoutResult): { x: number; y: number } {
    const seat = tl.seats[dealerSeatIndex]
    if (!seat) return tl.tableCenter
    const { tableBounds } = tl
    const off = 70
    switch (seat.side) {
      case 'bottom': return { x: tableBounds.centerX - off, y: tableBounds.bottom + 25 }
      case 'left':   return { x: tableBounds.left - 25,      y: tableBounds.centerY - off }
      case 'top':    return { x: tableBounds.centerX + off,   y: tableBounds.top - 25 }
      case 'right':  return { x: tableBounds.right + 25,      y: tableBounds.centerY + off }
      default:       return tl.tableCenter
    }
  }

  function getDeckOffscreenPosition(dealerSeatIndex: number, tl: TableLayoutResult): { x: number; y: number } {
    const seat = tl.seats[dealerSeatIndex]
    if (!seat) return { x: -200, y: -200 }
    const { tableBounds } = tl
    const off = 300
    switch (seat.side) {
      case 'bottom': return { x: tableBounds.centerX, y: tableBounds.bottom + off }
      case 'left':   return { x: tableBounds.left - off,   y: tableBounds.centerY }
      case 'top':    return { x: tableBounds.centerX, y: tableBounds.top - off }
      case 'right':  return { x: tableBounds.right + off,  y: tableBounds.centerY }
      default:       return { x: -200, y: -200 }
    }
  }

  /** Center-cross position for a trick card. */
  function getTrickCardPosition(playerId: number, tableCenter: { x: number; y: number }, cardIndex: number): CardPosition {
    const seatIndex = playerIdToSeatIndex(playerId)
    const d = 45
    const offsets: Record<number, { x: number; y: number; rotation: number }> = {
      0: { x: 0, y: d, rotation: 0 },
      1: { x: -d, y: 0, rotation: -8 },
      2: { x: 0, y: -d, rotation: 0 },
      3: { x: d, y: 0, rotation: 8 },
    }
    const o = offsets[seatIndex] ?? offsets[0]!
    return {
      x: tableCenter.x + o.x,
      y: tableCenter.y + o.y,
      rotation: o.rotation,
      zIndex: 500 + cardIndex,
      scale: TRICK_PLAY_SCALE,
    }
  }

  /**
   * Position for a won-trick stack in front of a player's avatar.
   * Vertical orientation (portrait cards) for top/bottom seats,
   * horizontal orientation (landscape cards) for left/right seats.
   * Successive tricks spread along the table edge away from center.
   */
  function getPlayerTrickPosition(
    playerId: number,
    trickNumber: number,
    cardIndex: number,
    tl: TableLayoutResult
  ): CardPosition {
    const seat = playerIdToSeatIndex(playerId)
    const { tableBounds } = tl
    const inset = 20  // how far inside the table edge
    const gap = 12    // spacing between successive tricks
    let x: number, y: number, rotation: number

    switch (seat) {
      case 0: // bottom (user) — left of player (table left), near bottom edge, spread left
        x = tableBounds.centerX - 60 - trickNumber * gap
        y = tableBounds.bottom - inset
        rotation = 0
        break
      case 1: // left — left of player (upward), spread upward
        x = tableBounds.left + inset
        y = tableBounds.centerY - 40 - trickNumber * gap
        rotation = 90
        break
      case 2: // top — left of player (table right from their perspective), near top edge, spread right
        x = tableBounds.centerX + 60 + trickNumber * gap
        y = tableBounds.top + inset
        rotation = 0
        break
      case 3: // right — left of player (downward), spread downward
        x = tableBounds.right - inset
        y = tableBounds.centerY + 40 + trickNumber * gap
        rotation = 90
        break
      default:
        x = tl.tableCenter.x
        y = tl.tableCenter.y
        rotation = 0
    }

    return {
      x,
      y: y - cardIndex * 0.6,
      rotation,
      zIndex: 50 + trickNumber * 4 + cardIndex,
      scale: TRICK_WON_SCALE,
      flipY: 0,
    }
  }

  // ── Animation gate ──────────────────────────────────────────────────────

  /** Wait until isAnimating becomes false (polls every 50ms). */
  async function waitForAnimations(): Promise<void> {
    while (isAnimating.value) {
      await sleep(AnimationDelays.shortDelay)
    }
  }

  // ── Hide opponent hands ────────────────────────────────────────────────

  /** Avatar position in board coordinates for a given seat (normal 4-player layout). */
  function getAvatarBoardPosition(seatIndex: number, tl: TableLayoutResult): { x: number; y: number } {
    const { tableBounds } = tl
    switch (seatIndex) {
      case 1: return { x: tableBounds.left - 40, y: tableBounds.centerY }
      case 2: return { x: tableBounds.centerX, y: tableBounds.top - 30 }
      case 3: return { x: tableBounds.right + 40, y: tableBounds.centerY }
      default: return tl.tableCenter
    }
  }

  /** Hide opponent hands - delegates to shared card controller */
  async function hideOpponentHands() {
    await cardController.hideOpponentHands()
  }

  /**
   * Handle alone visuals: if someone is going alone, dim the sitting-out
   * player's avatar (or animate the user's hand offscreen if user sits out).
   * Uses the same isPlayerSittingOut() logic that the turn-skipping uses.
   */
  async function handleAloneVisuals(trumpCallInfo: { calledBy: number; goingAlone: boolean }) {
    if (!trumpCallInfo.goingAlone) return

    const alonePlayerId = trumpCallInfo.calledBy
    const sittingOutPid = (alonePlayerId + 2) % 4
    const seat = playerIdToSeatIndex(sittingOutPid)

    if (seat === 0) {
      // User sits out — animate hand off the bottom of the screen
      const userHand = engine.getHands()[0]
      if (userHand && boardRef.value) {
        const offscreenY = boardRef.value.offsetHeight + 100
        const promises: Promise<void>[] = []
        for (const m of userHand.cards) {
          const cardRef = engine.getCardRef(m.card.id)
          if (cardRef) {
            const cur = cardRef.getPosition()
            promises.push(cardRef.moveTo({ ...cur, y: offscreenY, zIndex: 1 }, HAND_COLLAPSE_MS))
          }
        }
        await Promise.all(promises)
      }
    } else {
      // Opponent sits out — dim their avatar
      alonePartnerSeat.value = seat
    }
  }

  // ── Setup ───────────────────────────────────────────────────────────────

  /** Reset Euchre-specific game state (called at start of each round) */
  function resetGameState() {
    tricksWonByPlayer.value = { 0: 0, 1: 0, 2: 0, 3: 0 }
    alonePartnerSeat.value = null
  }

  /** Setup table using shared card controller */
  function setupTable() {
    const dealerIdx = dealerSeat.value >= 0 ? dealerSeat.value : 0
    cardController.setupTable(dealerIdx)
    resetGameState()
  }

  // ── Deal animation ──────────────────────────────────────────────────────

  async function animateDeal() {
    if (!boardRef.value || isAnimating.value) return
    isAnimating.value = true

    // Build player hands for dealing (cast to satisfy StandardCard type)
    const players = game.players.value
    const dealPlayers = [0, 1, 2, 3].map(seatIdx => {
      const playerId = seatIndexToPlayerId(seatIdx)
      const player = players[playerId]
      return {
        hand: (player?.hand.map(c => cardToEngineCard(c)) ?? []) as any[],
      }
    })

    // Build kitty cards (3 placeholders + turn-up)
    const turnUpCard = game.turnUpCard.value
    const kittyCards = [
      { id: 'kitty-0', suit: '', rank: '' },
      { id: 'kitty-1', suit: '', rank: '' },
      { id: 'kitty-2', suit: '', rank: '' },
      ...(turnUpCard ? [cardToEngineCard(turnUpCard)] : []),
    ] as any[]

    // Use shared deal with kitty options
    await cardController.dealFromPlayers(dealPlayers, {
      dealDelayMs: DEAL_DELAY_MS,
      dealFlightMs: DEAL_FLIGHT_MS,
      fanDurationMs: AnimationDurations.medium,
      dealerSeatIndex: dealerSeat.value,
      revealUserHand: true,
      focusUserHand: true,
      extraDeckCards: kittyCards,
      keepRemainingCards: true,
      flipTopCard: true,
      flipTopCardId: turnUpCard?.id,
    })

    // Sort user hand
    await sortUserHand(AnimationDurations.medium)

    engine.refreshCards()
    isAnimating.value = false
  }

  // ── Sort user hand ──────────────────────────────────────────────────────

  async function sortUserHand(duration: number = AnimationDurations.medium) {
    const trump = game.trump.value?.suit ?? null
    // Cast to any to bridge Euchre Card type and StandardCard
    const sorter = (cards: Card[]) => sortEuchreHand(cards, trump)
    await cardController.sortUserHand(sorter as any, duration)
  }

  // ── Deck animations ─────────────────────────────────────────────────────

  async function animateDeckOffscreen() {
    const deck = engine.getDeck()
    if (!deck || deck.cards.length === 0) return
    const tl = getTableLayout()
    if (!tl) return

    const dealerIdx = dealerSeat.value >= 0 ? dealerSeat.value : 0
    const offPos = getDeckOffscreenPosition(dealerIdx, tl)

    await Promise.all(deck.cards.map(m => {
      const ref = engine.getCardRef(m.card.id)
      return ref?.moveTo({ x: offPos.x, y: offPos.y, rotation: 0, zIndex: 50, scale: 1.0 }, DECK_EXIT_MS)
    }))

    deck.cards = []
    engine.refreshCards()
  }

  async function flipTurnUpFaceDown() {
    const deck = engine.getDeck()
    const turnUpCard = game.turnUpCard.value
    if (!deck || deck.cards.length === 0 || !turnUpCard) return

    const topCard = deck.cards.find(m => m.card.id === turnUpCard.id)
    if (!topCard) return

    const ref = engine.getCardRef(topCard.card.id)
    if (ref) {
      await ref.moveTo({ ...ref.getPosition(), flipY: 0 }, CARD_FLIP_MS)
    }
  }

  // ── Order-up: turn-up → dealer hand ─────────────────────────────────────

  async function animateTurnUpToDealer(dealerSeatIdx: number) {
    const deck = engine.getDeck()
    const turnUpCard = game.turnUpCard.value
    if (!deck || deck.cards.length === 0 || !turnUpCard) return

    const dealerHand = engine.getHands()[dealerSeatIdx]
    if (!dealerHand) return

    const cardId = turnUpCard.id
    const isUser = dealerSeatIdx === 0

    const targetIdx = dealerHand.cards.length
    const targetPos: CardPosition = {
      ...dealerHand.getCardPosition(targetIdx),
      flipY: isUser ? 180 : 0,
    }

    await engine.moveCard(cardId, deck, dealerHand, targetPos, 400)
    await deck.repositionAll(0)
    await dealerHand.setMode('fanned', AnimationDurations.medium)
  }

  // ── Dealer discard ──────────────────────────────────────────────────────

  async function handleDealerDiscard(cardId: string) {
    isAnimating.value = true

    const deck = engine.getDeck()
    const userHand = engine.getHands()[0]
    if (!userHand || !deck) { isAnimating.value = false; return }

    const cardRef = engine.getCardRef(cardId)
    const managed = userHand.removeCard(cardId)
    if (!managed) { isAnimating.value = false; return }

    managed.faceUp = false
    deck.cards.push(managed)
    engine.refreshCards()

    const deckPos = deck.getCardPosition(deck.cards.length - 1)
    await Promise.all([
      cardRef?.moveTo({ ...deckPos, flipY: 0, scale: 1.0, zIndex: 1000 }, DISCARD_MS),
      userHand.setMode('fanned', AnimationDurations.medium),
    ])

    game.discardCard(cardId)

    await sleep(AnimationDurations.medium + AnimationBuffers.settle)
    await Promise.all([animateDeckOffscreen(), hideOpponentHands()])

    const currentTrumpInfo = game.trump.value
    if (currentTrumpInfo) await handleAloneVisuals(currentTrumpInfo)

    isAnimating.value = false
  }

  function findAIDiscardedCard(seatIdx: number): string | null {
    const hand = engine.getHands()[seatIdx]
    if (!hand) return null

    // In multiplayer, opponents have placeholder cards — return the last placeholder
    // (not the turn-up card which may have been added to the end via order-up)
    if (seatIdx !== 0 && hand.cards.length > 0 && hand.cards[0]?.card.id.startsWith('placeholder-')) {
      for (let j = hand.cards.length - 1; j >= 0; j--) {
        if (hand.cards[j]!.card.id.startsWith('placeholder-')) {
          return hand.cards[j]!.card.id
        }
      }
      return null
    }

    const gamePlayer = game.players.value[seatIndexToPlayerId(seatIdx)]
    if (!gamePlayer) return null

    const gameCardIds = new Set(gamePlayer.hand.map(c => c.id))
    return hand.cards.find(m => !gameCardIds.has(m.card.id))?.card.id ?? null
  }

  /** Animate card play - delegates to shared card controller */
  async function animateCardPlay(card: { id: string; suit: string; rank: string }, playerId: number) {
    const trickPile = engine.getPiles().find(p => p.id === 'center')
    const cardIndex = trickPile?.cards.length ?? 0
    // Cast to StandardCard - the suit/rank string values match the enum values
    await cardController.playCard(card as any, playerId, cardIndex)
  }

  // ── Trick sweep → won-trick stacks ──────────────────────────────────────

  /** Animate trick sweep - delegates to shared card controller */
  async function animateTrickSweep(winnerId: number) {
    await cardController.completeTrick(winnerId)
  }

  // ── Round-end: sweep trick piles off table ─────────────────────────────

  async function animateTrickPilesSweepOff(nextDealerSeat: number) {
    const tl = getTableLayout()
    if (!tl) return

    const playerPiles = [0, 1, 2, 3].map(pid => engine.getPiles().find(p => p.id === `tricks-won-player-${pid}`))
    const allCards = playerPiles.flatMap(pile => pile?.cards ?? [])
    if (allCards.length === 0) return

    // Determine off-screen target based on next dealer's side
    const seat = tl.seats[nextDealerSeat]
    if (!boardRef.value) return
    const boardW = boardRef.value.offsetWidth
    const boardH = boardRef.value.offsetHeight

    let targetX: number, targetY: number
    switch (seat?.side ?? 'bottom') {
      case 'bottom': targetX = tl.tableCenter.x; targetY = boardH + 100; break
      case 'top':    targetX = tl.tableCenter.x; targetY = -100; break
      case 'left':   targetX = -100; targetY = tl.tableCenter.y; break
      case 'right':  targetX = boardW + 100; targetY = tl.tableCenter.y; break
      default:       targetX = tl.tableCenter.x; targetY = boardH + 100; break
    }

    await Promise.all(allCards.map((m, i) => {
      const ref = engine.getCardRef(m.card.id)
      if (!ref) return Promise.resolve()
      return ref.moveTo({
        x: targetX,
        y: targetY,
        rotation: ref.getPosition().rotation + 90,
        zIndex: 10 + i,
        scale: TRICK_WON_SCALE,
      }, 500)
    }))
  }

  // ── Phase handler ───────────────────────────────────────────────────────

  async function handlePhase(newPhase: GamePhase, oldPhase: GamePhase | null) {
    if (newPhase === lastAnimatedPhase.value) return
    
    // For Dealing phase, don't mark as animated until boardRef is available
    // This allows the boardRef watcher to retry when the ref becomes available
    if (newPhase === GamePhase.Dealing && !boardRef.value) {
      return  // Will be retried by boardRef watcher
    }
    
    lastAnimatedPhase.value = newPhase

    switch (newPhase) {
      case GamePhase.Dealing: {
        // Sweep existing trick piles off-screen before resetting
        const nextDealer = dealerSeat.value
        await animateTrickPilesSweepOff(nextDealer)
        clearPlayerStatuses()
        setupTable()
        await nextTick()
        await animateDeal()
        break
      }

      case GamePhase.BiddingRound2:
        await flipTurnUpFaceDown()
        break

      case GamePhase.TrickComplete: {
        // Log trick result for SP
        const trickCards = game.currentTrick.value.cards
        const trickWinner = game.currentTrick.value.winnerId
        if (trickCards.length > 0 && trickWinner !== null) {
          logTrickResult(trickCards, trickWinner, game.players.value.map(p => p.name))
        }
        // Note: Trick sweep animation is now handled by trickCompleteCallback
        // (registered in SP mode). Don't animate here to avoid double-sweep race.
        lastAnimatedTrickCardCount.value = 0
        break
      }

      case GamePhase.RoundComplete:
        lastAnimatedTrickCardCount.value = 0
        break

      case GamePhase.Playing:
        if (oldPhase === GamePhase.TrickComplete || oldPhase === GamePhase.DealerDiscard) {
          lastAnimatedTrickCardCount.value = 0
        }
        if (oldPhase === GamePhase.BiddingRound1 || oldPhase === GamePhase.BiddingRound2 || oldPhase === GamePhase.DealerDiscard) {
          clearPlayerStatuses()
        }
        break
    }
  }

  // ── Bid message formatting (MP) ─────────────────────────────────────────

  function formatBidForDisplay(action: string, suit?: string, goingAlone?: boolean): string {
    const alone = goingAlone ? ' (Alone)' : ''
    switch (action) {
      case 'pass': return 'Pass'
      case 'order_up': return `Order Up${alone}`
      case 'pick_up': return `Pick Up${alone}`
      case 'call_trump':
        if (suit) {
          const suitName = suit.charAt(0).toUpperCase() + suit.slice(1)
          return `${suitName}${alone}`
        }
        return `Call Trump${alone}`
      default: return action
    }
  }

  // ── Multiplayer: trump-called handler ─────────────────────────────────

  async function handleTrumpCalledMP() {
    const currentTrumpInfo = game.trump.value
    if (!currentTrumpInfo) return

    const turnUp = game.turnUpCard.value
    const isOrderUp = turnUp && currentTrumpInfo.suit === turnUp.suit
    const dealerSeatIdx = dealerSeat.value
    const isDealerUser = dealerSeatIdx === 0
    const dealerPlayerId = seatIndexToPlayerId(dealerSeatIdx)
    const dealerSitsOut = isPlayerSittingOut(dealerPlayerId, currentTrumpInfo.goingAlone ? currentTrumpInfo.calledBy : null)

    if (isOrderUp && !dealerSitsOut) {
      // Normal order-up: dealer exchanges a card
      await animateTurnUpToDealer(dealerSeatIdx)

      if (isDealerUser) {
        await sortUserHand(AnimationDurations.medium)
        // User still needs to discard — processing loop continues,
        // your_turn message will arrive next to enable the UI
      } else {
        const discardedId = findAIDiscardedCard(dealerSeatIdx)
        const dealerHand = engine.getHands()[dealerSeatIdx]
        const deck = engine.getDeck()

        if (discardedId && dealerHand && deck) {
          const deckTargetPos: CardPosition = {
            ...deck.getCardPosition(deck.cards.length),
            zIndex: 1000,
          }
          await engine.moveCard(discardedId, dealerHand, deck, deckTargetPos, DISCARD_MS)
          await dealerHand.setMode('fanned', AnimationDurations.fast)
        }

        await sleep(AnimationDurations.medium + AnimationBuffers.settle)
        await Promise.all([sortUserHand(AnimationDurations.medium), animateDeckOffscreen()])
        await hideOpponentHands()
      }
    } else {
      // Round 2 call, or dealer's partner going alone — just sweep deck
      await Promise.all([sortUserHand(AnimationDurations.medium), animateDeckOffscreen()])
      await hideOpponentHands()
    }

    await handleAloneVisuals(currentTrumpInfo)
  }

  // ── Multiplayer: phase transition handler ─────────────────────────────

  async function handlePhaseTransitionMP(newPhase: GamePhase, oldPhase: GamePhase) {
    if (newPhase === lastAnimatedPhase.value) return
    
    // For Dealing phase, don't mark as animated until boardRef is available
    // This allows the boardRef watcher to retry when the ref becomes available
    if (newPhase === GamePhase.Dealing && !boardRef.value) {
      return  // Will be retried by boardRef watcher
    }
    
    lastAnimatedPhase.value = newPhase

    switch (newPhase) {
      case GamePhase.Dealing: {
        const nextDealer = dealerSeat.value
        await animateTrickPilesSweepOff(nextDealer)
        clearPlayerStatuses()
        setupTable()
        await nextTick()
        await animateDeal()
        break
      }

      case GamePhase.BiddingRound2:
        await flipTurnUpFaceDown()
        break

      case GamePhase.DealerDiscard: {
        // Order-up: animate turn-up card to dealer's hand.
        // Don't sweep the deck yet — the dealer still needs to discard.
        isAnimating.value = true
        try {
          await animateTurnUpToDealer(dealerSeat.value)
          if (dealerSeat.value === 0) {
            // Local user is dealer — sort hand so they can pick a discard
            await sortUserHand(AnimationDurations.medium)
          }
        } finally {
          isAnimating.value = false
        }
        break
      }

      case GamePhase.Playing: {
        if (oldPhase === GamePhase.DealerDiscard) {
          // Dealer finished discarding — sweep deck and hide opponent hands.
          // For local user dealer, handleDealerDiscard() already did the animation.
          if (dealerSeat.value === 0) {
            // Local user already animated everything via handleDealerDiscard()
          } else {
            // Remote dealer discarded — animate discard card + deck exit + hide
            isAnimating.value = true
            try {
              const discardedId = findAIDiscardedCard(dealerSeat.value)
              const dealerHand = engine.getHands()[dealerSeat.value]
              const deck = engine.getDeck()

              if (discardedId && dealerHand && deck) {
                const deckTargetPos: CardPosition = {
                  ...deck.getCardPosition(deck.cards.length),
                  zIndex: 1000,
                }
                await engine.moveCard(discardedId, dealerHand, deck, deckTargetPos, DISCARD_MS)
                await dealerHand.setMode('fanned', AnimationDurations.fast)
              }
              await sleep(AnimationDurations.medium + AnimationBuffers.settle)
              await Promise.all([sortUserHand(AnimationDurations.medium), animateDeckOffscreen()])
              await hideOpponentHands()
              const currentTrumpInfo = game.trump.value
              if (currentTrumpInfo) await handleAloneVisuals(currentTrumpInfo)
            } finally {
              isAnimating.value = false
            }
          }
          clearPlayerStatuses()
        } else if (oldPhase === GamePhase.BiddingRound1 || oldPhase === GamePhase.BiddingRound2) {
          // Trump called — server skipped DealerDiscard (AI dealer auto-discarded)
          // or it was a round 2 call (no pickup needed)
          isAnimating.value = true
          try {
            await handleTrumpCalledMP()
          } finally {
            isAnimating.value = false
          }
          clearPlayerStatuses()
        } else if (oldPhase === GamePhase.TrickComplete) {
          // Trick sweep — server already paused before sending Playing state,
          // so no additional TRICK_PAUSE_MS needed
          isAnimating.value = true
          try {
            if (pendingTrickWinnerId !== null) {
              await animateTrickSweep(pendingTrickWinnerId)
              pendingTrickWinnerId = null
            }
          } finally {
            isAnimating.value = false
          }
          lastAnimatedTrickCardCount.value = 0
        }
        break
      }

      case GamePhase.TrickComplete:
        // 4th card was already animated via card_played message — no action needed
        break

      case GamePhase.RoundComplete: {
        // Final trick sweep — server already paused before sending RoundComplete
        isAnimating.value = true
        try {
          if (pendingTrickWinnerId !== null) {
            await animateTrickSweep(pendingTrickWinnerId)
            pendingTrickWinnerId = null
          }
        } finally {
          isAnimating.value = false
        }
        lastAnimatedTrickCardCount.value = 0
        break
      }
    }
  }

  // ── Multiplayer: sequential message processing loop ───────────────────

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
      console.error('[EuchreDirector] Error processing message queue:', err)
    } finally {
      processingActive = false
    }
  }

  async function processOneMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'card_played': {
        const names = game.players.value.map(p => p.name)
        console.log(`[CardPlayed] ${names[msg.playerId] ?? 'P' + msg.playerId}: ${cardLabel(msg.card)} (id: ${msg.card.id})`)
        isAnimating.value = true
        try {
          await animateCardPlay(msg.card, msg.playerId)
          lastAnimatedTrickCardCount.value++
        } finally {
          isAnimating.value = false
        }
        // Apply AFTER animation so the trick visuals stay consistent
        game.applyMessage!(msg)
        break
      }

      case 'trick_complete': {
        // Store winner for sweep animation (triggered on phase change)
        pendingTrickWinnerId = msg.winnerId
        logTrickResult(msg.cards, msg.winnerId, game.players.value.map(p => p.name))
        game.applyMessage!(msg)
        break
      }

      case 'bid_made': {
        // Show bid status on avatar, then apply to store
        const bidSeatIdx = playerIdToSeatIndex(msg.playerId)
        setPlayerStatus(
          bidSeatIdx,
          formatBidForDisplay(msg.action, msg.suit, msg.goingAlone),
        )
        game.applyMessage!(msg)

        // Pause after non-user bids so the avatar highlight and bid status
        // are visible to the player (especially when queued during deal animation)
        if (bidSeatIdx !== 0) {
          await sleep(AnimationDurations.pause)
        }
        break
      }

      case 'game_state': {
        const oldPhase = game.phase.value
        game.applyMessage!(msg)
        const newPhase = msg.state.phase as GamePhase
        if (newPhase !== oldPhase) {
          await handlePhaseTransitionMP(newPhase, oldPhase)
        }
        break
      }

      case 'your_turn': {
        // Processed AFTER all prior animations complete — turn indicators are correct
        game.applyMessage!(msg)
        break
      }

      default:
        // round_complete, game_over, player_timed_out, etc.
        game.applyMessage!(msg)
        break
    }
  }

  // ── Watchers / MP setup ───────────────────────────────────────────────

  const statusTimers: (ReturnType<typeof setTimeout> | null)[] = [null, null, null, null]

  if (game.isMultiplayer) {
    // ── Multiplayer: queue-based processing ──
    game.enableQueueMode?.()
    pollTimer = setInterval(processMessageQueue, 16)

    // Handle boardRef becoming available (component mount)
    watch(boardRef, async (newRef) => {
      if (!newRef) return
      // If state already exists (e.g., messages arrived before mount), catch up
      const phase = game.phase.value
      if (phase !== GamePhase.Setup && lastAnimatedPhase.value === null) {
        setupTable()
        await nextTick()
        if (phase === GamePhase.Dealing) {
          await animateDeal()
        }
        lastAnimatedPhase.value = phase
      }
    })
  } else {
    // ── Singleplayer: callback-based animation ──
    // Store awaits these callbacks before advancing turns, ensuring
    // animations complete before the next player acts.

    game.setPlayAnimationCallback?.(async ({ card, playerId }) => {
      await waitForAnimations()
      isAnimating.value = true
      try {
        await animateCardPlay(card, playerId)
      } finally {
        isAnimating.value = false
      }
    })

    game.setTrickCompleteCallback?.(async (winnerId) => {
      await waitForAnimations()
      isAnimating.value = true
      try {
        await animateTrickSweep(winnerId)
      } finally {
        isAnimating.value = false
      }
    })

    watch(() => game.phase.value, (newPhase, oldPhase) => {
      handlePhase(newPhase, oldPhase)
    })

    watch(boardRef, (newRef) => {
      if (newRef) {
        const phase = game.phase.value
        // Retry phase handling if current phase hasn't been animated yet
        if (phase !== GamePhase.Setup && phase !== lastAnimatedPhase.value) {
          handlePhase(phase, null)
        }
      }
    })

    // Trump called → order-up flow or round-2 flow
    watch(() => game.trump.value, async (newTrump) => {
      if (!newTrump) return

      await waitForAnimations()
      isAnimating.value = true

      let keepAnimating = false

      try {
        const turnUp = game.turnUpCard.value
        const isOrderUp = turnUp && newTrump.suit === turnUp.suit
        const dealerSeatIdx = dealerSeat.value
        const isDealerUser = dealerSeatIdx === 0
        const dealerPlayerId = seatIndexToPlayerId(dealerSeatIdx)
        const dealerSitsOut = isPlayerSittingOut(dealerPlayerId, newTrump.goingAlone ? newTrump.calledBy : null)

        if (isOrderUp && !dealerSitsOut) {
          // Normal order-up: dealer exchanges a card
          await animateTurnUpToDealer(dealerSeatIdx)

          if (isDealerUser) {
            await sortUserHand(AnimationDurations.medium)
            // Don't keep animating - let user see discard prompt
            // User's discard action (handleDealerDiscard) will continue the flow
          } else {
            const discardedId = findAIDiscardedCard(dealerSeatIdx)
            const dealerHand = engine.getHands()[dealerSeatIdx]
            const deck = engine.getDeck()

            if (discardedId && dealerHand && deck) {
              const deckTargetPos: CardPosition = {
                ...deck.getCardPosition(deck.cards.length),
                zIndex: 1000,
              }
              await engine.moveCard(discardedId, dealerHand, deck, deckTargetPos, DISCARD_MS)
              await dealerHand.setMode('fanned', AnimationDurations.fast)
            }

            await sleep(AnimationDurations.medium + AnimationBuffers.settle)
            await Promise.all([sortUserHand(AnimationDurations.medium), animateDeckOffscreen()])
            await hideOpponentHands()
          }
        } else {
          // Round 2 call, or dealer's partner going alone — just sweep deck
          await Promise.all([sortUserHand(AnimationDurations.medium), animateDeckOffscreen()])
          await hideOpponentHands()
        }

        await handleAloneVisuals(newTrump)
      } finally {
        if (!keepAnimating) isAnimating.value = false
      }
    })

    // Note: Card play animations are now handled via setPlayAnimationCallback
    // The store awaits the callback before advancing turns, so we don't need
    // to watch trick card count changes here.

    // Reset trick card count when trick clears (for any legacy tracking)
    watch(() => game.currentTrick.value.cards.length, (newCount) => {
      if (newCount === 0) { lastAnimatedTrickCardCount.value = 0 }
    })

    // Bid actions → avatar status labels
    watch(() => game.lastBidAction.value, (action) => {
      if (!action) return
      setPlayerStatus(playerIdToSeatIndex(action.playerId), action.message)
    })
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

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

  // ── Public API ──────────────────────────────────────────────────────────

  function setPlayerStatus(seatIndex: number, message: string) {
    if (statusTimers[seatIndex]) clearTimeout(statusTimers[seatIndex]!)
    playerStatuses.value[seatIndex] = message
    if (message) {
      statusTimers[seatIndex] = setTimeout(() => {
        playerStatuses.value[seatIndex] = ''
      }, 2000)
    }
  }

  function clearPlayerStatuses() {
    playerStatuses.value = ['', '', '', '']
  }

  return {
    playerNames,
    playerInfo,
    playerStatuses,
    dealerSeat,
    currentTurnSeat,
    validCardIds,
    isAnimating,
    alonePartnerSeat,
    setupTable,
    setPlayerStatus,
    clearPlayerStatuses,
    handleDealerDiscard,
    hideOpponentHands,
    cleanup,
  }
}
