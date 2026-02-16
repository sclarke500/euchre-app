/**
 * Unified Game Adapter
 *
 * Provides a common interface for both single-player and multiplayer game modes.
 * Components use this adapter instead of directly accessing game stores,
 * allowing a single UI to work for both modes.
 */

import { computed, type ComputedRef, type Ref } from 'vue'
import { useEuchreGameStore } from './euchreGameStore'
import { useEuchreMultiplayerStore } from './euchreMultiplayerStore'
import { GamePhase, Suit, Rank, BidAction, getLegalPlays } from '@67cards/shared'
import type { Card, Trick, TeamScore, Bid, ServerMessage } from '@67cards/shared'

// Euchre adapter player interface that works for both modes
export interface EuchreAdapterPlayer {
  id: number
  name: string
  hand: Card[]
  handSize: number
  isHuman: boolean
  teamId: number
}

// Euchre trump info interface
export interface EuchreTrumpInfo {
  suit: Suit
  calledBy: number
  goingAlone: boolean
}

// Euchre game adapter interface
export interface EuchreGameAdapter {
  // Game state
  phase: ComputedRef<GamePhase>
  players: ComputedRef<EuchreAdapterPlayer[]>
  currentPlayer: ComputedRef<number>
  scores: ComputedRef<TeamScore[]>
  currentTrick: ComputedRef<Trick>
  trump: ComputedRef<EuchreTrumpInfo | null>
  turnUpCard: ComputedRef<Card | null>
  biddingRound: ComputedRef<1 | 2 | null>
  dealer: ComputedRef<number>
  gameOver: ComputedRef<boolean>
  winner: ComputedRef<number | null>
  tricksTaken: ComputedRef<[number, number]>
  tricksWonByPlayer: ComputedRef<Record<number, number>> // playerId -> tricks won
  lastTrickWinnerId: ComputedRef<number | null> // winnerId of most recent completed trick

  // Player-specific state
  myPlayerId: ComputedRef<number>
  myHand: ComputedRef<Card[]>
  myTeamId: ComputedRef<number>
  isMyTurn: ComputedRef<boolean>
  validCards: ComputedRef<string[]>

  // UI state
  lastBidAction: ComputedRef<{ playerId: number; message: string } | null>

  // Mode info
  isMultiplayer: boolean

  // Actions
  makeBid: (bid: Bid | BidAction, suit?: Suit, goingAlone?: boolean) => void
  playCard: (card: Card | string) => void
  discardCard: (card: Card | string) => void
  
  // Multiplayer-specific
  requestResync?: () => void

  // Queue control (multiplayer only — for director processing loop)
  enableQueueMode?: () => void
  disableQueueMode?: () => void
  dequeueMessage?: () => ServerMessage | null
  getQueueLength?: () => number
  applyMessage?: (message: ServerMessage) => void
}

function createEmptyTrick(): Trick {
  return { cards: [], leadingSuit: null, winnerId: null }
}

export function useEuchreGameAdapter(mode: 'singleplayer' | 'multiplayer'): EuchreGameAdapter {
  if (mode === 'multiplayer') {
    return createMultiplayerAdapter()
  }
  return createSinglePlayerAdapter()
}

function createSinglePlayerAdapter(): EuchreGameAdapter {
  const store = useEuchreGameStore()

  const players = computed<EuchreAdapterPlayer[]>(() => {
    return store.players.map(p => ({
      id: p.id,
      name: p.name,
      hand: p.hand,
      handSize: p.hand.length,
      isHuman: p.isHuman,
      teamId: p.teamId,
    }))
  })

  const trump = computed<EuchreTrumpInfo | null>(() => {
    const round = store.currentRound
    if (!round?.trump) return null
    return {
      suit: round.trump.suit,
      calledBy: round.trump.calledBy,
      goingAlone: round.trump.goingAlone,
    }
  })

  const turnUpCard = computed(() => store.currentRound?.turnUpCard ?? null)
  const biddingRound = computed(() => store.currentRound?.biddingRound ?? null)
  const dealer = computed(() => store.currentRound?.dealer ?? 0)

  const tricksTaken = computed<[number, number]>(() => {
    const tricks = store.currentRound?.tricks ?? []
    let team0 = 0
    let team1 = 0
    for (const trick of tricks) {
      if (trick.winnerId !== null) {
        if (trick.winnerId % 2 === 0) team0++
        else team1++
      }
    }
    return [team0, team1]
  })

  const tricksWonByPlayer = computed<Record<number, number>>(() => {
    const tricks = store.currentRound?.tricks ?? []
    const result: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
    for (const trick of tricks) {
      if (trick.winnerId !== null) {
        result[trick.winnerId] = (result[trick.winnerId] ?? 0) + 1
      }
    }
    return result
  })

  const lastTrickWinnerId = computed<number | null>(() => {
    const tricks = store.currentRound?.tricks ?? []
    if (tricks.length === 0) return null
    const lastTrick = tricks[tricks.length - 1]
    return lastTrick?.winnerId ?? null
  })

  const myPlayerId = computed(() => 0) // Human is always player 0 in single-player
  const myHand = computed(() => store.players[0]?.hand ?? [])
  const myTeamId = computed(() => 0) // Human is always team 0 in single-player

  const isMyTurn = computed(() => store.currentPlayer === 0)

  const currentTrick = computed(() => store.currentTrick ?? createEmptyTrick())

  // Compute valid cards based on the current trick and trump
  const validCards = computed(() => {
    if (!isMyTurn.value) return []
    const trumpSuit = trump.value?.suit
    if (!trumpSuit) return myHand.value.map(c => c.id) // No trump yet, all cards valid
    const legalCards = getLegalPlays(myHand.value, currentTrick.value, trumpSuit)
    return legalCards.map(c => c.id)
  })

  const lastBidAction = computed(() => store.lastAIBidAction)

  return {
    phase: computed(() => store.phase),
    players,
    currentPlayer: computed(() => store.currentPlayer),
    scores: computed(() => store.scores),
    currentTrick,
    trump,
    turnUpCard,
    biddingRound,
    dealer,
    gameOver: computed(() => store.gameOver),
    winner: computed(() => store.winner),
    tricksTaken,
    tricksWonByPlayer,
    lastTrickWinnerId,
    myPlayerId,
    myHand,
    myTeamId,
    isMyTurn,
    validCards,
    lastBidAction,
    isMultiplayer: false,

    makeBid: (bid: Bid | BidAction, suit?: Suit, goingAlone?: boolean) => {
      if (typeof bid === 'object') {
        store.makeBid(bid)
      } else {
        // Convert BidAction to Bid object
        store.makeBid({
          playerId: 0,
          action: bid,
          suit,
          goingAlone,
        })
      }
    },

    playCard: (card: Card | string) => {
      if (typeof card === 'string') {
        const foundCard = myHand.value.find(c => c.id === card)
        if (foundCard) {
          store.playCard(foundCard, 0)
        }
      } else {
        store.playCard(card, 0)
      }
    },

    discardCard: (card: Card | string) => {
      if (typeof card === 'string') {
        const foundCard = myHand.value.find(c => c.id === card)
        if (foundCard) {
          store.dealerDiscard(foundCard)
        }
      } else {
        store.dealerDiscard(card)
      }
    },
  }
}

function createMultiplayerAdapter(): EuchreGameAdapter {
  const store = useEuchreMultiplayerStore()

  const players = computed<EuchreAdapterPlayer[]>(() => {
    return store.players.map(p => ({
      id: p.id,
      name: p.name,
      // Opponents don't have actual cards — create placeholders so hand.length is correct
      // for the director to deal and fan the right number of cards
      hand: p.hand ?? Array.from({ length: p.handSize }, (_, i) => ({
        id: `placeholder-${p.id}-${i}`,
        suit: Suit.Spades,
        rank: Rank.Nine,
      } as Card)),
      handSize: p.handSize,
      isHuman: p.isHuman,
      teamId: p.teamId,
    }))
  })

  const trump = computed<EuchreTrumpInfo | null>(() => {
    if (!store.trump || store.trumpCalledBy === null) return null
    return {
      suit: store.trump,
      calledBy: store.trumpCalledBy,
      goingAlone: store.goingAlone,
    }
  })

  const currentTrick = computed(() => store.currentTrick ?? createEmptyTrick())

  // For multiplayer, get winnerId from the stored value (set when trick_complete message arrives)
  const lastTrickWinnerId = computed<number | null>(() => {
    return store.lastTrickWinnerId ?? null
  })

  return {
    phase: computed(() => store.phase),
    players,
    currentPlayer: computed(() => store.currentPlayer),
    scores: computed(() => store.scores),
    currentTrick,
    trump,
    turnUpCard: computed(() => store.turnUpCard),
    biddingRound: computed(() => store.biddingRound),
    dealer: computed(() => store.dealer),
    gameOver: computed(() => store.gameOver),
    winner: computed(() => store.winner),
    tricksTaken: computed(() => store.tricksTaken),
    tricksWonByPlayer: computed(() => store.tricksWonByPlayer),
    lastTrickWinnerId,
    myPlayerId: computed(() => store.myPlayerId),
    myHand: computed(() => store.myHand),
    myTeamId: computed(() => store.myTeamId),
    isMyTurn: computed(() => store.isMyTurn),
    validCards: computed(() => store.validCards),
    lastBidAction: computed(() => store.lastBidAction),
    isMultiplayer: true,

    makeBid: (bid: Bid | BidAction, suit?: Suit, goingAlone?: boolean) => {
      if (typeof bid === 'object') {
        store.makeBid(bid.action, bid.suit, bid.goingAlone)
      } else {
        store.makeBid(bid, suit, goingAlone)
      }
    },

    playCard: (card: Card | string) => {
      const cardId = typeof card === 'string' ? card : card.id
      store.playCard(cardId)
    },

    discardCard: (card: Card | string) => {
      const cardId = typeof card === 'string' ? card : card.id
      store.discardCard(cardId)
    },
    
    requestResync: () => {
      store.requestStateResync()
    },

    // Queue control for director
    enableQueueMode: () => store.enableQueueMode(),
    disableQueueMode: () => store.disableQueueMode(),
    dequeueMessage: () => store.dequeueMessage(),
    getQueueLength: () => store.getQueueLength(),
    applyMessage: (message: ServerMessage) => store.applyMessage(message),
  }
}
