import { ref, type Ref, nextTick } from 'vue'
import { computeTableLayout } from './useTableLayout'
import type { CardTableEngine } from './useCardTable'
import type { StandardCard } from '@67cards/shared'
import { CardTimings } from '@/utils/animationTimings'

export interface TrickTableConfig {
  layout?: 'normal' | 'wide'
  playerCount: number
  userSeatIndex?: number
  userHandScale?: number
  opponentHandScale?: number
  userFanSpacing?: number
  opponentFanSpacing?: number
  userFanCurve?: number
}

export interface DealOptions {
  revealUserHand?: boolean
  focusUserHand?: boolean
  dealDelayMs?: number
  dealFlightMs?: number
  sortUserHand?: (cards: StandardCard[]) => StandardCard[]
  sortAfterDeal?: boolean
}

export function useTrickTable(
  engine: CardTableEngine,
  boardRef: Ref<HTMLElement | null>,
  config: TrickTableConfig
) {
  const layoutType = config.layout ?? 'normal'
  const userSeatIndex = config.userSeatIndex ?? 0
  const tableCenter = ref({ x: 0, y: 0 })

  function setupTable() {
    engine.reset()

    const board = boardRef.value
    if (!board) return null

    const layout = computeTableLayout(board.offsetWidth, board.offsetHeight, layoutType, config.playerCount)
    tableCenter.value = layout.tableCenter

    engine.createDeck({ x: tableCenter.value.x, y: tableCenter.value.y }, 0.8)

    for (let i = 0; i < config.playerCount; i++) {
      const seat = layout.seats[i]!
      engine.createHand(`hand-${i}`, seat.handPosition, {
        fanSpacing: seat.isUser ? (config.userFanSpacing ?? 30) : (config.opponentFanSpacing ?? 16),
        faceUp: false,
        rotation: seat.rotation,
        scale: seat.isUser ? (config.userHandScale ?? 1.0) : (config.opponentHandScale ?? 0.7),
        fanCurve: seat.isUser ? (config.userFanCurve ?? 0) : 0,
        angleToCenter: seat.angleToCenter,
        isUser: seat.isUser,
      })
    }

    engine.createPile('center', { x: tableCenter.value.x, y: tableCenter.value.y }, 0.8)
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
      const targetX = board.offsetWidth / 2
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
          }, CardTimings.move)
        }
      }
      await new Promise(r => setTimeout(r, CardTimings.move))
    }

    for (const hand of hands) {
      if (hand.id !== `hand-${userSeatIndex}`) {
        hand.scale = config.opponentHandScale ?? 0.7
      }
    }

    await Promise.all(hands.map(hand => hand.setMode('fanned', CardTimings.fan)))

    if (options.sortUserHand && options.sortAfterDeal !== false) {
      await sortUserHand(options.sortUserHand, CardTimings.sort)
    }
  }

  async function sortUserHand(sorter: (cards: StandardCard[]) => StandardCard[], duration: number = CardTimings.sort) {
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

  async function revealUserHandInternal(duration: number = CardTimings.reveal) {
    const userHand = engine.getHands()[userSeatIndex]
    if (!userHand) return

    const moves = userHand.cards.map(managed => {
      const ref = engine.getCardRef(managed.card.id)
      if (!ref) return null
      const pos = ref.getPosition()
      return ref.moveTo({ ...pos, flipY: 180 }, duration)
    })

    await Promise.all(moves)
  }

  async function revealUserHand(duration: number = CardTimings.reveal) {
    await revealUserHandInternal(duration)
  }

  return {
    tableCenter,
    setupTable,
    dealFromPlayers,
    revealUserHand,
    sortUserHand,
  }
}
