import { computed, ref, toRef, type ComputedRef, type Ref } from 'vue'
import { FullRank, Suit, SpadesBidType, type ServerMessage } from '@67cards/shared'
import type {
  SpadesBid,
  SpadesClientPlayer,
  SpadesPhase,
  SpadesTeamScore,
  SpadesTrick,
  StandardCard,
} from '@67cards/shared'
import { useSpadesStore } from './spadesStore'
import { useSpadesMultiplayerStore } from './spadesMultiplayerStore'

export interface SpadesAdapterPlayer extends Omit<SpadesClientPlayer, 'hand'> {
  hand: StandardCard[]
  isHuman: boolean
}

export interface SpadesGameAdapter {
  phase: ComputedRef<SpadesPhase>
  players: ComputedRef<SpadesAdapterPlayer[]>
  currentPlayer: ComputedRef<number>
  dealer: ComputedRef<number>
  currentTrick: ComputedRef<SpadesTrick>
  completedTricks: ComputedRef<SpadesTrick[]>
  scores: ComputedRef<SpadesTeamScore[]>
  roundNumber: ComputedRef<number>
  gameOver: ComputedRef<boolean>
  winner: ComputedRef<number | null>
  spadesBroken: ComputedRef<boolean>
  bidsComplete: ComputedRef<boolean>
  humanPlayer: ComputedRef<SpadesAdapterPlayer | undefined>
  isHumanTurn: ComputedRef<boolean>
  isHumanBidding: ComputedRef<boolean>
  isHumanPlaying: ComputedRef<boolean>
  validPlays: ComputedRef<StandardCard[]>
  timedOutPlayer: ComputedRef<number | null>
  gameLost: Ref<boolean>
  blindNilDecisionPending: ComputedRef<boolean>
  showBidWheel: ComputedRef<boolean>
  userCardsRevealed: ComputedRef<boolean>

  makeBid: (bid: SpadesBid) => void
  playCard: (card: StandardCard) => void
  submitBlindNil: () => void
  revealCards: () => void
  requestStateResync?: () => void
  bootPlayer?: (playerId: number) => void

  setPlayAnimationCallback: (cb: ((play: { card: StandardCard; playerId: number }) => Promise<void>) | null) => void
  setTrickCompleteCallback: (cb: ((winnerId: number) => Promise<void>) | null) => void
  dealAnimationComplete: () => void
  startNewGame: () => void
  startNextRound: () => void

  initialize?: () => void
  cleanup?: () => void
  enableQueueMode?: () => void
  disableQueueMode?: () => void
  dequeueMessage?: () => ServerMessage | null
  getQueueLength?: () => number
  applyMessage?: (message: ServerMessage) => void

  isMultiplayer: boolean
}

function createPlaceholderCard(id: string): StandardCard {
  return { id, suit: Suit.Spades, rank: FullRank.Nine }
}

export function useSpadesGameAdapter(mode: 'singleplayer' | 'multiplayer'): SpadesGameAdapter {
  if (mode === 'multiplayer') {
    return useSpadesMultiplayerAdapter()
  }
  return useSpadesSinglePlayerAdapter()
}

function useSpadesSinglePlayerAdapter(): SpadesGameAdapter {
  const store = useSpadesStore()

  const players = computed<SpadesAdapterPlayer[]>(() => {
    return store.players.map((player) => ({
      ...player,
      hand: player.hand,
      handSize: player.hand.length,
      isHuman: player.isHuman,
    }))
  })

  const humanPlayer = computed(() => players.value.find((player) => player.isHuman))

  return {
    phase: computed(() => store.phase),
    players,
    currentPlayer: computed(() => store.currentPlayer),
    dealer: computed(() => store.dealer),
    currentTrick: computed(() => store.currentTrick),
    completedTricks: computed(() => store.completedTricks),
    scores: computed(() => store.scores),
    roundNumber: computed(() => store.roundNumber),
    gameOver: computed(() => store.gameOver),
    winner: computed(() => store.winner),
    spadesBroken: computed(() => store.spadesBroken),
    bidsComplete: computed(() => store.bidsComplete),
    humanPlayer,
    isHumanTurn: computed(() => !!store.isHumanTurn),
    isHumanBidding: computed(() => !!store.isHumanBidding),
    isHumanPlaying: computed(() => !!store.isHumanPlaying),
    validPlays: computed(() => store.validPlays),
    timedOutPlayer: computed(() => null),
    gameLost: ref(false),
    blindNilDecisionPending: computed(() => !!store.blindNilDecisionPending),
    showBidWheel: computed(() => !!store.showBidWheel),
    userCardsRevealed: computed(() => store.userCardsRevealed),

    makeBid: (bid) => store.makeBid(bid),
    playCard: (card) => { void store.playCard(card) },
    submitBlindNil: () => store.submitBlindNil(),
    revealCards: () => store.revealCards(),

    setPlayAnimationCallback: (cb) => store.setPlayAnimationCallback(cb),
    setTrickCompleteCallback: (cb) => store.setTrickCompleteCallback(cb),
    dealAnimationComplete: () => store.dealAnimationComplete(),
    startNewGame: () => store.startNewGame(),
    startNextRound: () => store.startNextRound(),

    isMultiplayer: false,
  }
}

function useSpadesMultiplayerAdapter(): SpadesGameAdapter {
  const store = useSpadesMultiplayerStore()

  const players = computed<SpadesAdapterPlayer[]>(() => {
    return store.players.map((player) => ({
      ...player,
      hand: player.hand ?? Array.from({ length: player.handSize }, (_, index) => createPlaceholderCard(`placeholder-${player.id}-${index}`)),
      handSize: player.handSize,
      isHuman: player.hand !== undefined,
    }))
  })

  const humanPlayer = computed(() => {
    const rawHuman = store.players.find((player) => player.hand !== undefined)
    if (!rawHuman) return undefined
    return players.value.find((player) => player.id === rawHuman.id)
  })

  return {
    phase: computed(() => store.phase),
    players,
    currentPlayer: computed(() => store.currentPlayer),
    dealer: computed(() => store.dealer),
    currentTrick: computed(() => store.currentTrick),
    completedTricks: computed(() => store.completedTricks),
    scores: computed(() => store.scores),
    roundNumber: computed(() => store.roundNumber),
    gameOver: computed(() => store.gameOver),
    winner: computed(() => store.winner),
    spadesBroken: computed(() => store.spadesBroken),
    bidsComplete: computed(() => store.bidsComplete),
    humanPlayer,
    isHumanTurn: computed(() => store.isHumanTurn),
    isHumanBidding: computed(() => store.isHumanBidding),
    isHumanPlaying: computed(() => store.isHumanPlaying),
    validPlays: computed(() => store.validPlays),
    timedOutPlayer: computed(() => store.timedOutPlayer),
    gameLost: toRef(store, 'gameLost'),
    // Blind nil not yet supported in multiplayer
    blindNilDecisionPending: computed(() => false),
    showBidWheel: computed(() => store.isHumanBidding),
    userCardsRevealed: computed(() => true),

    makeBid: (bid) => store.makeBid(bid),
    playCard: (card) => store.playCard(card),
    submitBlindNil: () => { /* Not supported in multiplayer yet */ },
    revealCards: () => { /* Not supported in multiplayer yet */ },
    requestStateResync: () => store.requestStateResync(),
    bootPlayer: (playerId) => store.bootPlayer(playerId),

    setPlayAnimationCallback: () => {},
    setTrickCompleteCallback: () => {},
    dealAnimationComplete: () => store.dealAnimationComplete(),
    startNewGame: () => store.startNewGame(),
    startNextRound: () => store.startNextRound(),

    initialize: () => store.initialize(),
    cleanup: () => store.cleanup(),
    enableQueueMode: () => store.enableQueueMode(),
    disableQueueMode: () => store.disableQueueMode(),
    dequeueMessage: () => store.dequeueMessage(),
    getQueueLength: () => store.getQueueLength(),
    applyMessage: (message) => store.applyMessage(message),

    isMultiplayer: true,
  }
}
