import { computed, type ComputedRef, type Ref } from 'vue'
import { usePresidentGameStore } from '@/stores/presidentGameStore'
import { usePresidentMultiplayerStore } from '@/stores/presidentMultiplayerStore'
import type {
  PresidentPhase,
  PresidentPlayer,
  PresidentPile,
  StandardCard,
  PlayerRank,
} from '@euchre/shared'
import { PresidentPhase as Phase } from '@euchre/shared'

export interface ExchangeInfo {
  youGive: StandardCard[]
  youReceive: StandardCard[]
  otherPlayerName: string
  yourRole: string
}

export interface PresidentGameAdapter {
  // State
  phase: ComputedRef<PresidentPhase>
  players: ComputedRef<PresidentPlayer[]>
  currentPlayer: ComputedRef<number>
  currentPile: ComputedRef<PresidentPile>
  isHumanTurn: ComputedRef<boolean>
  validPlays: ComputedRef<StandardCard[][]>
  humanPlayer: ComputedRef<PresidentPlayer | undefined>
  superTwosMode: ComputedRef<boolean>  // Convenience accessor for rules.superTwosMode
  exchangeInfo: ComputedRef<ExchangeInfo | null>
  isHumanGivingCards: ComputedRef<boolean>  // True when human President/VP needs to select cards
  cardsToGiveCount: ComputedRef<number>     // Number of cards human needs to give back
  lastPlayedCards: ComputedRef<StandardCard[] | null>
  roundNumber: ComputedRef<number>
  gameOver: ComputedRef<boolean>
  finishedPlayers: ComputedRef<number[]>
  timedOutPlayer: ComputedRef<number | null>

  // Actions
  playCards: (cards: StandardCard[]) => void
  pass: () => void
  acknowledgeExchange: () => void
  giveCardsBack: (cards: StandardCard[]) => void  // President/VP selecting cards to give
  getPlayerRankDisplay: (playerId: number) => string
  bootPlayer?: (playerId: number) => void

  // Multiplayer-specific
  isMultiplayer: boolean
  initialize?: () => void
  cleanup?: () => void
}

export function usePresidentGameAdapter(mode: 'singleplayer' | 'multiplayer'): PresidentGameAdapter {
  if (mode === 'multiplayer') {
    return useMultiplayerAdapter()
  }
  return useSingleplayerAdapter()
}

function useSingleplayerAdapter(): PresidentGameAdapter {
  const store = usePresidentGameStore()

  return {
    // State
    phase: computed(() => store.phase),
    players: computed(() => store.players),
    currentPlayer: computed(() => store.currentPlayer),
    currentPile: computed(() => store.currentPile),
    isHumanTurn: computed(() => store.isHumanTurn ?? false),
    validPlays: computed(() => store.validPlays),
    humanPlayer: computed(() => store.humanPlayer),
    superTwosMode: computed(() => store.rules?.superTwosMode ?? false),
    exchangeInfo: computed(() => store.exchangeInfo),
    isHumanGivingCards: computed(() => store.isHumanGivingCards ?? false),
    cardsToGiveCount: computed(() => store.cardsToGiveCount ?? 0),
    lastPlayedCards: computed(() => store.lastPlayedCards),
    roundNumber: computed(() => store.roundNumber),
    gameOver: computed(() => store.gameOver),
    finishedPlayers: computed(() => store.finishedPlayers),
    timedOutPlayer: computed(() => null), // No timeout in single-player

    // Actions
    playCards: (cards: StandardCard[]) => store.playCards(cards),
    pass: () => store.pass(),
    acknowledgeExchange: () => store.acknowledgeExchange(),
    giveCardsBack: (cards: StandardCard[]) => store.giveCardsBack(cards),
    getPlayerRankDisplay: (playerId: number) => store.getPlayerRankDisplay(playerId),

    // Single-player specific
    isMultiplayer: false,
  }
}

function useMultiplayerAdapter(): PresidentGameAdapter {
  const store = usePresidentMultiplayerStore()

  // Convert multiplayer player format to PresidentPlayer format
  // For other players, we don't have their actual cards, only handSize
  // Create placeholder cards so hand.length works correctly in the UI
  const adaptedPlayers = computed<PresidentPlayer[]>(() => {
    return store.players.map(p => {
      // If we have the actual hand (our player), use it
      // Otherwise, create placeholder cards based on handSize
      const hand: StandardCard[] = p.hand ?? Array.from({ length: p.handSize }, (_, i) => ({
        id: `placeholder-${p.id}-${i}`,
        rank: '2',
        suit: 'clubs',
      } as StandardCard))

      return {
        id: p.id,
        name: p.name,
        hand,
        isHuman: p.isHuman,
        rank: p.rank,
        finishOrder: p.finishOrder,
        cardsToGive: p.cardsToGive,
        cardsToReceive: p.cardsToReceive,
      }
    })
  })

  // Find the human player (the one with actual card data from server)
  const humanPlayer = computed(() => {
    // Find player whose hand is defined in raw store data (not placeholder)
    const rawPlayer = store.players.find(p => p.hand !== undefined)
    if (!rawPlayer) return undefined
    return adaptedPlayers.value.find(p => p.id === rawPlayer.id)
  })

  // Convert valid plays from card ID arrays to actual card arrays
  const validPlays = computed<StandardCard[][]>(() => {
    const hand = store.myHand
    return store.validPlays.map(playIds =>
      playIds.map(id => hand.find(c => c.id === id)!).filter(Boolean)
    )
  })

  return {
    // State
    phase: computed(() => store.phase),
    players: adaptedPlayers,
    currentPlayer: computed(() => store.currentPlayer),
    currentPile: computed(() => store.currentPile),
    isHumanTurn: computed(() => store.isMyTurn),
    validPlays,
    humanPlayer,
    superTwosMode: computed(() => store.superTwosMode ?? false),
    exchangeInfo: computed(() => store.exchangeInfo),
    isHumanGivingCards: computed(() => false), // TODO: Implement for multiplayer
    cardsToGiveCount: computed(() => 0), // TODO: Implement for multiplayer
    lastPlayedCards: computed(() => store.lastPlayMade?.cards ?? null),
    roundNumber: computed(() => store.roundNumber),
    gameOver: computed(() => store.gameOver),
    finishedPlayers: computed(() => store.finishedPlayers),
    timedOutPlayer: computed(() => store.timedOutPlayer),

    // Actions
    playCards: (cards: StandardCard[]) => {
      const cardIds = cards.map(c => c.id)
      store.playCards(cardIds)
    },
    pass: () => store.pass(),
    acknowledgeExchange: () => store.acknowledgeExchange(),
    giveCardsBack: (_cards: StandardCard[]) => {
      // TODO: Implement for multiplayer
      console.warn('giveCardsBack not yet implemented for multiplayer')
    },
    getPlayerRankDisplay: (playerId: number) => {
      const player = store.players.find(p => p.id === playerId)
      if (!player || player.rank === null) return ''
      // Use the rank display helper from shared
      const rankNames: Record<number, string> = {
        1: 'President',
        2: 'Vice President',
        3: 'Citizen',
        4: 'Scum',
      }
      return rankNames[player.rank] || ''
    },
    bootPlayer: (playerId: number) => store.bootPlayer(playerId),

    // Multiplayer-specific
    isMultiplayer: true,
    initialize: () => store.initialize(),
    cleanup: () => store.cleanup(),
  }
}
