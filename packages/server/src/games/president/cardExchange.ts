import {
  PresidentPhase,
  PlayerRank,
  chooseCardsToGive,
  getLowestCards,
  type PresidentPlayer,
  type StandardCard,
} from '@67cards/shared'
import type { PresidentGameEvents, PresidentGamePlayer } from './types.js'

interface StagedExchange {
  giverSeat: number
  recipientSeat: number
  cards: StandardCard[]
}

interface PresidentCardExchangeDeps {
  players: PresidentGamePlayer[]
  getPhase: () => PresidentPhase
  setPhase: (phase: PresidentPhase) => void
  setCurrentPlayer: (seatIndex: number) => void
  broadcastState: () => void
  processCurrentTurn: () => void
  events: Pick<PresidentGameEvents, 'onExchangePrompt' | 'onExchangeComplete'>
}

interface PlayerExchangeInfo {
  seatIndex: number
  canSelect: boolean          // true = needs to pick cards (President/VP), false = pre-selected (Scum/ViceScum)
  cardsNeeded: number         // How many cards to give (0 for Scum/ViceScum since pre-selected)
  preSelectedCards: StandardCard[]  // For Scum/ViceScum: their best cards. For Pres/VP: empty
  recipientSeat: number       // Who they're exchanging with
  confirmed: boolean          // Has player clicked Exchange?
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
  // Players participating in exchange and their info
  const exchangeParticipants = new Map<number, PlayerExchangeInfo>()
  // Staged exchanges waiting to be executed (filled as players confirm)
  const stagedExchanges: StagedExchange[] = []

  /**
   * Start the card exchange phase.
   * All 4 players get prompted simultaneously — Scum/ViceScum with pre-selected cards,
   * President/VP with empty selection.
   */
  function startExchange(): void {
    stagedExchanges.length = 0
    exchangeParticipants.clear()

    const president = deps.players.find(p => p.rank === PlayerRank.President)
    const scum = deps.players.find(p => p.rank === PlayerRank.Scum)
    const vp = deps.players.find(p => p.rank === PlayerRank.VicePresident)
    const viceScum = deps.players.find(p => p.rank === PlayerRank.ViceScum)

    // Set up President ↔ Scum exchange
    if (president && scum) {
      const scumBestCards = chooseCardsToGive(toPresidentPlayer(scum), 2)
      
      // Scum: pre-selected, can't change
      exchangeParticipants.set(scum.seatIndex, {
        seatIndex: scum.seatIndex,
        canSelect: false,
        cardsNeeded: 0,
        preSelectedCards: scumBestCards,
        recipientSeat: president.seatIndex,
        confirmed: false,
      })
      console.log(`[CardExchange] Scum (${scum.name}) pre-selected:`, scumBestCards.map(c => c.id))

      // President: needs to select 2 cards
      exchangeParticipants.set(president.seatIndex, {
        seatIndex: president.seatIndex,
        canSelect: true,
        cardsNeeded: 2,
        preSelectedCards: [],
        recipientSeat: scum.seatIndex,
        confirmed: false,
      })
    }

    // Set up VP ↔ ViceScum exchange
    if (vp && viceScum) {
      const viceScumBestCards = chooseCardsToGive(toPresidentPlayer(viceScum), 1)
      
      // ViceScum: pre-selected, can't change
      exchangeParticipants.set(viceScum.seatIndex, {
        seatIndex: viceScum.seatIndex,
        canSelect: false,
        cardsNeeded: 0,
        preSelectedCards: viceScumBestCards,
        recipientSeat: vp.seatIndex,
        confirmed: false,
      })
      console.log(`[CardExchange] ViceScum (${viceScum.name}) pre-selected:`, viceScumBestCards.map(c => c.id))

      // VP: needs to select 1 card
      exchangeParticipants.set(vp.seatIndex, {
        seatIndex: vp.seatIndex,
        canSelect: true,
        cardsNeeded: 1,
        preSelectedCards: [],
        recipientSeat: viceScum.seatIndex,
        confirmed: false,
      })
    }

    deps.setPhase(PresidentPhase.CardExchange)
    deps.broadcastState()

    // Send prompts to all participants
    for (const [seatIndex, info] of exchangeParticipants) {
      const player = deps.players[seatIndex]
      if (!player) continue

      const recipient = deps.players[info.recipientSeat]
      
      if (player.isHuman && player.odusId) {
        // Send prompt to human
        deps.events.onExchangePrompt(player.odusId, {
          canSelect: info.canSelect,
          cardsNeeded: info.cardsNeeded,
          preSelectedCardIds: info.preSelectedCards.map(c => c.id),
          recipientName: recipient?.name ?? 'opponent',
        })
      } else {
        // AI auto-confirms immediately
        setTimeout(() => {
          if (info.canSelect) {
            // AI President/VP: select lowest cards
            const cardsToGive = getLowestCards(player.hand, info.cardsNeeded)
            confirmExchange(seatIndex, cardsToGive.map(c => c.id))
          } else {
            // AI Scum/ViceScum: just confirm (cards already pre-selected)
            confirmExchange(seatIndex, info.preSelectedCards.map(c => c.id))
          }
        }, 300)
      }
    }

    // Edge case: no participants (shouldn't happen in 4-player)
    if (exchangeParticipants.size === 0) {
      finishExchange()
    }
  }

  /**
   * Player confirms their exchange (clicks Exchange button).
   * For President/VP: cardIds are the cards they selected to give.
   * For Scum/ViceScum: cardIds should match their pre-selected cards.
   */
  function confirmExchange(seatIndex: number, cardIds: string[]): boolean {
    const info = exchangeParticipants.get(seatIndex)
    if (!info) {
      console.warn(`[CardExchange] confirmExchange: player ${seatIndex} not participating`)
      return false
    }

    if (info.confirmed) {
      console.warn(`[CardExchange] confirmExchange: player ${seatIndex} already confirmed`)
      return false
    }

    const player = deps.players[seatIndex]
    if (!player) return false

    let cardsToGive: StandardCard[]

    if (info.canSelect) {
      // President/VP: validate their selection
      if (cardIds.length !== info.cardsNeeded) {
        console.warn(`[CardExchange] confirmExchange: wrong count ${cardIds.length} != ${info.cardsNeeded}`)
        return false
      }

      // Find cards in hand
      cardsToGive = []
      for (const cardId of cardIds) {
        const card = player.hand.find(c => c.id === cardId)
        if (!card) {
          console.warn(`[CardExchange] confirmExchange: card ${cardId} not in hand`)
          return false
        }
        cardsToGive.push(card)
      }
    } else {
      // Scum/ViceScum: use pre-selected cards (ignore cardIds param)
      cardsToGive = info.preSelectedCards
    }

    // Stage the exchange
    stagedExchanges.push({
      giverSeat: seatIndex,
      recipientSeat: info.recipientSeat,
      cards: cardsToGive,
    })
    console.log(`[CardExchange] Staged: ${player.name} → seat ${info.recipientSeat}:`, cardsToGive.map(c => c.id))

    info.confirmed = true

    // Check if all participants have confirmed
    const allConfirmed = Array.from(exchangeParticipants.values()).every(p => p.confirmed)
    if (allConfirmed) {
      setTimeout(() => {
        executeDistribution()
      }, 100)
    }

    return true
  }

  /**
   * Execute all staged exchanges simultaneously.
   */
  function executeDistribution(): void {
    console.log(`[CardExchange] Executing ${stagedExchanges.length} exchanges`)

    // Build a map of what each player gives and receives
    const playerChanges = new Map<number, { gives: StandardCard[]; receives: StandardCard[] }>()

    for (const exchange of stagedExchanges) {
      // Giver loses cards
      if (!playerChanges.has(exchange.giverSeat)) {
        playerChanges.set(exchange.giverSeat, { gives: [], receives: [] })
      }
      playerChanges.get(exchange.giverSeat)!.gives.push(...exchange.cards)

      // Recipient gains cards
      if (!playerChanges.has(exchange.recipientSeat)) {
        playerChanges.set(exchange.recipientSeat, { gives: [], receives: [] })
      }
      playerChanges.get(exchange.recipientSeat)!.receives.push(...exchange.cards)
    }

    // Apply all changes
    for (const [seatIndex, changes] of playerChanges) {
      const player = deps.players[seatIndex]
      if (!player) continue

      const giveIds = new Set(changes.gives.map(c => c.id))
      player.hand = player.hand.filter(c => !giveIds.has(c.id))
      player.hand.push(...changes.receives)

      console.log(`[CardExchange] ${player.name}: gave ${changes.gives.length}, received ${changes.receives.length}, hand now ${player.hand.length}`)

      // Notify player of their exchange results
      if (player.isHuman && player.odusId) {
        deps.events.onExchangeComplete(player.odusId, changes.gives, changes.receives)
      }
    }

    deps.broadcastState()

    // Short delay for animation, then start playing
    setTimeout(() => {
      finishExchange()
    }, 1500)  // Longer delay for card animations
  }

  /**
   * Finish exchange and start playing.
   */
  function finishExchange(): void {
    const scum = deps.players.find(p => p.rank === PlayerRank.Scum)
    deps.setCurrentPlayer(scum?.seatIndex ?? 0)
    deps.setPhase(PresidentPhase.Playing)
    stagedExchanges.length = 0
    exchangeParticipants.clear()
    deps.broadcastState()
    deps.processCurrentTurn()
  }

  /**
   * Get exchange info for a player (used for state resync).
   */
  function getExchangeInfo(seatIndex: number): PlayerExchangeInfo | undefined {
    return exchangeParticipants.get(seatIndex)
  }

  /**
   * Check if a player is participating in exchange.
   */
  function isParticipating(seatIndex: number): boolean {
    return exchangeParticipants.has(seatIndex)
  }

  /**
   * Check if a player has confirmed their exchange.
   */
  function hasConfirmed(seatIndex: number): boolean {
    return exchangeParticipants.get(seatIndex)?.confirmed ?? false
  }

  return {
    startExchange,
    confirmExchange,
    getExchangeInfo,
    isParticipating,
    hasConfirmed,
  }
}
