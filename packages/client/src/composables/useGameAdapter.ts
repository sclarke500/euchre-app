/**
 * Unified Game Adapter
 *
 * Provides a common interface for both single-player and multiplayer game modes.
 * Components use this adapter instead of directly accessing game stores,
 * allowing a single UI to work for both modes.
 */

import { computed, type ComputedRef, type Ref } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useMultiplayerGameStore } from '@/stores/multiplayerGameStore'
import { GamePhase, Suit, BidAction } from '@euchre/shared'
import type { Card, Trick, TeamScore, Bid } from '@euchre/shared'

// Unified player interface that works for both modes
export interface UnifiedPlayer {
  id: number
  name: string
  hand: Card[]
  handSize: number
  isHuman: boolean
  teamId: number
}

// Trump info interface
export interface TrumpInfo {
  suit: Suit
  calledBy: number
  goingAlone: boolean
}

// Unified game adapter interface
export interface GameAdapter {
  // Game state
  phase: ComputedRef<GamePhase>
  players: ComputedRef<UnifiedPlayer[]>
  currentPlayer: ComputedRef<number>
  scores: ComputedRef<TeamScore[]>
  currentTrick: ComputedRef<Trick>
  trump: ComputedRef<TrumpInfo | null>
  turnUpCard: ComputedRef<Card | null>
  biddingRound: ComputedRef<1 | 2 | null>
  dealer: ComputedRef<number>
  gameOver: ComputedRef<boolean>
  winner: ComputedRef<number | null>
  tricksTaken: ComputedRef<[number, number]>

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
}

function createEmptyTrick(): Trick {
  return { cards: [], leadingSuit: null, winnerId: null }
}

export function useGameAdapter(mode: 'singleplayer' | 'multiplayer'): GameAdapter {
  if (mode === 'multiplayer') {
    return createMultiplayerAdapter()
  }
  return createSinglePlayerAdapter()
}

function createSinglePlayerAdapter(): GameAdapter {
  const store = useGameStore()

  const players = computed<UnifiedPlayer[]>(() => {
    return store.players.map(p => ({
      id: p.id,
      name: p.name,
      hand: p.hand,
      handSize: p.hand.length,
      isHuman: p.isHuman,
      teamId: p.teamId,
    }))
  })

  const trump = computed<TrumpInfo | null>(() => {
    const t = store.trump
    if (!t) return null
    return {
      suit: t.suit,
      calledBy: t.calledBy,
      goingAlone: t.goingAlone,
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

  const myPlayerId = computed(() => 0) // Human is always player 0 in single-player
  const myHand = computed(() => store.players[0]?.hand ?? [])
  const myTeamId = computed(() => 0) // Human is always team 0 in single-player

  const isMyTurn = computed(() => store.currentPlayer === 0)

  // In single-player, all cards are valid if it's your turn (validation happens in store)
  const validCards = computed(() => {
    if (!isMyTurn.value) return []
    return myHand.value.map(c => c.id)
  })

  const lastBidAction = computed(() => store.lastAIBidAction)

  const currentTrick = computed(() => store.currentTrick ?? createEmptyTrick())

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

function createMultiplayerAdapter(): GameAdapter {
  const store = useMultiplayerGameStore()

  const players = computed<UnifiedPlayer[]>(() => {
    return store.players.map(p => ({
      id: p.id,
      name: p.name,
      hand: p.hand ?? [],
      handSize: p.handSize,
      isHuman: p.isHuman,
      teamId: p.teamId,
    }))
  })

  const trump = computed<TrumpInfo | null>(() => {
    if (!store.trump || store.trumpCalledBy === null) return null
    return {
      suit: store.trump,
      calledBy: store.trumpCalledBy,
      goingAlone: store.goingAlone,
    }
  })

  const currentTrick = computed(() => store.currentTrick ?? createEmptyTrick())

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
  }
}
