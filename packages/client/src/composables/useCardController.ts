/**
 * Shared Card Controller
 * 
 * Provides unified card animation methods used across all games.
 * Games should use these methods rather than implementing their own.
 * 
 * TODO: Euchre has additional implementations in useEuchreDirector.ts that
 * should be moved here when needed by other games:
 * - animateDeal() - deals with kitty/turn-up card handling
 * - animateCardPlay() - plays card to trick area
 * - animateTrickSweep() - sweeps completed trick to winner
 * - animateDeckOffscreen() - moves deck off screen
 * - flipTurnUpFaceDown() - flips turn-up card
 * - animateTurnUpToDealer() - moves turn-up to dealer's hand
 * - handleDealerDiscard() - discards dealer's card
 */

import { ref, type Ref, nextTick } from 'vue'
import { computeTableLayout, type TableLayoutResult } from './useTableLayout'
import type { CardTableEngine } from './useCardTable'
import type { StandardCard } from '@67cards/shared'
import { Suit } from '@67cards/shared'
import { FullRank } from '@67cards/shared'
import type { CardPosition } from '@/components/cardContainers'

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
  playerCount: number
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
}

export interface DealPlayerView {
  hand?: StandardCard[]
  handSize?: number
}

export function useCardController(
  engine: CardTableEngine,
  boardRef: Ref<HTMLElement | null>,
  config: CardControllerConfig
) {
  const layoutType = config.layout ?? 'normal'
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

    const layout = computeTableLayout(board.offsetWidth, board.offsetHeight, layoutType, config.playerCount)
    tableLayout.value = layout
    tableCenter.value = layout.tableCenter

    const deckPos = dealerSeatIndex !== undefined
      ? getDealerDeckPosition(dealerSeatIndex, layout)
      : { x: tableCenter.value.x, y: tableCenter.value.y }
    engine.createDeck(deckPos, 0.8)

    const baseScale = config.opponentHandScale ?? 0.7
    for (let i = 0; i < config.playerCount; i++) {
      const seat = layout.seats[i]!
      engine.createHand(`hand-${i}`, seat.handPosition, {
        fanSpacing: seat.isUser ? (config.userFanSpacing ?? 30) : (config.opponentFanSpacing ?? 16),
        faceUp: false,
        rotation: seat.rotation,
        scale: baseScale,
        fanCurve: seat.isUser ? (config.userFanCurve ?? 0) : 0,
        angleToCenter: seat.angleToCenter,
        isUser: seat.isUser,
      })
    }

    engine.createPile('center', { x: tableCenter.value.x, y: tableCenter.value.y }, 0.8)

    if (trickCompleteMode === 'stack') {
      for (let i = 0; i < config.playerCount; i++) {
        engine.createPile(`tricks-won-player-${i}`, layout.tableCenter, 0.5)
      }
    }

    tricksWonByPlayer.value = Object.fromEntries(
      Array.from({ length: config.playerCount }, (_, i) => [i, 0])
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
      const dealerPos = getDealerDeckPosition(dealerSeat, tableLayout.value)
      deck.position = dealerPos
    }


    const revealUserHand = options.revealUserHand ?? true
    const focusUserHand = options.focusUserHand ?? true

    const userSeatIndex = getUserSeatIndex()
    const userHand = hands[userSeatIndex]
    if (userHand) {
      userHand.faceUp = false
      userHand.flipCards(false)
      userHand.scale = config.opponentHandScale ?? 0.7
    }

    for (let i = 0; i < hands.length; i++) {
      if (i !== userSeatIndex) {
        hands[i]!.faceUp = false
        hands[i]!.flipCards(false)
      }
    }

    const placeholderNonce = Date.now()
    const resolvedHands: StandardCard[][] = Array.from({ length: config.playerCount }, (_, seatIdx) => {
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
      for (let seatIdx = 0; seatIdx < config.playerCount; seatIdx++) {
        const card = resolvedHands[seatIdx]?.[round]
        if (card) dealQueue.push({ seatIdx, card })
      }
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

    await engine.dealAll(maxCards, options.dealDelayMs ?? 50, options.dealFlightMs ?? 200)

    if (userHand && focusUserHand) {
      const targetX = (tableLayout.value?.tableCenter ?? tableCenter.value).x
      const targetY = board.offsetHeight - 20
      const targetScale = config.userHandScale ?? 1.6

      userHand.position = { x: targetX, y: targetY }
      userHand.scale = targetScale
      userHand.fanSpacing = config.userFanSpacing ?? Math.min(30, 320 / Math.max(1, userHand.cards.length))
      userHand.fanCurve = config.userFanCurve ?? 0

      for (const managed of userHand.cards) {
        const cardRef = engine.getCardRef(managed.card.id)
        if (cardRef) {
          cardRef.moveTo({
            ...cardRef.getPosition(),
            x: targetX,
            y: targetY,
            scale: targetScale,
            flipY: revealUserHand ? 180 : 0,
          }, 350)
        }
      }
      await new Promise(r => setTimeout(r, 400))
    }

    for (const hand of hands) {
      if (hand.id !== `hand-${userSeatIndex}`) {
        hand.scale = config.opponentHandScale ?? 0.7
      }
    }

    await nextTick()
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    const fanDuration = options.fanDurationMs ?? 350
    await Promise.all(hands.map(hand => hand.setMode('fanned', fanDuration)))

    if (options.sortUserHand && options.sortAfterDeal !== false) {
      await sortUserHand(options.sortUserHand, 300)
    }
  }

  function getDealerDeckPosition(dealerSeatIndex: number, layout: TableLayoutResult): { x: number; y: number } {
    const seat = layout.seats[dealerSeatIndex]
    if (!seat) return { x: layout.tableCenter.x, y: layout.tableCenter.y }

    const { tableBounds } = layout
    const off = 280
    switch (seat.side) {
      case 'bottom':
        return { x: tableBounds.centerX, y: tableBounds.bottom + off }
      case 'left':
        return { x: tableBounds.left - off, y: tableBounds.centerY }
      case 'top':
        return { x: tableBounds.centerX, y: tableBounds.top - off }
      case 'right':
        return { x: tableBounds.right + off, y: tableBounds.centerY }
      default:
        return { x: layout.tableCenter.x, y: layout.tableCenter.y }
    }
  }

  async function sortUserHand(sorter: (cards: StandardCard[]) => StandardCard[], duration: number = 300) {
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

  async function revealUserHand(duration: number = 350) {
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

  function getTrickCardPosition(playerId: number, cardIndex: number): CardPosition {
    const layout = tableLayout.value
    const center = layout?.tableCenter ?? tableCenter.value
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
      x: center.x + o.x,
      y: center.y + o.y,
      rotation: o.rotation,
      zIndex: 500 + cardIndex,
      scale: 0.9,
      flipY: 180,
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
      zIndex: 500 + playIndex * 4 + cardIndex,
      scale: 0.9,
      flipY: 180,
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

    const moveDuration = config.playMoveMs ?? 300
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
        scale: seatIndex === userSeatIndex ? (config.userHandScale ?? 1.6) : (config.opponentHandScale ?? 0.7),
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
        scale: 0.5,
        flipY: 0,
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
      scale: 0.5,
      flipY: 0,
    }
  }

  async function completeTrick(winnerId: number) {
    const pile = engine.getPiles().find(p => p.id === 'center')
    if (!pile || pile.cards.length === 0) return

    const moveDuration = config.playMoveMs ?? 300

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
          scale: 0.6,
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

  function getAvatarBoardPosition(seatIndex: number, layout: TableLayoutResult): { x: number; y: number } {
    const { tableBounds } = layout
    switch (seatIndex) {
      case 1:
        return { x: tableBounds.left - 40, y: tableBounds.centerY }
      case 2:
        return { x: tableBounds.centerX, y: tableBounds.top - 30 }
      case 3:
        return { x: tableBounds.right + 40, y: tableBounds.centerY }
      default:
        return layout.tableCenter
    }
  }

  async function hideOpponentHands() {
    const board = boardRef.value
    if (!board) return

    // Compute layout if not already set (e.g., Euchre sets up engine directly)
    const layout = tableLayout.value ?? computeTableLayout(
      board.offsetWidth,
      board.offsetHeight,
      config.layout ?? 'normal',
      config.playerCount
    )

    const duration = config.opponentCollapseDurationMs ?? 250
    const hands = engine.getHands()
    const promises: Promise<void>[] = []
    const hideScale = 0.05 // Essentially invisible

    for (let seatIndex = 0; seatIndex < config.playerCount; seatIndex++) {
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
            zIndex: 50,
            scale: hideScale,
          }, duration))
        }
      }
    }

    await Promise.all(promises)
  }

  return {
    tableCenter,
    tableLayout,
    setupTable,
    dealFromPlayers,
    revealUserHand,
    sortUserHand,
    playCard,
    completeTrick,
    hideOpponentHands,
  }
}
