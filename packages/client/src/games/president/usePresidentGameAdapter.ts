import { computed, ref, toRef, watch, type ComputedRef, type Ref } from 'vue'
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
  // SP: human President/VP selecting cards
  isHumanGivingCards: ComputedRef<boolean>  // True when human President/VP needs to select cards (SP)
  cardsToGiveCount: ComputedRef<number>     // Number of cards human needs to give back (SP)
  // MP: unified exchange flow (all 4 players confirm together)
  isInExchange: ComputedRef<boolean>             // True when player is participating in exchange
  exchangeCanSelect: ComputedRef<boolean>        // True = needs to pick cards (Pres/VP), false = pre-selected (Scum/ViceScum)
  exchangeCardsNeeded: ComputedRef<number>       // Cards to select (0 for Scum/ViceScum)
  exchangePreSelectedIds: ComputedRef<string[]>  // Pre-selected cards for Scum/ViceScum
  lastPlayedCards: ComputedRef<StandardCard[] | null>
  roundNumber: ComputedRef<number>
  gameOver: ComputedRef<boolean>
  finishedPlayers: ComputedRef<number[]>
  timedOutPlayer: ComputedRef<number | null>
  showRoundSummary: Ref<boolean>  // Round summary modal visibility
  disconnectedPlayers?: ComputedRef<Array<{ id: number; name: string; isHuman?: boolean }>>
  gameLost: Ref<boolean>  // True when server says game is unrecoverable

  // Actions
  playCards: (cards: StandardCard[]) => void
  pass: () => void
  acknowledgeExchange: () => void
  giveCardsBack: (cards: StandardCard[]) => void  // President/VP selecting cards to give (SP)
  confirmExchange: (cards: StandardCard[]) => void  // Confirm exchange (MP - all roles)
  getPlayerRankDisplay: (playerId: number) => string
  dismissRoundSummary: () => void  // Dismiss round summary modal (starts next round in SP)
  dealAnimationComplete: () => void  // Signal store that deal animation is done
  bootPlayer?: (playerId: number) => void
  bootDisconnectedPlayer?: (playerId: number) => void

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
    // Exchange properties (unified with MP)
    isInExchange: computed(() => store.isInExchange ?? false),
    exchangeCanSelect: computed(() => store.exchangeCanSelect ?? false),
    exchangeCardsNeeded: computed(() => store.cardsToGiveCount ?? 0),
    exchangePreSelectedIds: computed(() => store.exchangePreSelectedIds ?? []),
    lastPlayedCards: computed(() => store.lastPlayedCards),
    roundNumber: computed(() => store.roundNumber),
    gameOver: computed(() => store.gameOver),
    finishedPlayers: computed(() => store.finishedPlayers),
    timedOutPlayer: computed(() => null), // No timeout in single-player
    showRoundSummary: toRef(store, 'showRoundSummary'),
    gameLost: ref(false), // Never happens in single-player

    // Actions
    playCards: (cards: StandardCard[]) => store.playCards(cards),
    pass: () => store.pass(),
    acknowledgeExchange: () => store.acknowledgeExchange(),
    giveCardsBack: (cards: StandardCard[]) => store.giveCardsBack(cards),
    confirmExchange: (cards: StandardCard[]) => {
      // For SP: President/VP use giveCardsBack, Scum/ViceScum use confirmScumExchange
      if (store.exchangeCanSelect) {
        store.giveCardsBack(cards)
      } else {
        store.confirmScumExchange()
      }
    },
    getPlayerRankDisplay: (playerId: number) => store.getPlayerRankDisplay(playerId),
    dismissRoundSummary: () => store.dismissRoundSummary(),
    dealAnimationComplete: () => store.dealAnimationComplete(),
    setPlayAnimationCallback: (cb) => store.setPlayAnimationCallback(cb),
    setPileClearedCallback: (cb) => store.setPileClearedCallback(cb),
    setExchangeAnimationCallback: (cb) => store.setExchangeAnimationCallback(cb),

    // Single-player specific
    isMultiplayer: false,
  }
}

function useMultiplayerAdapter(): PresidentGameAdapter {
  const store = usePresidentMultiplayerStore()
  
  // Local ref for round summary modal - server controls game flow
  const showRoundSummary = ref(false)

  // Show round summary when phase becomes RoundComplete
  watch(() => store.phase, (newPhase) => {
    if (newPhase === Phase.RoundComplete) {
      showRoundSummary.value = true
    }
  })

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
    exchangeInfo: computed(() => store.exchangeInfo),
    // SP exchange properties - provide compatible values from MP state
    isHumanGivingCards: computed(() => store.isInExchange && store.exchangeCanSelect),
    cardsToGiveCount: computed(() => store.exchangeCardsNeeded ?? 0),
    // MP exchange properties
    isInExchange: computed(() => store.isInExchange ?? false),
    exchangeCanSelect: computed(() => store.exchangeCanSelect ?? false),
    exchangeCardsNeeded: computed(() => store.exchangeCardsNeeded ?? 0),
    exchangePreSelectedIds: computed(() => store.exchangePreSelectedIds ?? []),
    lastPlayedCards: computed(() => store.lastPlayMade?.cards ?? null),
    roundNumber: computed(() => store.roundNumber),
    gameOver: computed(() => store.gameOver),
    finishedPlayers: computed(() => store.finishedPlayers),
    timedOutPlayer: computed(() => store.timedOutPlayer),
    showRoundSummary,
    gameLost: toRef(store, 'gameLost'),
    disconnectedPlayers: computed(() => store.disconnectedPlayers ?? []),

    // Actions
    playCards: (cards: StandardCard[]) => {
      const cardIds = cards.map(c => c.id)
      store.playCards(cardIds)
    },
    pass: () => store.pass(),
    acknowledgeExchange: () => store.acknowledgeExchange(),
    giveCardsBack: (cards: StandardCard[]) => {
      // In MP, giveCardsBack maps to confirmExchange
      const cardIds = cards.map(c => c.id)
      store.confirmExchange(cardIds)
    },
    confirmExchange: (cards: StandardCard[]) => {
      const cardIds = cards.map(c => c.id)
      store.confirmExchange(cardIds)
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
    dismissRoundSummary: () => { showRoundSummary.value = false },
    dealAnimationComplete: () => {}, // No-op for multiplayer (server controls timing)
    bootPlayer: (playerId: number) => store.bootPlayer(playerId),
    bootDisconnectedPlayer: (playerId: number) => store.bootDisconnectedPlayer(playerId),

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
