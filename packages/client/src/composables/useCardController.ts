import { ref, type Ref, nextTick } from 'vue'
import { computeTableLayout, type TableLayoutResult } from './useTableLayout'
import type { CardTableEngine } from './useCardTable'
import type { StandardCard } from '@euchre/shared'
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
  userSeatIndex?: number
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
}

export interface DealOptions {
  revealUserHand?: boolean
  focusUserHand?: boolean
  dealDelayMs?: number
  dealFlightMs?: number
  fanDurationMs?: number
  sortUserHand?: (cards: StandardCard[]) => StandardCard[]
  sortAfterDeal?: boolean
}

export function useCardController(
  engine: CardTableEngine,
  boardRef: Ref<HTMLElement | null>,
  config: CardControllerConfig
) {
  const layoutType = config.layout ?? 'normal'
  const userSeatIndex = config.userSeatIndex ?? 0
  const playAreaMode = config.playAreaMode ?? 'trick'
  const trickCompleteMode = config.trickCompleteMode ?? 'stack'
  const playerIdToSeatIndex = config.playerIdToSeatIndex ?? ((id) => id)

  const tableCenter = ref({ x: 0, y: 0 })
  const tableLayout = ref<TableLayoutResult | null>(null)
  const tricksWonByPlayer = ref<Record<number, number>>({})

  function setupTable() {
    engine.reset()

    const board = boardRef.value
    if (!board) return null

    const layout = computeTableLayout(board.offsetWidth, board.offsetHeight, layoutType, config.playerCount)
    tableLayout.value = layout
    tableCenter.value = layout.tableCenter

    engine.createDeck({ x: tableCenter.value.x, y: tableCenter.value.y }, 0.8)

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

  async function dealFromPlayers(players: Array<{ hand: StandardCard[] }>, options: DealOptions = {}) {
    const board = boardRef.value
    if (!board) return

    const deck = engine.getDeck()
    const hands = engine.getHands()
    if (!deck || hands.length === 0) return

    const revealUserHand = options.revealUserHand ?? true
    const focusUserHand = options.focusUserHand ?? true

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

    const maxCards = Math.max(...players.map(p => p.hand.length))
    const dealQueue: { seatIdx: number; card: StandardCard }[] = []

    for (let round = 0; round < maxCards; round++) {
      for (let seatIdx = 0; seatIdx < config.playerCount; seatIdx++) {
        const card = players[seatIdx]?.hand[round]
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

  async function sortUserHand(sorter: (cards: StandardCard[]) => StandardCard[], duration: number = 300) {
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
      const current = ref.getPosition()
      const target = userHand.getCardPosition(index)
      return ref.moveTo({ ...target, flipY: current.flipY }, duration)
    })

    await Promise.all(moves)
  }

  async function revealUserHand(duration: number = 350) {
    const userHand = engine.getHands()[userSeatIndex]
    if (!userHand) return

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

  async function playCard(cardId: string, playerId: number, cardIndex: number) {
    const pile = engine.getPiles().find(p => p.id === 'center')
    const fromHand = engine.getHands().find(h => h.id === `hand-${playerIdToSeatIndex(playerId)}`)
    if (!pile || !fromHand) return

    const target = playAreaMode === 'overlay'
      ? getOverlayCardPosition(cardIndex, 0, 1)
      : getTrickCardPosition(playerId, cardIndex)

    await engine.moveCard(cardId, fromHand, pile, target, 300)

    // Brief pause, then refan to close the gap after the card leaves the hand.
    const refanDelay = config.playRefanDelayMs ?? 120
    const refanDuration = config.playRefanDurationMs ?? 200
    if (fromHand.cards.length > 0) {
      await new Promise(r => setTimeout(r, refanDelay))
      fromHand.mode = 'fanned'
      const moves = fromHand.cards.map((managed, index) => {
        const ref = engine.getCardRef(managed.card.id)
        if (!ref) return null
        const current = ref.getPosition()
        const target = fromHand.getCardPosition(index)
        return ref.moveTo({ ...target, flipY: current.flipY }, refanDuration)
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

    if (trickCompleteMode === 'sweep') {
      const board = boardRef.value
      if (!board) return

      const offX = board.offsetWidth + 200
      const offY = (tableLayout.value?.tableCenter ?? tableCenter.value).y
      const moves = pile.cards.map((managed, i) => {
        const ref = engine.getCardRef(managed.card.id)
        return ref?.moveTo({
          x: offX,
          y: offY,
          rotation: 20,
          zIndex: 100 + i,
          scale: 0.6,
        }, 300)
      })
      await Promise.all(moves)
      pile.clear()
      engine.refreshCards()
      return
    }

    const tricksWon = tricksWonByPlayer.value[winnerId] ?? 0
    const targetPile = engine.getPiles().find(p => p.id === `tricks-won-player-${playerIdToSeatIndex(winnerId)}`)
    if (!targetPile) return

    const cardsToMove = [...pile.cards]
    const movePromises = cardsToMove.map((managed, index) => {
      const targetPos = getPlayerTrickPosition(winnerId, tricksWon, index)
      return engine.moveCard(managed.card.id, pile, targetPile, targetPos, 300)
    })

    await Promise.all(movePromises)
    tricksWonByPlayer.value = {
      ...tricksWonByPlayer.value,
      [winnerId]: tricksWon + 1,
    }
    engine.refreshCards()
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
  }
}
