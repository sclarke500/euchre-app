import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  ClientGameState,
  ClientPlayer,
  Card,
  Trick,
  Suit,
  TeamScore,
  ServerMessage,
  BidAction,
} from '@euchre/shared'
import { GamePhase } from '@euchre/shared'
import { websocket } from '@/services/websocket'

export const useMultiplayerGameStore = defineStore('multiplayerGame', () => {
  // State from server
  const gameState = ref<ClientGameState | null>(null)
  const validActions = ref<string[]>([])
  const validCards = ref<string[]>([])
  const isMyTurn = ref(false)

  // Local UI state
  const lastBidAction = ref<{ playerId: number; message: string } | null>(null)
  const lastCardPlayed = ref<{ playerId: number; card: Card } | null>(null)
  const lastTrickWinnerId = ref<number | null>(null)

  // Computed getters for easy access
  const phase = computed(() => gameState.value?.phase ?? GamePhase.Setup)
  const players = computed(() => gameState.value?.players ?? [])
  const currentPlayer = computed(() => gameState.value?.currentPlayer ?? 0)
  const scores = computed(() => gameState.value?.scores ?? [])
  const currentTrick = computed(() => gameState.value?.currentTrick ?? null)
  const completedTricks = computed(() => gameState.value?.completedTricks ?? 0)
  const trump = computed(() => gameState.value?.trump ?? null)
  const trumpCalledBy = computed(() => gameState.value?.trumpCalledBy ?? null)
  const goingAlone = computed(() => gameState.value?.goingAlone ?? false)
  const turnUpCard = computed(() => gameState.value?.turnUpCard ?? null)
  const biddingRound = computed(() => gameState.value?.biddingRound ?? null)
  const dealer = computed(() => gameState.value?.dealer ?? 0)
  const gameOver = computed(() => gameState.value?.gameOver ?? false)
  const winner = computed(() => gameState.value?.winner ?? null)
  const tricksTaken = computed(() => gameState.value?.tricksTaken ?? [0, 0] as [number, number])
  const tricksWonByPlayer = computed(() => gameState.value?.tricksWonByPlayer ?? { 0: 0, 1: 0, 2: 0, 3: 0 })

  // Find the human player (the one with a hand)
  const myPlayer = computed(() => {
    return players.value.find((p) => p.hand !== undefined) ?? null
  })

  const myPlayerId = computed(() => myPlayer.value?.id ?? -1)
  const myHand = computed(() => myPlayer.value?.hand ?? [])
  const myTeamId = computed(() => myPlayer.value?.teamId ?? 0)

  // Message handler for WebSocket messages
  function handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'game_state':
        console.log('MP game_state received - trump:', message.state.trump, 'trumpCalledBy:', message.state.trumpCalledBy)
        // Clear lastTrickWinnerId when a new round starts (dealing phase)
        if (message.state.phase === GamePhase.Dealing) {
          lastTrickWinnerId.value = null
        }
        gameState.value = message.state
        break

      case 'your_turn':
        isMyTurn.value = true
        validActions.value = message.validActions
        validCards.value = message.validCards ?? []
        break

      case 'bid_made':
        lastBidAction.value = {
          playerId: message.playerId,
          message: formatBidMessage(message.action, message.suit, message.goingAlone),
        }
        // Clear after a delay
        setTimeout(() => {
          lastBidAction.value = null
        }, 1500)
        break

      case 'card_played':
        lastCardPlayed.value = {
          playerId: message.playerId,
          card: message.card,
        }
        break

      case 'trick_complete':
        // Store the winner ID for sweep animation
        lastTrickWinnerId.value = message.winnerId
        break

      case 'round_complete':
        // Round complete - scores updated in game_state
        break

      case 'game_over':
        // Game over - winner info in game_state
        break
    }
  }

  function formatBidMessage(action: BidAction, suit?: Suit, goingAlone?: boolean): string {
    const alone = goingAlone ? ' (Alone)' : ''
    switch (action) {
      case 'pass':
        return 'Pass'
      case 'order_up':
        return `Order Up${alone}`
      case 'pick_up':
        return `Pick Up${alone}`
      case 'call_trump':
        if (suit) {
          const suitName = suit.charAt(0).toUpperCase() + suit.slice(1)
          return `${suitName}${alone}`
        }
        return `Call Trump${alone}`
      default:
        return action
    }
  }

  // Actions - send messages to server
  function makeBid(action: BidAction, suit?: Suit, goingAlone?: boolean): void {
    if (!isMyTurn.value) return

    websocket.send({
      type: 'make_bid',
      action,
      suit,
      goingAlone,
    })

    isMyTurn.value = false
    validActions.value = []
  }

  function playCard(cardId: string): void {
    if (!isMyTurn.value) return
    if (!validCards.value.includes(cardId)) return

    websocket.send({
      type: 'play_card',
      cardId,
    })

    isMyTurn.value = false
    validActions.value = []
    validCards.value = []
  }

  function discardCard(cardId: string): void {
    if (!isMyTurn.value) return

    websocket.send({
      type: 'discard_card',
      cardId,
    })

    isMyTurn.value = false
    validActions.value = []
    validCards.value = []
  }

  // Initialize - set up WebSocket listener
  let unsubscribe: (() => void) | null = null

  function initialize(): void {
    if (unsubscribe) return
    unsubscribe = websocket.onMessage(handleMessage)
  }

  function cleanup(): void {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    gameState.value = null
    isMyTurn.value = false
    validActions.value = []
    validCards.value = []
  }

  return {
    // State
    gameState,
    validActions,
    validCards,
    isMyTurn,
    lastBidAction,
    lastCardPlayed,
    lastTrickWinnerId,

    // Computed
    phase,
    players,
    currentPlayer,
    scores,
    currentTrick,
    completedTricks,
    trump,
    trumpCalledBy,
    goingAlone,
    turnUpCard,
    biddingRound,
    dealer,
    gameOver,
    winner,
    tricksTaken,
    tricksWonByPlayer,
    myPlayer,
    myPlayerId,
    myHand,
    myTeamId,

    // Actions
    makeBid,
    playCard,
    discardCard,
    initialize,
    cleanup,
  }
})
