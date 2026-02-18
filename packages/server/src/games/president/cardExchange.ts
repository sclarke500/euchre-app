import {
  PresidentPhase,
  chooseCardsToGive,
  getLowestCards,
  type PresidentPlayer,
  type StandardCard,
} from '@67cards/shared'
import type { PresidentGameEvents, PresidentGamePlayer } from './types.js'

interface PresidentCardExchangeDeps {
  players: PresidentGamePlayer[]
  pendingExchangeReceivedCards: Map<number, StandardCard[]>
  getPhase: () => PresidentPhase
  setPhase: (phase: PresidentPhase) => void
  getAwaitingGiveCards: () => number | null
  setAwaitingGiveCards: (seatIndex: number | null) => void
  setCurrentPlayer: (seatIndex: number) => void
  broadcastState: () => void
  processCurrentTurn: () => void
  events: Pick<PresidentGameEvents, 'onAwaitingGiveCards' | 'onCardExchangeInfo'>
}

function toPresidentPlayer(player: PresidentGamePlayer): PresidentPlayer {
  return {
    id: player.seatIndex,
    name: player.name,
    hand: player.hand,
    isHuman: player.isHuman,
    rank: player.rank,
    finishOrder: player.finishOrder,
    cardsToGive: player.cardsToGive,
    cardsToReceive: player.cardsToReceive,
  }
}

export function createPresidentCardExchangeController(deps: PresidentCardExchangeDeps) {
  const finishCardExchange = (): void => {
    const scum = deps.players.find((player) => player.rank === 4)
    deps.setCurrentPlayer(scum?.seatIndex ?? 0)
    deps.setPhase(PresidentPhase.Playing)
    deps.pendingExchangeReceivedCards.clear()
    deps.broadcastState()
    deps.processCurrentTurn()
  }

  const startGiveBackPhase = (playerSeatIndex: number): void => {
    const player = deps.players[playerSeatIndex]
    if (!player) {
      finishCardExchange()
      return
    }

    const cardsToGive = player.rank === 1 ? 2 : 1
    const receivedCards = deps.pendingExchangeReceivedCards.get(playerSeatIndex) ?? []
    const roleNames: Record<number, string> = { 1: 'President', 2: 'Vice President' }
    const yourRole = roleNames[player.rank ?? 0] ?? 'Unknown'

    if (player.isHuman && player.odusId) {
      deps.setPhase(PresidentPhase.PresidentGiving)
      deps.setAwaitingGiveCards(playerSeatIndex)

      deps.events.onAwaitingGiveCards(player.odusId, cardsToGive, receivedCards, yourRole)
      deps.broadcastState()
      return
    }

    const cardsToGiveBack = getLowestCards(player.hand, cardsToGive)
    setTimeout(() => {
      completeGiveBack(playerSeatIndex, cardsToGiveBack)
    }, 500)
  }

  const completeGiveBack = (playerSeatIndex: number, cards: StandardCard[]): void => {
    const player = deps.players[playerSeatIndex]
    if (!player) {
      console.error('completeGiveBack: player not found for seatIndex', playerSeatIndex)
      return
    }

    let recipient: PresidentGamePlayer | undefined
    if (player.rank === 1) {
      recipient = deps.players.find((candidate) => candidate.rank === 4)
    } else if (player.rank === 2) {
      recipient = deps.players.find((candidate) => candidate.cardsToGive === 1 && candidate.rank === 3)
    }

    if (recipient) {
      const cardIds = new Set(cards.map((card) => card.id))
      player.hand = player.hand.filter((card) => !cardIds.has(card.id))
      recipient.hand = [...recipient.hand, ...cards]

      const receivedCards = deps.pendingExchangeReceivedCards.get(playerSeatIndex) ?? []
      const roleNames: Record<number, string> = {
        1: 'President',
        2: 'Vice President',
        3: 'Citizen',
        4: 'Scum',
      }

      if (player.isHuman && player.odusId) {
        deps.events.onCardExchangeInfo(
          player.odusId,
          cards,
          receivedCards,
          recipient.name,
          roleNames[player.rank ?? 0] ?? 'Unknown'
        )
      }

      if (recipient.isHuman && recipient.odusId) {
        const scumGave = receivedCards
        deps.events.onCardExchangeInfo(
          recipient.odusId,
          scumGave,
          cards,
          player.name,
          roleNames[recipient.rank ?? 0] ?? 'Scum'
        )
      }
    } else {
      console.error('completeGiveBack: NO RECIPIENT FOUND! Cards not transferred!', {
        playerRank: player.rank,
        allPlayers: deps.players.map((candidate) => ({
          name: candidate.name,
          rank: candidate.rank,
          seatIndex: candidate.seatIndex,
        })),
      })
    }

    deps.setAwaitingGiveCards(null)
    deps.broadcastState()

    const vp = deps.players.find((candidate) => candidate.rank === 2)
    if (player.rank === 1 && vp && deps.pendingExchangeReceivedCards.has(vp.seatIndex)) {
      setTimeout(() => {
        startGiveBackPhase(vp.seatIndex)
      }, 500)
      return
    }

    setTimeout(() => {
      finishCardExchange()
    }, 1500)
  }

  const giveCards = (playerSeatIndex: number, cards: StandardCard[]): void => {
    if (deps.getPhase() !== PresidentPhase.PresidentGiving) {
      console.warn('giveCards called but not in PresidentGiving phase')
      return
    }

    if (deps.getAwaitingGiveCards() !== playerSeatIndex) {
      console.warn('giveCards called by wrong player')
      return
    }

    const player = deps.players[playerSeatIndex]
    if (!player) return

    const expectedCount = player.rank === 1 ? 2 : 1
    if (cards.length !== expectedCount) {
      console.warn(`Expected ${expectedCount} cards but got ${cards.length}`)
      return
    }

    const hasAllCards = cards.every((card) => player.hand.some((handCard) => handCard.id === card.id))
    if (!hasAllCards) {
      console.warn('Player does not have all submitted cards')
      return
    }

    completeGiveBack(playerSeatIndex, cards)
  }

  const processCardExchange = (): void => {
    try {
      const president = deps.players.find((player) => player.rank === 1)
      const scum = deps.players.find((player) => player.rank === 4)
      const vp = deps.players.find((player) => player.rank === 2)
      const viceScum = deps.players.find((player) => player.cardsToGive === 1 && player.rank === 3)

      deps.pendingExchangeReceivedCards.clear()

      if (president && scum) {
        const scumCards = chooseCardsToGive(toPresidentPlayer(scum), 2)
        const scumCardIds = new Set(scumCards.map((card) => card.id))

        scum.hand = scum.hand.filter((card) => !scumCardIds.has(card.id))
        president.hand = [...president.hand, ...scumCards]

        deps.pendingExchangeReceivedCards.set(president.seatIndex, scumCards)
        
        // Notify Scum immediately that their cards were taken
        // (they'll get the full exchange info later when President gives cards back)
        if (scum.isHuman && scum.odusId) {
          deps.events.onCardExchangeInfo(
            scum.odusId,
            scumCards,           // youGive - cards taken from Scum
            [],                  // youReceive - not yet, waiting for President
            president.name,
            'Scum'
          )
        }
      }

      if (vp && viceScum) {
        const viceScumCards = chooseCardsToGive(toPresidentPlayer(viceScum), 1)
        const viceScumCardIds = new Set(viceScumCards.map((card) => card.id))

        viceScum.hand = viceScum.hand.filter((card) => !viceScumCardIds.has(card.id))
        vp.hand = [...vp.hand, ...viceScumCards]

        deps.pendingExchangeReceivedCards.set(vp.seatIndex, viceScumCards)
        
        // Notify ViceScum immediately that their card was taken
        if (viceScum.isHuman && viceScum.odusId) {
          deps.events.onCardExchangeInfo(
            viceScum.odusId,
            viceScumCards,       // youGive - card taken from ViceScum
            [],                  // youReceive - not yet, waiting for VP
            vp.name,
            'Citizen'
          )
        }
      }

      deps.broadcastState()

      if (president) {
        startGiveBackPhase(president.seatIndex)
      } else {
        finishCardExchange()
      }
    } catch (error) {
      console.error('Error in processCardExchange:', error)
      console.error(
        'Players state:',
        JSON.stringify(
          deps.players.map((player) => ({
            id: player.seatIndex,
            name: player.name,
            rank: player.rank,
            handSize: player.hand.length,
            cardsToGive: player.cardsToGive,
            cardsToReceive: player.cardsToReceive,
          })),
          null,
          2
        )
      )
      throw error
    }
  }

  return {
    processCardExchange,
    startGiveBackPhase,
    giveCards,
    completeGiveBack,
    finishCardExchange,
  }
}
