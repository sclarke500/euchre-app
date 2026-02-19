import {
  PresidentPhase,
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
  events: Pick<PresidentGameEvents, 'onAwaitingGiveCards' | 'onCardExchangeInfo' | 'onExchangeComplete'>
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
  // Staged exchanges waiting to be executed
  const stagedExchanges: StagedExchange[] = []
  // Players we're waiting for selections from
  const pendingSelections = new Map<number, { cardsToGive: number; recipientSeat: number }>()

  /**
   * Start the card selection phase.
   * - Auto-stage Scum/ViceScum's best cards
   * - Prompt President/VP to select cards (or auto-select for AI)
   */
  function startCardSelecting(): void {
    stagedExchanges.length = 0
    pendingSelections.clear()

    const president = deps.players.find(p => p.rank === 1)
    const scum = deps.players.find(p => p.rank === 4)
    const vp = deps.players.find(p => p.rank === 2)
    const viceScum = deps.players.find(p => p.cardsToGive === 1 && p.rank === 3)

    // Stage Scum's best cards for President (auto-selected)
    if (president && scum) {
      const scumBestCards = chooseCardsToGive(toPresidentPlayer(scum), 2)
      stagedExchanges.push({
        giverSeat: scum.seatIndex,
        recipientSeat: president.seatIndex,
        cards: scumBestCards,
      })
      console.log(`[CardExchange] Staged: ${scum.name} → ${president.name}:`, scumBestCards.map(c => c.id))

      // President needs to select cards to give back
      pendingSelections.set(president.seatIndex, {
        cardsToGive: 2,
        recipientSeat: scum.seatIndex,
      })
    }

    // Stage ViceScum's best card for VP (auto-selected)
    if (vp && viceScum) {
      const viceScumBestCards = chooseCardsToGive(toPresidentPlayer(viceScum), 1)
      stagedExchanges.push({
        giverSeat: viceScum.seatIndex,
        recipientSeat: vp.seatIndex,
        cards: viceScumBestCards,
      })
      console.log(`[CardExchange] Staged: ${viceScum.name} → ${vp.name}:`, viceScumBestCards.map(c => c.id))

      // VP needs to select card to give back
      pendingSelections.set(vp.seatIndex, {
        cardsToGive: 1,
        recipientSeat: viceScum.seatIndex,
      })
    }

    deps.setPhase(PresidentPhase.CardSelecting)
    deps.broadcastState()

    // Process AI selections and send prompts to humans
    for (const [seatIndex, info] of pendingSelections) {
      const player = deps.players[seatIndex]
      if (!player) continue

      if (player.isHuman && player.odusId) {
        // Send prompt to human
        const roleNames: Record<number, string> = { 1: 'President', 2: 'Vice President' }
        const yourRole = roleNames[player.rank ?? 0] ?? 'Unknown'
        const recipient = deps.players[info.recipientSeat]
        deps.events.onAwaitingGiveCards(player.odusId, info.cardsToGive, [], yourRole, recipient?.name ?? 'opponent')
      } else {
        // AI auto-selects lowest cards
        const cardsToGive = getLowestCards(player.hand, info.cardsToGive)
        setTimeout(() => {
          submitSelection(seatIndex, cardsToGive)
        }, 300)
      }
    }

    // If no selections needed (all AI or no exchange), go directly to distributing
    if (pendingSelections.size === 0) {
      executeDistribution()
    }
  }

  /**
   * Submit a player's card selection.
   */
  function submitSelection(seatIndex: number, cards: StandardCard[]): boolean {
    const pending = pendingSelections.get(seatIndex)
    if (!pending) {
      console.warn(`[CardExchange] submitSelection: player ${seatIndex} not pending`)
      return false
    }

    if (cards.length !== pending.cardsToGive) {
      console.warn(`[CardExchange] submitSelection: wrong count ${cards.length} != ${pending.cardsToGive}`)
      return false
    }

    const player = deps.players[seatIndex]
    if (!player) return false

    // Verify cards are in hand
    const cardIds = new Set(cards.map(c => c.id))
    const hasAll = cards.every(c => player.hand.some(h => h.id === c.id))
    if (!hasAll) {
      console.warn(`[CardExchange] submitSelection: player doesn't have all cards`)
      return false
    }

    // Stage this exchange
    stagedExchanges.push({
      giverSeat: seatIndex,
      recipientSeat: pending.recipientSeat,
      cards: cards,
    })
    console.log(`[CardExchange] Staged: ${player.name} → seat ${pending.recipientSeat}:`, cards.map(c => c.id))

    pendingSelections.delete(seatIndex)

    // If all selections are in, execute the distribution
    if (pendingSelections.size === 0) {
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
    deps.setPhase(PresidentPhase.CardDistributing)
    deps.broadcastState()

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

      // Notify player of their exchange
      if (player.isHuman && player.odusId) {
        deps.events.onExchangeComplete(player.odusId, changes.gives, changes.receives)
      }
    }

    deps.broadcastState()

    // Short delay for animation, then start playing
    setTimeout(() => {
      finishExchange()
    }, 800)
  }

  /**
   * Finish exchange and start playing.
   */
  function finishExchange(): void {
    const scum = deps.players.find(p => p.rank === 4)
    deps.setCurrentPlayer(scum?.seatIndex ?? 0)
    deps.setPhase(PresidentPhase.Playing)
    stagedExchanges.length = 0
    deps.broadcastState()
    deps.processCurrentTurn()
  }

  /**
   * Get pending selection info for a player (used for state resync).
   */
  function getPendingSelection(seatIndex: number) {
    return pendingSelections.get(seatIndex)
  }

  /**
   * Check if a player has a pending selection.
   */
  function hasPendingSelection(seatIndex: number): boolean {
    return pendingSelections.has(seatIndex)
  }

  return {
    startCardSelecting,
    submitSelection,
    getPendingSelection,
    hasPendingSelection,
  }
}
