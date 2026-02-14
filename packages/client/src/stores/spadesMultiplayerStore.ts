import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  ServerMessage,
  SpadesClientGameState,
  SpadesClientPlayer,
  SpadesBidType,
  StandardCard,
} from '@euchre/shared'
import { SpadesPhase } from '@euchre/shared'
import { websocket } from '@/services/websocket'

export const useSpadesMultiplayerStore = defineStore('spadesMultiplayer', () => {
  const gameState = ref<SpadesClientGameState | null>(null)
  const validActions = ref<string[]>([])
  const validCards = ref<string[]>([])
  const isMyTurn = ref(false)
  const gameLost = ref(false)

  const lastStateSeq = ref(0)

  const messageQueue: ServerMessage[] = []
  let queueMode = false

  const phase = computed(() => gameState.value?.phase ?? SpadesPhase.Setup)
  const players = computed<SpadesClientPlayer[]>(() => gameState.value?.players ?? [])
  const currentPlayer = computed(() => gameState.value?.currentPlayer ?? 0)
  const currentTrick = computed(() => gameState.value?.currentTrick ?? { cards: [], leadingSuit: null, winnerId: null })
  const completedTricks = computed(() => gameState.value?.completedTricks ?? [])
  const dealer = computed(() => gameState.value?.dealer ?? 0)
  const scores = computed(() => gameState.value?.scores ?? [{ teamId: 0, score: 0, bags: 0 }, { teamId: 1, score: 0, bags: 0 }])
  const roundNumber = computed(() => gameState.value?.roundNumber ?? 1)
  const gameOver = computed(() => gameState.value?.gameOver ?? false)
  const winner = computed(() => gameState.value?.winner ?? null)
  const spadesBroken = computed(() => gameState.value?.spadesBroken ?? false)
  const bidsComplete = computed(() => gameState.value?.bidsComplete ?? false)
  const timedOutPlayer = computed(() => gameState.value?.timedOutPlayer ?? null)

  const humanPlayer = computed(() => players.value.find(p => p.hand !== undefined))
  const isHumanTurn = computed(() => isMyTurn.value)
  const isHumanBidding = computed(() => isMyTurn.value && phase.value === SpadesPhase.Bidding)
  const isHumanPlaying = computed(() => isMyTurn.value && phase.value === SpadesPhase.Playing)
  const validPlays = computed<StandardCard[]>(() => {
    const human = humanPlayer.value
    if (!human?.hand) return []
    const legal = new Set(validCards.value)
    return human.hand.filter(c => legal.has(c.id))
  })

  function getExpectedStateSeq(): number {
    const stateSeqFromSnapshot = gameState.value?.stateSeq ?? 0
    return Math.max(stateSeqFromSnapshot, lastStateSeq.value)
  }

  // Only update a ref if the array content actually changed (avoids triggering
  // downstream reactivity and flickering from messages with identical data)
  function updateIfChanged(target: { value: string[] }, incoming: string[]) {
    if (target.value.length !== incoming.length ||
        target.value.some((v, i) => v !== incoming[i])) {
      target.value = incoming
    }
  }

  function handleMessage(message: ServerMessage): void {
    if (queueMode) {
      if (message.type === 'spades_game_state') {
        lastStateSeq.value = message.state.stateSeq
      }
      if (message.type === 'error' && message.code === 'sync_required') {
        requestStateResync()
      }
      messageQueue.push(message)
      return
    }

    applyMessage(message)
  }

  function applyMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'spades_game_state':
        gameState.value = message.state
        lastStateSeq.value = message.state.stateSeq
        // Only clear turn state if it's definitely not our turn
        // Use updateIfChanged to avoid flickering from redundant updates
        if (humanPlayer.value && message.state.currentPlayer !== humanPlayer.value.id) {
          if (isMyTurn.value) {
            isMyTurn.value = false
            updateIfChanged(validActions, [])
            updateIfChanged(validCards, [])
          }
        }
        break
      case 'spades_your_turn':
        isMyTurn.value = true
        updateIfChanged(validActions, message.validActions)
        updateIfChanged(validCards, message.validCards ?? [])
        break
      case 'error':
        if (message.code === 'game_lost') {
          gameLost.value = true
          return
        }
        if (message.code === 'sync_required') {
          requestStateResync()
        }
        break
    }
  }

  function makeBid(bid: { type: SpadesBidType; count: number }): void {
    if (!isHumanBidding.value) return

    const expectedStateSeq = getExpectedStateSeq()

    websocket.send({
      type: 'spades_make_bid',
      bidType: bid.type,
      count: bid.count,
      expectedStateSeq,
    })

    isMyTurn.value = false
    validActions.value = []
    validCards.value = []
  }

  function playCard(card: StandardCard): void {
    if (!isHumanPlaying.value) return

    const expectedStateSeq = getExpectedStateSeq()

    websocket.send({
      type: 'play_card',
      cardId: card.id,
      expectedStateSeq,
    })

    isMyTurn.value = false
    validActions.value = []
    validCards.value = []
  }

  function bootPlayer(playerId: number): void {
    websocket.send({ type: 'boot_player', playerId })
  }

  function requestStateResync(): void {
    websocket.send({ type: 'request_state' })
  }

  function enableQueueMode(): void {
    queueMode = true
  }

  function disableQueueMode(): void {
    queueMode = false
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

  function setPlayAnimationCallback(): void {
    // No-op for multiplayer. Server controls progression timing.
  }

  function setTrickCompleteCallback(): void {
    // No-op for multiplayer. Server controls progression timing.
  }

  function dealAnimationComplete(): void {
    // No-op for multiplayer.
  }

  let unsubscribe: (() => void) | null = null

  function initialize(): void {
    if (unsubscribe) return
    unsubscribe = websocket.onMessage(handleMessage)
    requestStateResync()
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
    gameLost.value = false
    lastStateSeq.value = 0
    messageQueue.length = 0
    queueMode = false
  }

  function startNewGame(): void {
    // Multiplayer restarts are host-driven from lobby.
  }

  function startNextRound(): void {
    // Multiplayer round transitions are server-driven.
  }

  return {
    gameState,
    phase,
    players,
    currentPlayer,
    currentTrick,
    completedTricks,
    dealer,
    scores,
    roundNumber,
    gameOver,
    winner,
    spadesBroken,
    bidsComplete,
    timedOutPlayer,

    humanPlayer,
    isMyTurn,
    isHumanTurn,
    isHumanBidding,
    isHumanPlaying,
    validActions,
    validCards,
    validPlays,
    gameLost,

    makeBid,
    playCard,
    bootPlayer,
    requestStateResync,
    initialize,
    cleanup,

    enableQueueMode,
    disableQueueMode,
    dequeueMessage,
    getQueueLength,
    applyMessage,

    setPlayAnimationCallback,
    setTrickCompleteCallback,
    dealAnimationComplete,
    startNewGame,
    startNextRound,
  }
})
