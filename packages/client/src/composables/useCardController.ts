/**
 * Shared Card Controller
 * 
 * Provides unified card animation methods used across all games.
 * Games should use these methods rather than implementing their own.
 * 
 * Unified methods (used by all games):
 * - setupTable() - initializes table layout, deck, hands, piles
 * - dealFromPlayers() - deals cards from deck to hands
 *   - extraDeckCards: add extra cards to deck (e.g., kitty)
 *   - keepRemainingCards: keep remaining deck on table after dealing
 *   - flipTopCard: flip top remaining card face-up (e.g., turn-up)
 * - revealUserHand() - flips user's cards face-up
 * - sortUserHand() - sorts user's hand with custom sorter
 * - playCard() - animates playing a card to center pile
 * - completeTrick() - sweeps trick to winner's pile
 * - hideOpponentHands() - collapses opponent hands to avatar positions
 * 
 * Euchre-specific animations (kept in useEuchreDirector.ts):
 * - animateDeckOffscreen() - moves deck off screen after trump called
 * - flipTurnUpFaceDown() - flips turn-up card face down
 * - animateTurnUpToDealer() - moves turn-up to dealer's hand
 * - handleDealerDiscard() - discards dealer's card after pickup
 */

import { ref, type Ref, nextTick } from 'vue'
import { computeTableLayout, type TableLayoutResult } from './useTableLayout'
import type { CardTableEngine } from './useCardTable'
import type { StandardCard } from '@67cards/shared'
import { Suit } from '@67cards/shared'
import { FullRank } from '@67cards/shared'
import type { CardPosition } from '@/components/cardContainers'
import { CardTimings, AnimationDelays } from '@/utils/animationTimings'
import { CardScales, getBaseCardWidth, getViewportWidth, isMobile } from './useCardSizing'

export type PlayAreaMode = 'trick' | 'overlay'
export type TrickCompleteMode = 'stack' | 'sweep'

export const cardControllerPresets = {
  euchre: {
    playAreaMode: 'trick' as PlayAreaMode,
    trickCompleteMode: 'stack' as TrickCompleteMode,
  },
  spades: {
    playAreaMode: 'trick' as PlayAreaMode,
    trickCompleteMode: 'stack' as TrickCompleteMode,
  },
  president: {
    playAreaMode: 'overlay' as PlayAreaMode,
    trickCompleteMode: 'sweep' as TrickCompleteMode,
  },
}

export interface CardControllerConfig {
  layout?: 'normal' | 'wide'
  playerCount: number | (() => number)
  userSeatIndex?: number | (() => number)
  userHandScale?: number
  opponentHandScale?: number
  userFanSpacing?: number
  opponentFanSpacing?: number
  userFanCurve?: number
  playAreaMode?: PlayAreaMode
  trickCompleteMode?: TrickCompleteMode
  playerIdToSeatIndex?: (playerId: number) => number
  playRefanDelayMs?: number
  playRefanDurationMs?: number
  playMoveMs?: number
  opponentCollapseScale?: number
  opponentCollapseDurationMs?: number
  /** Table width for calculating hand fan spacing (optional) */
  tableWidth?: number
}

export interface DealOptions {
  revealUserHand?: boolean
  focusUserHand?: boolean
  dealDelayMs?: number
  dealFlightMs?: number
  fanDurationMs?: number
  sortUserHand?: (cards: StandardCard[]) => StandardCard[]
  sortAfterDeal?: boolean
  dealerSeatIndex?: number
  dealerPlayerId?: number
  /** Extra cards to add to deck before dealing (e.g., kitty placeholders) */
  extraDeckCards?: StandardCard[]
  /** Keep remaining deck cards on table after dealing (e.g., kitty) */
  keepRemainingCards?: boolean
  /** Flip the top remaining card face-up after dealing (e.g., turn-up card) */
  flipTopCard?: boolean
  /** Explicit card ID to flip face-up (used when remaining deck includes placeholders) */
  flipTopCardId?: string
}

export interface DealPlayerView {
  hand?: StandardCard[]
  handSize?: number
}

export interface CompletedTrickSnapshot {
  winnerId: number | null
  cards: Array<{ card: { id: string; suit: string; rank: string } }>
}

function resolvesFaceUpWithBoardCardXor(faceUp: boolean, flipY: number): boolean {
  const normalizedFlip = ((flipY % 360) + 360) % 360
  const isFlipped = normalizedFlip > 90 && normalizedFlip < 270
  return isFlipped ? !faceUp : faceUp
}

export function useCardController(
  engine: CardTableEngine,
  boardRef: Ref<HTMLElement | null>,
  config: CardControllerConfig
) {
  const layoutType = config.layout ?? 'normal'
  const getPlayerCount = () => {
    if (typeof config.playerCount === 'function') {
      return config.playerCount()
    }
    return config.playerCount
  }
  const getUserSeatIndex = () => {
    if (typeof config.userSeatIndex === 'function') {
      return config.userSeatIndex()
    }
    return config.userSeatIndex ?? 0
  }
  const playAreaMode = config.playAreaMode ?? 'trick'
  const trickCompleteMode = config.trickCompleteMode ?? 'stack'
  const playerIdToSeatIndex = config.playerIdToSeatIndex ?? ((id) => id)

  const tableCenter = ref({ x: 0, y: 0 })
  const tableLayout = ref<TableLayoutResult | null>(null)
  const tricksWonByPlayer = ref<Record<number, number>>({})
  const hiddenSeatIndices = new Set<number>()

  function setupTable(dealerSeatIndex?: number) {
    engine.reset()

    const board = boardRef.value
    if (!board) return null

    const layout = computeTableLayout(board.offsetWidth, board.offsetHeight, layoutType, getPlayerCount())
    tableLayout.value = layout
    tableCenter.value = layout.tableCenter

    const deckPos = dealerSeatIndex !== undefined
      ? getAvatarBoardPosition(dealerSeatIndex, layout)
      : getGenericDealPosition()
    // When dealing from a player's avatar, use hidden scale (matches collapsed hand)
    const deckScale = dealerSeatIndex !== undefined ? CardScales.hidden : CardScales.deck
    engine.createDeck(deckPos, deckScale)

    const userScale = config.userHandScale ?? CardScales.userHand
    const opponentScale = config.opponentHandScale ?? CardScales.opponentHand
    for (let i = 0; i < getPlayerCount(); i++) {
      const seat = layout.seats[i]!
      engine.createHand(`hand-${i}`, seat.handPosition, {
        fanSpacing: seat.isUser 
          ? (config.userFanSpacing ?? Math.round(getBaseCardWidth() * 0.36))
          : (config.opponentFanSpacing ?? Math.round(getBaseCardWidth() * 0.19)),
        faceUp: false,
        rotation: seat.rotation,
        scale: seat.isUser ? userScale : opponentScale,
        fanCurve: seat.isUser ? (config.userFanCurve ?? 0) : 0,
        angleToCenter: seat.angleToCenter,
        isUser: seat.isUser,
      })
    }

    engine.createPile('center', { x: tableCenter.value.x, y: tableCenter.value.y }, CardScales.playArea)

    if (trickCompleteMode === 'stack') {
      for (let i = 0; i < getPlayerCount(); i++) {
        engine.createPile(`tricks-won-player-${i}`, layout.tableCenter, CardScales.tricksWon)
      }
    }

    tricksWonByPlayer.value = Object.fromEntries(
      Array.from({ length: getPlayerCount() }, (_, i) => [i, 0])
    ) as Record<number, number>

    engine.refreshCards()
    return layout
  }

  async function dealFromPlayers(players: DealPlayerView[], options: DealOptions = {}) {
    const board = boardRef.value
    if (!board) return

    const deck = engine.getDeck()
    const hands = engine.getHands()
    if (!deck || hands.length === 0) return
    const dealerSeat = options.dealerPlayerId !== undefined
      ? playerIdToSeatIndex(options.dealerPlayerId)
      : options.dealerSeatIndex
    if (dealerSeat !== undefined && tableLayout.value) {
      const dealerPos = getAvatarBoardPosition(dealerSeat, tableLayout.value)
      deck.position = dealerPos
      deck.scale = CardScales.hidden // Match hidden hand scale
    }


    const revealUserHand = options.revealUserHand ?? true
    const focusUserHand = options.focusUserHand ?? true

    const userSeatIndex = getUserSeatIndex()
    const userHand = hands[userSeatIndex]
    if (userHand) {
      userHand.faceUp = false
      userHand.flipCards(false)
      // Start at smaller scale during deal - will animate to full size after cards land
      userHand.scale = config.opponentHandScale ?? CardScales.opponentHand
      userHand.resetArcLock() // Reset arc radius lock for new hand
    }

    for (let i = 0; i < hands.length; i++) {
      if (i !== userSeatIndex) {
        hands[i]!.faceUp = false
        hands[i]!.flipCards(false)
      }
    }

    const placeholderNonce = Date.now()
    const resolvedHands: StandardCard[][] = Array.from({ length: getPlayerCount() }, (_, seatIdx) => {
      const player = players[seatIdx]
      const knownHand = player?.hand ?? []
      if (knownHand.length > 0) return knownHand

      const hiddenCount = Math.max(0, player?.handSize ?? 0)
      return Array.from({ length: hiddenCount }, (_, cardIdx) => ({
        id: `hidden-${placeholderNonce}-${seatIdx}-${cardIdx}`,
        suit: Suit.Spades,
        rank: FullRank.Two,
      }))
    })

    const maxCards = Math.max(0, ...resolvedHands.map(hand => hand.length))
    const dealQueue: { seatIdx: number; card: StandardCard }[] = []

    for (let round = 0; round < maxCards; round++) {
      for (let seatIdx = 0; seatIdx < getPlayerCount(); seatIdx++) {
        const card = resolvedHands[seatIdx]?.[round]
        if (card) dealQueue.push({ seatIdx, card })
      }
    }

    // Add extra cards first (they'll be at bottom of deck, remaining after dealing)
    // Add in forward order so last card (turn-up) ends up at highest index (highest z-index)
    const extraCards = options.extraDeckCards ?? []
    for (const card of extraCards) {
      engine.addCardToDeck({ id: card.id, suit: card.suit, rank: card.rank }, false)
    }

    for (let i = dealQueue.length - 1; i >= 0; i--) {
      const queued = dealQueue[i]!
      engine.addCardToDeck({
        id: queued.card.id,
        suit: queued.card.suit,
        rank: queued.card.rank,
      }, false)
    }

    engine.refreshCards()
    await nextTick()

    for (let i = 0; i < deck.cards.length; i++) {
      deck.cards[i]?.ref?.setPosition(deck.getCardPosition(i))
    }

    // Deal cards following the exact queue order (handles unequal hand sizes)
    // This is important for games like President where players can go out
    const dealDelayMs = options.dealDelayMs ?? 50
    const dealFlightMs = options.dealFlightMs ?? 200
    for (const queued of dealQueue) {
      const targetHand = hands[queued.seatIdx]
      if (targetHand && deck.cards.length > 0) {
        await engine.dealCard(deck, targetHand, dealFlightMs)
        if (dealDelayMs > 0) {
          await new Promise(r => setTimeout(r, dealDelayMs))
        }
      }
    }
    // Wait for last flight to complete
    await new Promise(r => setTimeout(r, dealFlightMs))

    if (userHand && focusUserHand) {
      const targetX = (tableLayout.value?.tableCenter ?? tableCenter.value).x
      const cardCount = userHand.cards.length
      // Consistent position - same for all hand sizes
      // User hand higher on full mode (more room), lower on mobile (maximize space)
      const bottomOffset = isMobile() ? 80 : 120
      const targetY = board.offsetHeight - bottomOffset
      const targetScale = config.userHandScale ?? CardScales.userHand

      userHand.position = { x: targetX, y: targetY }
      userHand.scale = targetScale
      
      // Fan spacing calculation
      const baseWidth = getBaseCardWidth()
      const scaledCardWidth = baseWidth * targetScale
      const maxSpacing = Math.round(baseWidth * 0.65) // Max ~65% of card width
      const minSpacing = Math.round(baseWidth * 0.20) // Min ~20% of card width
      
      let fanSpacing: number
      if (config.userFanSpacing !== undefined) {
        // Explicit override
        fanSpacing = config.userFanSpacing
      } else if (config.tableWidth && cardCount > 1) {
        // Table-based: span table width with padding, clamped to max
        const padding = scaledCardWidth * 0.5 // Half card padding on each side
        const availableWidth = config.tableWidth - padding * 2 - scaledCardWidth
        const tableBasedSpacing = availableWidth / (cardCount - 1)
        fanSpacing = Math.max(minSpacing, Math.min(maxSpacing, tableBasedSpacing))
      } else {
        // Fallback: viewport-based calculation
        const baseFanSpacing = Math.round(baseWidth * 0.40)
        const maxFanWidth = getViewportWidth() * 0.55
        fanSpacing = Math.min(baseFanSpacing, maxFanWidth / Math.max(1, cardCount))
      }
      userHand.fanSpacing = fanSpacing
      // Dynamic curve: fewer cards = more curve, more cards = less curve
      // 5 cards: ~8°, 8 cards: ~2.5°, 13 cards: ~1.5° (nearly flat for big hands)
      const dynamicCurve = cardCount > 0 ? Math.max(1.5, Math.min(9, 20 / cardCount + (cardCount <= 6 ? 4 : 0))) : 0
      userHand.fanCurve = config.userFanCurve !== undefined ? config.userFanCurve : dynamicCurve

      for (const managed of userHand.cards) {
        const cardRef = engine.getCardRef(managed.card.id)
        if (cardRef) {
          cardRef.moveTo({
            ...cardRef.getPosition(),
            x: targetX,
            y: targetY,
            scale: targetScale,
            flipY: revealUserHand ? 180 : 0,
          }, CardTimings.move)
        }
      }
      await new Promise(r => setTimeout(r, CardTimings.move))
    }

    for (const hand of hands) {
      if (hand.id !== `hand-${userSeatIndex}`) {
        hand.scale = config.opponentHandScale ?? CardScales.opponentHand
      }
    }

    await nextTick()
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    const fanDuration = options.fanDurationMs ?? CardTimings.fan
    await Promise.all(hands.map(hand => hand.setMode('fanned', fanDuration)))

    // Enable arc-fan on user hand cards if curve is set
    if (userHand && (config.userFanCurve ?? 0) > 0) {
      for (const managed of userHand.cards) {
        engine.getCardRef(managed.card.id)?.setArcFan(true)
      }
    }

    if (options.sortUserHand && options.sortAfterDeal !== false) {
      await sortUserHand(options.sortUserHand, CardTimings.sort)
    }

    // Handle remaining deck cards (e.g., kitty in Euchre)
    if (deck.cards.length > 0) {
      if (options.keepRemainingCards) {
        // Move deck to table center with visible scale
        const center = tableLayout.value?.tableCenter ?? tableCenter.value
        deck.position = center
        deck.scale = CardScales.deck
        for (let i = 0; i < deck.cards.length; i++) {
          const managed = deck.cards[i]
          if (!managed) continue
          const ref = engine.getCardRef(managed.card.id)
          const stackPos = deck.getCardPosition(i)
          ref?.moveTo({
            x: stackPos.x,
            y: stackPos.y,
            rotation: 0,
            zIndex: stackPos.zIndex,
            scale: CardScales.deck,
          }, CardTimings.move)
        }
        await new Promise(r => setTimeout(r, CardTimings.move))

        // Flip top card face-up if requested
        if (options.flipTopCard && deck.cards.length > 0) {
          const topCard = options.flipTopCardId
            ? deck.cards.find((managed) => managed.card.id === options.flipTopCardId)
            : deck.cards[deck.cards.length - 1]
          if (topCard) {
            // Keep logical faceUp false and animate flipY to 180.
            // BoardCard uses XOR between faceUp and flipY state; this makes
            // the turn-up card visually face-up with a real flip animation.
            const turnUpFaceUp = false
            const turnUpFlipY = 180
            topCard.faceUp = turnUpFaceUp
            const ref = engine.getCardRef(topCard.card.id)
            if (import.meta.env.DEV && !resolvesFaceUpWithBoardCardXor(turnUpFaceUp, turnUpFlipY)) {
              console.warn('[CardController] Invalid turn-up flip config: card will not render face-up')
            }
            const topStackPos = deck.getCardPosition(Math.max(0, deck.cards.length - 1))
            ref?.moveTo({ 
              x: topStackPos.x,
              y: topStackPos.y,
              rotation: 0, 
              zIndex: 150, 
              scale: CardScales.deck,
              flipY: turnUpFlipY 
            }, CardTimings.flip)
            engine.refreshCards()
          }
        }
      } else {
        // Move deck off-screen
        const offX = -200
        const offY = tableCenter.value.y
        for (const managed of deck.cards) {
          const ref = engine.getCardRef(managed.card.id)
          ref?.moveTo({ x: offX, y: offY, rotation: 0, zIndex: 50, scale: CardScales.tricksWon }, CardTimings.move)
        }
        await new Promise(r => setTimeout(r, CardTimings.move))
        // Remove remaining cards from deck
        while (deck.cards.length > 0) {
          deck.removeCard(deck.cards[0]!.card.id)
        }
        engine.refreshCards()
      }
    }
  }

  async function sortUserHand(sorter: (cards: StandardCard[]) => StandardCard[], duration: number = CardTimings.sort) {
    const userSeatIndex = getUserSeatIndex()
    const userHand = engine.getHands()[userSeatIndex]
    if (!userHand) return

    const sorted = sorter(userHand.cards.map(m => m.card as StandardCard))
    const sortedIds = sorted.map(card => card.id)
    const cardMap = new Map(userHand.cards.map(m => [m.card.id, m]))
    userHand.cards = sortedIds
      .map(id => cardMap.get(id))
      .filter((m): m is NonNullable<typeof m> => m != null)

    const moves = userHand.cards.map((managed, index) => {
      const ref = engine.getCardRef(managed.card.id)
      if (!ref) return null
      const target = userHand.getCardPosition(index)
      // Omit flipY - moveTo will preserve current flip state
      return ref.moveTo({
        x: target.x,
        y: target.y,
        rotation: target.rotation,
        zIndex: target.zIndex,
        scale: target.scale,
      }, duration)
    })

    await Promise.all(moves)
  }

  async function revealUserHand(duration: number = CardTimings.reveal) {
    const userSeatIndex = getUserSeatIndex()
    const userHand = engine.getHands()[userSeatIndex]
    if (!userHand) return

    // NOTE: Do NOT call flipCards(true) here!
    // BoardCard's showFaceUp logic: isFlipped XOR props.faceUp
    // Cards start with managed.faceUp=false. Animating flipY 0→180 flips the visual,
    // so showFaceUp = isFlipped(true) XOR faceUp(false) = true (shows face)
    // If we also set managed.faceUp=true, it double-flips back to showing the back.

    const moves = userHand.cards.map((managed, index) => {
      const ref = engine.getCardRef(managed.card.id)
      if (!ref) return null
      const pos = ref.getPosition()
      const delay = index * 12
      return new Promise<void>(resolve => {
        setTimeout(() => {
          ref.moveTo({ ...pos, flipY: 180 }, duration).then(resolve)
        }, delay)
      })
    })

    await Promise.all(moves)
  }

  async function revealBlindNilHand(playerId: number, cards: StandardCard[], duration: number = CardTimings.reveal) {
    const seatIndex = playerIdToSeatIndex(playerId)
    const hand = engine.getHands()[seatIndex]
    if (!hand) return

    // Remove hidden marker
    hiddenSeatIndices.delete(seatIndex)

    // Update hand cards with real cards
    hand.cards = []
    for (const card of cards) {
      hand.addCard(card, false)
    }
    engine.refreshCards()
    await nextTick()

    // Animate from avatar position to fanned
    const layout = tableLayout.value
    const avatarPos = layout ? getAvatarBoardPosition(seatIndex, layout) : tableCenter.value

    // Position all cards at avatar first
    for (const managed of hand.cards) {
      const ref = engine.getCardRef(managed.card.id)
      if (ref) {
        ref.setPosition({
          x: avatarPos.x,
          y: avatarPos.y,
          rotation: 0,
          zIndex: 100,
          scale: CardScales.hidden,
          flipY: 0,
        })
      }
    }
    await nextTick()

    // Animate to fanned position with flip
    await hand.setMode('fanned', duration)
    const moves = hand.cards.map((managed, index) => {
      const ref = engine.getCardRef(managed.card.id)
      if (!ref) return null
      const target = hand.getCardPosition(index)
      return ref.moveTo({
        ...target,
        flipY: 180,
      }, duration)
    })
    await Promise.all(moves.filter(Boolean))
  }

  function getTrickCardPosition(playerId: number, cardIndex: number): CardPosition {
    const layout = tableLayout.value
    const center = layout?.tableCenter ?? tableCenter.value
    const seatIndex = playerIdToSeatIndex(playerId)
    // Tighter spacing on mobile (cards are smaller)
    const d = isMobile() ? 28 : 45
    const offsets: Record<number, { x: number; y: number; rotation: number }> = {
      0: { x: 0, y: d, rotation: 0 },
      1: { x: -d, y: 0, rotation: -8 },
      2: { x: 0, y: -d, rotation: 0 },
      3: { x: d, y: 0, rotation: 8 },
    }
    const o = offsets[seatIndex] ?? offsets[0]!
    return {
      x: center.x + o.x,
      y: center.y + o.y,
      rotation: o.rotation,
      zIndex: 300 + cardIndex, // Below user avatar (500)
      scale: CardScales.playArea,
      flipY: 180,
      tableSkew: true, // Cards on table get 3D skew
    }
  }

  function getOverlayCardPosition(playIndex: number, cardIndex: number, totalInPlay: number): CardPosition {
    const center = tableLayout.value?.tableCenter ?? tableCenter.value
    const groupOffsetX = (playIndex % 3 - 1) * 12
    const groupOffsetY = -playIndex * 2
    const middleIdx = (totalInPlay - 1) / 2
    const cardSpread = (cardIndex - middleIdx) * 22
    const seed = playIndex * 7919
    const groupRot = Math.sin(seed) * 5

    return {
      x: center.x + groupOffsetX + cardSpread,
      y: center.y + groupOffsetY,
      rotation: 180 + groupRot,
      zIndex: 300 + playIndex * 4 + cardIndex, // Below user avatar (500)
      scale: CardScales.playArea,
      flipY: 180,
      tableSkew: true, // Cards on table get 3D skew
    }
  }

  async function playCard(cardOrId: StandardCard | string, playerId: number, cardIndex: number) {
    const pile = engine.getPiles().find(p => p.id === 'center')
    const card = typeof cardOrId === 'string'
      ? { id: cardOrId, suit: Suit.Spades, rank: FullRank.Two }
      : cardOrId
    const seatIndex = playerIdToSeatIndex(playerId)
    const userSeatIndex = getUserSeatIndex()
    const fromHand = engine.getHands().find(h => h.id === `hand-${seatIndex}`)
    if (!pile) return

    const alreadyInPlayArea = pile.cards.some((managed) => managed.card.id === card.id)
    if (alreadyInPlayArea) return

    const alreadyMovedToTrickPile = engine
      .getPiles()
      .filter((candidate) => candidate.id !== 'center')
      .some((candidate) => candidate.cards.some((managed) => managed.card.id === card.id))
    if (alreadyMovedToTrickPile) return

    const target = playAreaMode === 'overlay'
      ? getOverlayCardPosition(cardIndex, 0, 1)
      : getTrickCardPosition(playerId, cardIndex)

    const moveDuration = config.playMoveMs ?? CardTimings.move
    const hasCardInHand = !!fromHand?.cards.some((managed) => managed.card.id === card.id)

    if (fromHand && hasCardInHand) {
      await engine.moveCard(card.id, fromHand, pile, target, moveDuration)
    } else {
      const seat = tableLayout.value?.seats[seatIndex]
      let startPos: CardPosition = {
        x: seat?.handPosition.x ?? tableCenter.value.x,
        y: seat?.handPosition.y ?? tableCenter.value.y,
        rotation: seat?.rotation ?? 0,
        zIndex: 900,
        scale: seatIndex === userSeatIndex ? (config.userHandScale ?? CardScales.userHand) : (config.opponentHandScale ?? CardScales.opponentHand),
        flipY: 0,
      }

      if (fromHand && fromHand.cards.length > 0 && seatIndex !== userSeatIndex) {
        const placeholder = fromHand.cards[0]
        if (placeholder) {
          const placeholderRef = engine.getCardRef(placeholder.card.id)
          if (placeholderRef) {
            startPos = placeholderRef.getPosition()
          }
          fromHand.removeCard(placeholder.card.id)
          engine.refreshCards()
        }
      }

      // faceUp must be false so that flipY=180 shows the face (XOR logic in BoardCard)
      pile.addCard({ id: card.id, suit: card.suit, rank: card.rank }, false)
      engine.refreshCards()
      await nextTick()

      const ref = engine.getCardRef(card.id)
      if (ref) {
        ref.setPosition(startPos)
        await new Promise<void>(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
        await ref.moveTo(target, moveDuration)
      }
    }

    // Brief pause, then refan to close the gap after the card leaves the hand.
    const refanDelay = config.playRefanDelayMs ?? 120
    const refanDuration = config.playRefanDurationMs ?? 200
    if (fromHand && fromHand.cards.length > 0 && !(seatIndex !== userSeatIndex && hiddenSeatIndices.has(seatIndex))) {
      await new Promise(r => setTimeout(r, refanDelay))
      fromHand.mode = 'fanned'
      const moves = fromHand.cards.map((managed, index) => {
        const ref = engine.getCardRef(managed.card.id)
        if (!ref) return null
        const target = fromHand.getCardPosition(index)
        // Omit flipY - moveTo will preserve current flip state
        return ref.moveTo({
          x: target.x,
          y: target.y,
          rotation: target.rotation,
          zIndex: target.zIndex,
          scale: target.scale,
        }, refanDuration)
      })
      await Promise.all(moves)
    }
  }

  function getPlayerTrickPosition(playerId: number, trickNumber: number, cardIndex: number): CardPosition {
    const layout = tableLayout.value
    if (!layout) {
      return {
        x: tableCenter.value.x,
        y: tableCenter.value.y,
        rotation: 0,
        zIndex: 50 + trickNumber * 4 + cardIndex,
        scale: CardScales.tricksWon,
        flipY: 0,
        tableSkew: true,
      }
    }

    const { tableBounds } = layout
    const inset = 20
    const gap = 12
    let x: number
    let y: number
    let rotation: number

    switch (playerIdToSeatIndex(playerId)) {
      case 0:
        x = tableBounds.centerX - 60 - trickNumber * gap
        y = tableBounds.bottom - inset
        rotation = 0
        break
      case 1:
        x = tableBounds.left + inset
        y = tableBounds.centerY - 40 - trickNumber * gap
        rotation = 90
        break
      case 2:
        x = tableBounds.centerX + 60 + trickNumber * gap
        y = tableBounds.top + inset
        rotation = 0
        break
      case 3:
        x = tableBounds.right - inset
        y = tableBounds.centerY + 40 + trickNumber * gap
        rotation = 90
        break
      default:
        x = tableBounds.centerX
        y = tableBounds.centerY
        rotation = 0
    }

    return {
      x,
      y: y - cardIndex * 0.6,
      rotation,
      zIndex: 50 + trickNumber * 4 + cardIndex,
      scale: CardScales.tricksWon,
      flipY: 0,
      tableSkew: true,
    }
  }

  async function completeTrick(winnerId: number) {
    const pile = engine.getPiles().find(p => p.id === 'center')
    if (!pile || pile.cards.length === 0) return

    const moveDuration = config.playMoveMs ?? CardTimings.move

    if (trickCompleteMode === 'sweep') {
      const board = boardRef.value
      if (!board) return

      const offX = board.offsetWidth + 200
      const offY = (tableLayout.value?.tableCenter ?? tableCenter.value).y
      // Sweep covers more distance than card play, so use longer duration
      // to match perceived speed (~2x distance = ~2x duration)
      const sweepDuration = moveDuration * 2
      const moves = pile.cards.map((managed, i) => {
        const ref = engine.getCardRef(managed.card.id)
        return ref?.moveTo({
          x: offX,
          y: offY,
          rotation: 20,
          zIndex: 100 + i,
          scale: CardScales.sweep,
        }, sweepDuration)
      })
      await Promise.all(moves)
      pile.clear()
      engine.refreshCards()
      return
    }

    const tricksWon = tricksWonByPlayer.value[winnerId] ?? 0
    const targetPile = engine.getPiles().find(p => p.id === `tricks-won-player-${playerIdToSeatIndex(winnerId)}`)
    if (!targetPile) return

    // Stack moves cards from center to table edge - longer distance than card play
    // Use ~1.5x duration to match perceived speed
    const stackDuration = Math.round(moveDuration * 1.5)
    const cardsToMove = [...pile.cards]
    const movePromises = cardsToMove.map((managed, index) => {
      const targetPos = getPlayerTrickPosition(winnerId, tricksWon, index)
      return engine.moveCard(managed.card.id, pile, targetPile, targetPos, stackDuration)
    })

    await Promise.all(movePromises)
    tricksWonByPlayer.value = {
      ...tricksWonByPlayer.value,
      [winnerId]: tricksWon + 1,
    }
    engine.refreshCards()
  }

  async function restoreWonTrickStacks(tricks: CompletedTrickSnapshot[]) {
    if (trickCompleteMode !== 'stack') return
    if (!tricks.length) return

    const winnerTrickCounts: Record<number, number> = {}
    // Track cards to position after refresh
    const cardsToPosition: Array<{ cardId: string; winnerId: number; trickNumber: number; cardIndex: number }> = []

    // First pass: add all cards to piles
    for (const trick of tricks) {
      if (trick.winnerId === null) continue

      const winnerId = trick.winnerId
      const winnerSeat = playerIdToSeatIndex(winnerId)
      const targetPile = engine.getPiles().find(p => p.id === `tricks-won-player-${winnerSeat}`)
      if (!targetPile) continue

      const trickNumber = winnerTrickCounts[winnerId] ?? 0
      const trickCards = trick.cards ?? []

      for (let cardIndex = 0; cardIndex < trickCards.length; cardIndex++) {
        const played = trickCards[cardIndex]
        const playedCard = played?.card
        if (!playedCard) continue

        targetPile.addCard({
          id: playedCard.id,
          suit: playedCard.suit,
          rank: playedCard.rank,
        }, false)

        cardsToPosition.push({ cardId: playedCard.id, winnerId, trickNumber, cardIndex })
      }

      winnerTrickCounts[winnerId] = trickNumber + 1
    }

    // Refresh to create Vue components
    engine.refreshCards()
    
    // Wait for Vue to render the new card components
    await nextTick()

    // Second pass: position all cards now that refs exist
    for (const { cardId, winnerId, trickNumber, cardIndex } of cardsToPosition) {
      const ref = engine.getCardRef(cardId)
      const targetPos = getPlayerTrickPosition(winnerId, trickNumber, cardIndex)
      ref?.setPosition(targetPos)
    }

    tricksWonByPlayer.value = {
      ...tricksWonByPlayer.value,
      ...winnerTrickCounts,
    }
  }

  function getAvatarBoardPosition(seatIndex: number, layout: TableLayoutResult): { x: number; y: number } {
    const { tableBounds, seats } = layout
    const seat = seats[seatIndex]
    if (!seat) return layout.tableCenter

    // Match the avatar positioning from CardTable.vue
    // Opponents: positioned ON the rail edge
    // User (bottom): positioned at bottom of screen (fixed position pill avatar)
    switch (seat.side) {
      case 'left':
        return { x: tableBounds.left, y: seat.handPosition.y }
      case 'right':
        return { x: tableBounds.right, y: seat.handPosition.y }
      case 'top':
        return { x: seat.handPosition.x, y: tableBounds.top }
      case 'bottom':
        // User's pill avatar is at bottom of board, not table edge
        const board = boardRef.value
        const bottomY = board ? board.offsetHeight - 35 : tableBounds.bottom
        return { x: tableBounds.centerX, y: bottomY }
      default:
        return layout.tableCenter
    }
  }

  /**
   * Generic off-screen position for dealing (top-left corner).
   * Used when there's no specific dealer (e.g., President).
   */
  function getGenericDealPosition(): { x: number; y: number } {
    // Top-right corner of table, slightly inset
    const layout = tableLayout.value
    if (layout) {
      return { x: layout.tableBounds.right - 50, y: layout.tableBounds.top + 30 }
    }
    return { x: -100, y: -100 } // Fallback off-screen
  }

  /**
   * Generic off-screen position for sweeping cards (bottom-right corner).
   * Used for clearing piles when there's no specific destination.
   */
  function getGenericSweepPosition(): { x: number; y: number } {
    const board = boardRef.value
    if (!board) return { x: 1000, y: 1000 }
    return { x: board.offsetWidth + 100, y: board.offsetHeight + 100 }
  }

  /**
   * Restore hands from saved state - instantly places cards without animation.
   * Used when resuming a saved single-player game.
   * 
   * @param playersBySeat - Array of player hands indexed by SEAT INDEX (0 = user seat)
   */
  function restoreHands(
    playersBySeat: Array<{ hand: StandardCard[] }>,
    options: { userSeatFaceUp?: boolean; sortUserHand?: (cards: StandardCard[]) => StandardCard[] } = {}
  ) {
    const hands = engine.getHands()
    const board = boardRef.value
    if (!board || hands.length === 0) return

    const layout = tableLayout.value ?? computeTableLayout(
      board.offsetWidth,
      board.offsetHeight,
      config.layout ?? 'normal',
      getPlayerCount()
    )
    const userSeatIndex = getUserSeatIndex()
    const hideScale = 0.05

    for (let seatIndex = 0; seatIndex < getPlayerCount(); seatIndex++) {
      const hand = hands[seatIndex]
      if (!hand) continue

      const player = playersBySeat[seatIndex]
      if (!player) continue

      let cardsToAdd = [...player.hand]
      const isUser = seatIndex === userSeatIndex

      // Sort user's hand if sorter provided
      if (isUser && options.sortUserHand) {
        cardsToAdd = options.sortUserHand(cardsToAdd)
      }

      // Set hand properties
      hand.faceUp = isUser && (options.userSeatFaceUp ?? true)
      hand.mode = isUser ? 'fanned' : 'looseStack'
      hand.scale = isUser ? (config.userHandScale ?? CardScales.userHand) : (config.opponentHandScale ?? CardScales.opponentHand)
      hand.resetArcLock()

      // Add cards to hand (hand.addCard adds to container, engine tracks via allCards computed)
      for (const card of cardsToAdd) {
        hand.addCard(card, hand.faceUp)
      }

      // Refresh so card refs are created
      engine.refreshCards()

      // Position cards instantly (no animation)
      if (isUser) {
        // User: fanned at bottom, face up
        // Ensure all cards are marked face up
        hand.flipCards(true)
        for (let i = 0; i < hand.cards.length; i++) {
          const pos = hand.getCardPosition(i)
          const ref = engine.getCardRef(hand.cards[i]!.card.id)
          if (ref) {
            // Explicitly include flipY to ensure face up
            ref.setPosition({ ...pos, flipY: 180 })
          }
        }
      } else {
        // Opponent: collapsed at avatar position
        const avatarPos = getAvatarBoardPosition(seatIndex, layout)
        hiddenSeatIndices.add(seatIndex)
        for (const managed of hand.cards) {
          const ref = engine.getCardRef(managed.card.id)
          ref?.setPosition({
            x: avatarPos.x,
            y: avatarPos.y,
            rotation: 0,
            zIndex: 1,  // Below avatars (350+)
            scale: hideScale,
          })
        }
      }
    }

    engine.refreshCards()
  }

  async function hideOpponentHands() {
    const board = boardRef.value
    if (!board) return

    // Compute layout if not already set (e.g., Euchre sets up engine directly)
    const layout = tableLayout.value ?? computeTableLayout(
      board.offsetWidth,
      board.offsetHeight,
      config.layout ?? 'normal',
      getPlayerCount()
    )

    const duration = config.opponentCollapseDurationMs ?? CardTimings.collapse
    const hands = engine.getHands()
    const promises: Promise<void>[] = []
    const hideScale = 0.05 // Essentially invisible

    for (let seatIndex = 0; seatIndex < getPlayerCount(); seatIndex++) {
      const userSeatIndex = getUserSeatIndex()
      if (seatIndex === userSeatIndex) continue
      const hand = hands[seatIndex]
      if (!hand || hand.cards.length === 0) continue

      // Position at each opponent's own avatar (so plays animate from correct spot)
      const avatarPos = getAvatarBoardPosition(seatIndex, layout)
      
      hiddenSeatIndices.add(seatIndex)
      for (const managed of hand.cards) {
        const ref = engine.getCardRef(managed.card.id)
        if (ref) {
          promises.push(ref.moveTo({
            x: avatarPos.x,
            y: avatarPos.y,
            rotation: 0,
            zIndex: 1,  // Below avatars (350+)
            scale: hideScale,
          }, duration))
        }
      }
    }

    await Promise.all(promises)
  }

  /**
   * Sweep remaining deck cards to dealer's avatar position.
   * Used after dealing when kitty/remaining cards should disappear toward dealer.
   * @param dealerSeatIndex - seat index of dealer
   * @param durationMs - animation duration (default CardTimings.move)
   */
  async function sweepDeckToDealer(dealerSeatIndex: number, durationMs: number = CardTimings.move) {
    const deck = engine.getDeck()
    if (!deck || deck.cards.length === 0) return

    const layout = tableLayout.value
    if (!layout) return

    const targetPos = getAvatarBoardPosition(dealerSeatIndex, layout)

    await Promise.all(deck.cards.map(m => {
      const ref = engine.getCardRef(m.card.id)
      if (!ref) return Promise.resolve()
      return ref.moveTo({
        x: targetPos.x,
        y: targetPos.y,
        rotation: 0,
        zIndex: 1,  // Below avatars (350+)
        scale: 0.05, // Shrink to essentially invisible
        flipY: 0,    // Face down
      }, durationMs)
    }))

    // Clear deck cards after animation
    deck.cards = []
    engine.refreshCards()
  }

  /**
   * Sync the user's visual hand with the server state.
   * Used in MP when server updates hand (e.g., card exchange).
   * Removes cards no longer in hand, adds new cards, sorts and fans.
   * @param recipientSeat - seat index to animate removed cards toward (defaults to table center)
   * @param durationMs - animation duration for card movements (default CardTimings.move)
   */
  async function syncUserHandWithState(
    newCards: StandardCard[],
    sorter?: (cards: StandardCard[]) => StandardCard[],
    recipientSeat?: number,
    durationMs: number = CardTimings.move
  ) {
    const userSeatIndex = getUserSeatIndex()
    const userHand = engine.getHands()[userSeatIndex]
    if (!userHand) {
      console.warn('[CardController] syncUserHandWithState: no user hand')
      return
    }

    const currentIds = new Set(userHand.cards.map(m => m.card.id))
    const newIds = new Set(newCards.map(c => c.id))

    // Find cards to remove (in engine but not in new state)
    const toRemove = userHand.cards.filter(m => !newIds.has(m.card.id))
    // Find cards to add (in new state but not in engine)
    const toAdd = newCards.filter(c => !currentIds.has(c.id))

    console.log('[CardController] syncUserHandWithState:', {
      currentCount: currentIds.size,
      newCount: newIds.size,
      removing: toRemove.map(m => m.card.id),
      adding: toAdd.map(c => c.id),
    })

    // Animate cards being removed toward recipient before removing
    if (toRemove.length > 0) {
      const layout = tableLayout.value
      let targetPos: { x: number; y: number }
      if (recipientSeat !== undefined && layout) {
        // Animate toward recipient's avatar position
        targetPos = getAvatarBoardPosition(recipientSeat, layout)
      } else {
        // Fallback: animate toward table center
        targetPos = layout?.tableCenter ?? tableCenter.value
      }

      const removeAnims = toRemove.map(managed => {
        const ref = engine.getCardRef(managed.card.id)
        if (!ref) return null
        return ref.moveTo({
          x: targetPos.x,
          y: targetPos.y,
          rotation: 0,
          zIndex: 600,
          scale: CardScales.mini,
          flipY: 0, // flip to back as it leaves
        }, durationMs)
      })
      await Promise.all(removeAnims.filter(Boolean))
    }

    // Remove cards from engine
    for (const managed of toRemove) {
      userHand.removeCard(managed.card.id)
    }

    // Add new cards to engine (faceUp=false so flipY:180 shows face via XOR logic)
    for (const card of toAdd) {
      userHand.addCard(card, false)
    }

    // Trigger Vue to re-render the card list
    if (toAdd.length > 0 || toRemove.length > 0) {
      engine.refreshCards()
      // Wait for Vue to render new BoardCard components and register refs
      await nextTick()
      await nextTick()
      // Extra delay to ensure BoardCard onMounted has run and registered refs
      await new Promise(r => setTimeout(r, 50))
    }

    // Sort and re-fan
    if (sorter) {
      const sorted = sorter(userHand.cards.map(m => m.card as StandardCard))
      const sortedIds = sorted.map(card => card.id)
      const cardMap = new Map(userHand.cards.map(m => [m.card.id, m]))
      userHand.cards = sortedIds
        .map(id => cardMap.get(id))
        .filter((m): m is NonNullable<typeof m> => m != null)
    }

    // Ensure hand is in fanned mode for proper positioning
    userHand.mode = 'fanned'

    // Animate remaining/new cards to their positions
    const moves = userHand.cards.map((managed, index) => {
      const ref = engine.getCardRef(managed.card.id)
      if (!ref) {
        console.warn('[CardController] syncUserHandWithState: no ref for', managed.card.id)
        return null
      }
      const target = userHand.getCardPosition(index)
      return ref.moveTo({
        x: target.x,
        y: target.y,
        rotation: target.rotation,
        zIndex: target.zIndex,
        scale: target.scale,
        flipY: 180, // face up
      }, durationMs)
    })

    await Promise.all(moves.filter(Boolean))
  }

  /**
   * Handle layout change (resize, orientation change).
   * Repositions all containers and animates cards to new positions.
   */
  async function handleLayoutChange(animationMs: number = 200): Promise<void> {
    const board = boardRef.value
    if (!board) return

    // Recalculate layout
    const newLayout = computeTableLayout(board.offsetWidth, board.offsetHeight, layoutType, getPlayerCount())
    tableLayout.value = newLayout
    tableCenter.value = newLayout.tableCenter

    // Update deck position (at table center for now)
    const deck = engine.getDeck()
    if (deck) {
      deck.position = { x: newLayout.tableCenter.x, y: newLayout.tableCenter.y }
    }

    // Update hand positions from layout seats
    const hands = engine.getHands()
    const userSeatIndex = getUserSeatIndex()
    
    for (let i = 0; i < hands.length; i++) {
      const hand = hands[i]
      const seat = newLayout.seats[i]
      if (!hand || !seat) continue
      
      if (seat.isUser) {
        // User hand: bottom center with offset
        const bottomOffset = isMobile() ? 80 : 120
        hand.position = {
          x: newLayout.tableCenter.x,
          y: board.offsetHeight - bottomOffset
        }
      } else {
        // Opponent hands: use seat position
        hand.position = { ...seat.handPosition }
      }
      
      // Reset arc lock so fan recalculates for new size
      hand.resetArcLock()
    }

    // Update pile positions
    const piles = engine.getPiles()
    for (const pile of piles) {
      if (pile.id === 'center') {
        // Center pile at table center
        pile.position = { x: newLayout.tableCenter.x, y: newLayout.tableCenter.y }
      } else if (pile.id.startsWith('tricks-won-player-')) {
        // Trick piles near player's avatar
        const seatIdx = parseInt(pile.id.replace('tricks-won-player-', ''))
        const seat = newLayout.seats[seatIdx]
        if (seat) {
          const offset = seat.isUser ? { x: 80, y: -30 } : { x: 40, y: 30 }
          pile.position = {
            x: seat.handPosition.x + offset.x,
            y: seat.handPosition.y + offset.y
          }
        }
      }
    }

    // Animate all cards to new positions
    const promises: Promise<void>[] = []
    
    if (deck) {
      promises.push(deck.repositionAll(animationMs))
    }
    
    for (const hand of hands) {
      promises.push(hand.repositionAll(animationMs))
    }
    
    for (const pile of piles) {
      promises.push(pile.repositionAll(animationMs))
    }

    await Promise.all(promises)
  }

  /**
   * Update table width for fan spacing calculations
   */
  function setTableWidth(width: number) {
    config.tableWidth = width
  }

  return {
    tableCenter,
    tableLayout,
    setupTable,
    handleLayoutChange,
    setTableWidth,
    dealFromPlayers,
    restoreHands,
    revealUserHand,
    sortUserHand,
    syncUserHandWithState,
    playCard,
    completeTrick,
    restoreWonTrickStacks,
    hideOpponentHands,
    sweepDeckToDealer,
    getGenericDealPosition,
    getGenericSweepPosition,
    getAvatarBoardPosition,
  }
}
