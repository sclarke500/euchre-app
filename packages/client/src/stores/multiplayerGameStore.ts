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

  // Sync tracking
  const lastStateSeq = ref<number>(0)

  // ── Message Queue ─────────────────────────────────────────────────────────
  // When queue mode is enabled, messages are buffered instead of applied
  // immediately. The director's processing loop dequeues and applies them
  // one at a time, with animation pauses between each.

  const messageQueue: ServerMessage[] = []
  let queueMode = false

  function enableQueueMode(): void {
    queueMode = true
  }

  function disableQueueMode(): void {
    queueMode = false
    // Flush remaining messages directly
    while (messageQueue.length > 0) {
      applyMessage(messageQueue.shift()!)
    }
  }

  function dequeueMessage(): ServerMessage | null {
    return messageQueue.shift() ?? null
  }

  function getQueueLength(): number {
    return messageQueue.length
  }

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

  // Only update a ref if the array content actually changed (avoids triggering
  // downstream reactivity from turn_reminder messages with identical data)
  function updateIfChanged(target: { value: string[] }, incoming: string[]) {
    if (target.value.length !== incoming.length ||
        target.value.some((v, i) => v !== incoming[i])) {
      target.value = incoming
    }
  }

  // WebSocket message entry point — buffers in queue mode, applies directly otherwise
  function handleMessage(message: ServerMessage): void {
    if (queueMode) {
      // Keep state sequence tracking up to date even while buffering messages.
      // Otherwise, outgoing actions can include a stale expectedStateSeq and be rejected,
      // which looks like a "hang" after the user acts.
      if (message.type === 'game_state') {
        lastStateSeq.value = message.state.stateSeq
      }

      // If the server tells us we're out of sync, request a resync immediately.
      // (The error message itself is still queued so UI can show it if needed.)
      if (message.type === 'error' && message.code === 'sync_required') {
        requestStateResync()
      }

      // All messages queued — even turn_reminder. Bypassing the queue would
      // set isMyTurn=true before earlier messages (like AI bids) are processed,
      // causing premature "your turn" UI while the queue is still catching up.
      messageQueue.push(message)
    } else {
      applyMessage(message)
    }
  }

  // Actually mutates reactive state for a single message.
  // In queue mode, called by the director's processing loop.
  // In direct mode, called by handleMessage immediately.
  function applyMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'game_state':
        // Clear lastTrickWinnerId when a new round starts (dealing phase)
        if (message.state.phase === GamePhase.Dealing) {
          lastTrickWinnerId.value = null
        }
        gameState.value = message.state
        lastStateSeq.value = message.state.stateSeq
        break

      case 'your_turn':
        console.log('[MP] your_turn received, actions:', message.validActions)
        isMyTurn.value = true
        updateIfChanged(validActions, message.validActions)
        updateIfChanged(validCards, message.validCards ?? [])
        break

      case 'error':
        console.error('[MP] Server error:', message.message)
        if (message.code === 'sync_required') {
          requestStateResync()
        }
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

      case 'turn_reminder':
        // Server reminder that it's still our turn — re-enable turn indicators.
        // Only update validActions (for bid buttons). Do NOT update validCards —
        // the server may recompute them with stale trick state, causing flicker.
        // validCards are authoritatively set by your_turn only.
        isMyTurn.value = true
        updateIfChanged(validActions, message.validActions)
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
    if (!isMyTurn.value) {
      console.warn('[MP] makeBid called but isMyTurn=false, ignoring:', action)
      return
    }

    console.log('[MP] Sending bid:', action, 'phase:', phase.value, 'currentPlayer:', currentPlayer.value, 'myId:', myPlayerId.value)
    websocket.send({
      type: 'make_bid',
      action,
      suit,
      goingAlone,
      expectedStateSeq: lastStateSeq.value,
    })

    isMyTurn.value = false
    validActions.value = []
    validCards.value = []
  }

  function playCard(cardId: string): void {
    if (!isMyTurn.value) return
    if (validCards.value.length > 0 && !validCards.value.includes(cardId)) return

    websocket.send({
      type: 'play_card',
      cardId,
      expectedStateSeq: lastStateSeq.value,
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
      expectedStateSeq: lastStateSeq.value,
    })

    isMyTurn.value = false
    validActions.value = []
    validCards.value = []
  }

  function requestStateResync(): void {
    websocket.send({
      type: 'request_state',
    })
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
    messageQueue.length = 0
    queueMode = false
    gameState.value = null
    isMyTurn.value = false
    validActions.value = []
    validCards.value = []
    lastStateSeq.value = 0
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
    requestStateResync,

    // Queue control (for director)
    enableQueueMode,
    disableQueueMode,
    dequeueMessage,
    getQueueLength,
    applyMessage,
  }
})
