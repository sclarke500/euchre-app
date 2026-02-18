import { computed, ref, toRef, type ComputedRef, type Ref } from 'vue'
import { usePresidentGameStore } from './presidentGameStore'
import { usePresidentMultiplayerStore } from './presidentMultiplayerStore'
import type {
  PresidentPhase,
  PresidentPlayer,
  PresidentPile,
  StandardCard,
  PlayerRank,
  PendingExchange,
  ServerMessage,
} from '@67cards/shared'
import { PresidentPhase as Phase, findValidPlays } from '@67cards/shared'

export interface PresidentExchangeInfo {
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
  exchangeInfo: ComputedRef<PresidentExchangeInfo | null>
  isHumanGivingCards: ComputedRef<boolean>  // True when human President/VP needs to select cards
  cardsToGiveCount: ComputedRef<number>     // Number of cards human needs to give back
  lastPlayedCards: ComputedRef<StandardCard[] | null>
  roundNumber: ComputedRef<number>
  gameOver: ComputedRef<boolean>
  finishedPlayers: ComputedRef<number[]>
  timedOutPlayer: ComputedRef<number | null>
  gameLost: Ref<boolean>  // True when server says game is unrecoverable

  // Actions
  playCards: (cards: StandardCard[]) => void
  pass: () => void
  acknowledgeExchange: () => void
  giveCardsBack: (cards: StandardCard[]) => void  // President/VP selecting cards to give
  getPlayerRankDisplay: (playerId: number) => string
  dealAnimationComplete: () => void  // Signal store that deal animation is done
  bootPlayer?: (playerId: number) => void

  // Animation callbacks — store waits for these before advancing turns
  setPlayAnimationCallback?: (cb: ((play: { cards: StandardCard[], playerId: number, playIndex: number }) => Promise<void>) | null) => void
  setPileClearedCallback?: (cb: (() => Promise<void>) | null) => void
  setExchangeAnimationCallback?: (cb: ((exchanges: PendingExchange[]) => Promise<void>) | null) => void

  // Multiplayer-specific
  isMultiplayer: boolean
  initialize?: () => void
  cleanup?: () => void
  requestResync?: () => void  // Manual resync for when state gets out of sync

  // Queue control (multiplayer only — for director processing loop)
  enableQueueMode?: () => void
  disableQueueMode?: () => void
  dequeueMessage?: () => ServerMessage | null
  getQueueLength?: () => number
  applyMessage?: (message: ServerMessage) => void

  // LocalStorage persistence (SP only)
  saveToLocalStorage?: () => void
  loadFromLocalStorage?: () => boolean
  hasSavedGame?: () => boolean
  clearSavedGame?: () => void
  isRestoring?: ComputedRef<boolean>
  commitRestore?: () => void
  abortRestore?: () => void
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
    gameLost: ref(false), // Never happens in single-player

    // Actions
    playCards: (cards: StandardCard[]) => store.playCards(cards),
    pass: () => store.pass(),
    acknowledgeExchange: () => store.acknowledgeExchange(),
    giveCardsBack: (cards: StandardCard[]) => store.giveCardsBack(cards),
    getPlayerRankDisplay: (playerId: number) => store.getPlayerRankDisplay(playerId),
    dealAnimationComplete: () => store.dealAnimationComplete(),
    setPlayAnimationCallback: (cb) => store.setPlayAnimationCallback(cb),
    setPileClearedCallback: (cb) => store.setPileClearedCallback(cb),
    setExchangeAnimationCallback: (cb) => store.setExchangeAnimationCallback(cb),

    // Single-player specific
    isMultiplayer: false,

    // LocalStorage persistence
    saveToLocalStorage: () => store.saveToLocalStorage(),
    loadFromLocalStorage: () => store.loadFromLocalStorage(),
    hasSavedGame: () => store.hasSavedGame(),
    clearSavedGame: () => store.clearSavedGame(),
    isRestoring: computed(() => store.isRestoring),
    commitRestore: () => store.commitRestore(),
    abortRestore: () => store.abortRestore(),
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

  // Calculate valid plays locally to ensure they are always correct
  const validPlays = computed<StandardCard[][]>(() => {
    if (!store.isMyTurn) return []
    return findValidPlays(store.myHand, store.currentPile, store.superTwosMode ?? false)
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
    exchangeInfo: computed(() => {
      // For multiplayer, also expose the received cards from give-back phase
      if (store.isAwaitingGiveCards) {
        return {
          youGive: [], // Will be filled after selection
          youReceive: store.receivedCardsForGiveBack ?? [],
          otherPlayerName: '',
          yourRole: store.giveBackRole ?? '',
        }
      }
      return store.exchangeInfo
    }),
    isHumanGivingCards: computed(() => store.isAwaitingGiveCards ?? false),
    cardsToGiveCount: computed(() => store.cardsToGiveCount ?? 0),
    lastPlayedCards: computed(() => store.lastPlayMade?.cards ?? null),
    roundNumber: computed(() => store.roundNumber),
    gameOver: computed(() => store.gameOver),
    finishedPlayers: computed(() => store.finishedPlayers),
    timedOutPlayer: computed(() => store.timedOutPlayer),
    gameLost: toRef(store, 'gameLost'),

    // Actions
    playCards: (cards: StandardCard[]) => {
      const cardIds = cards.map(c => c.id)
      store.playCards(cardIds)
    },
    pass: () => store.pass(),
    acknowledgeExchange: () => store.acknowledgeExchange(),
    giveCardsBack: (cards: StandardCard[]) => {
      const cardIds = cards.map(c => c.id)
      store.giveCards(cardIds)
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
    dealAnimationComplete: () => {}, // No-op for multiplayer (server controls timing)
    bootPlayer: (playerId: number) => store.bootPlayer(playerId),

    // Multiplayer-specific
    isMultiplayer: true,
    initialize: () => store.initialize(),
    cleanup: () => store.cleanup(),
    requestResync: () => store.requestStateResync(),

    // Queue control for director
    enableQueueMode: () => store.enableQueueMode(),
    disableQueueMode: () => store.disableQueueMode(),
    dequeueMessage: () => store.dequeueMessage(),
    getQueueLength: () => store.getQueueLength(),
    applyMessage: (message: ServerMessage) => store.applyMessage(message),
  }
}
