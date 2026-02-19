import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  ServerMessage,
  SpadesClientGameState,
  SpadesClientPlayer,
  StandardCard,
} from '@67cards/shared'
import { SpadesPhase, SpadesBidType, Spades } from '@67cards/shared'
import { websocket } from '@/services/websocket'
import { updateIfChanged } from '@/stores/utils'
import { buildMultiplayerDebugSnapshot, logMultiplayerEvent } from '@/stores/multiplayerDebug'
import { createMultiplayerQueueController } from '@/stores/multiplayerQueue'
import { createMultiplayerResyncWatchdog } from '@/stores/multiplayerResync'
import { getExpectedStateSeq, handleCommonMultiplayerError, isSyncRequiredError, updateLastStateSeq } from '@/stores/multiplayerSync'

export const useSpadesMultiplayerStore = defineStore('spadesMultiplayer', () => {
  const gameState = ref<SpadesClientGameState | null>(null)
  const validActions = ref<string[]>([])
  const validCards = ref<string[]>([])
  const isMyTurn = ref(false)
  const gameLost = ref(false)
  const userCardsRevealed = ref(false) // For blind nil - tracks if user has seen their cards this round

  const lastStateSeq = ref(0)

  const queueController = createMultiplayerQueueController<ServerMessage>(applyMessage)
  const resyncWatchdog = createMultiplayerResyncWatchdog({
    isGameActive: () => gameState.value !== null,
    isWaitingForUs: () => isMyTurn.value,
    onStaleState: ({ staleThresholdMs, timeSinceLastUpdate, isWaitingForUs }) => {
      logMultiplayerEvent('spades-mp', 'stale_state_resync', getDebugSnapshot(), {
        staleThresholdMs,
        timeSinceLastUpdate,
        isWaitingForUs,
      })
      requestStateResync()
    },
  })

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
  
  // Blind nil: user hasn't revealed cards yet and it's their turn to bid
  const blindNilDecisionPending = computed(() => {
    return isHumanBidding.value && !userCardsRevealed.value
  })
  // Calculate valid plays locally to avoid flash from server round-trip
  // Use computed refs consistently to ensure proper reactivity tracking
  const validPlays = computed<StandardCard[]>(() => {
    if (!isMyTurn.value || phase.value !== SpadesPhase.Playing) return []
    const human = humanPlayer.value
    if (!human?.hand) return []
    // Use computed values consistently - don't shadow outer computeds
    return Spades.getLegalPlays(human.hand, currentTrick.value, spadesBroken.value)
  })

  function getDebugSnapshot() {
    return buildMultiplayerDebugSnapshot({
      store: 'spades-mp',
      phase: String(phase.value),
      stateSeq: lastStateSeq.value,
      currentPlayer: gameState.value?.currentPlayer ?? null,
      myPlayerId: humanPlayer.value?.id ?? null,
      isMyTurn: isMyTurn.value,
      queueMode: queueController.isEnabled(),
      queueLength: queueController.length(),
      validActionsCount: validActions.value.length,
      validCardsCount: validCards.value.length,
      gameLost: gameLost.value,
      timedOutPlayer: gameState.value?.timedOutPlayer ?? null,
    })
  }

  function handleMessage(message: ServerMessage): void {
    if (queueController.isEnabled()) {
      if (message.type === 'spades_game_state') {
        updateLastStateSeq(lastStateSeq, message.state.stateSeq)
        resyncWatchdog.markStateReceived()
      }
      if (isSyncRequiredError(message)) {
        requestStateResync()
      }
      queueController.enqueue(message)
      logMultiplayerEvent('spades-mp', 'queue_message', getDebugSnapshot(), {
        messageType: message.type,
      })
      return
    }

    applyMessage(message)
  }

  function applyMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'spades_game_state': {
        // Detect new round - reset blind nil state
        const prevRound = gameState.value?.roundNumber ?? 0
        const newRound = message.state.roundNumber ?? 0
        if (newRound > prevRound || (prevRound > 0 && message.state.phase === SpadesPhase.Bidding && !message.state.bidsComplete)) {
          userCardsRevealed.value = false
        }
        
        gameState.value = message.state
        updateLastStateSeq(lastStateSeq, message.state.stateSeq)
        resyncWatchdog.markStateReceived()
        // Only clear turn state if it's definitely not our turn
        // Use updateIfChanged to avoid flickering from redundant updates
        if (humanPlayer.value && message.state.currentPlayer !== humanPlayer.value.id) {
          if (isMyTurn.value) {
            isMyTurn.value = false
            updateIfChanged(validActions, [])
            updateIfChanged(validCards, [])
          }
        }
        logMultiplayerEvent('spades-mp', 'apply_game_state', getDebugSnapshot())
        break
      }
      case 'spades_your_turn':
        isMyTurn.value = true
        updateIfChanged(validActions, message.validActions)
        updateIfChanged(validCards, message.validCards ?? [])
        logMultiplayerEvent('spades-mp', 'apply_your_turn', getDebugSnapshot(), {
          validActions: message.validActions,
          validCardsCount: message.validCards?.length ?? 0,
        })
        break
      case 'error':
        logMultiplayerEvent('spades-mp', 'apply_error', getDebugSnapshot(), {
          code: message.code ?? null,
          message: message.message,
        })
        if (handleCommonMultiplayerError(message, gameLost, requestStateResync).gameLost) {
          return
        }
        break
    }
  }

  function makeBid(bid: { type: SpadesBidType; count: number }): void {
    if (!isHumanBidding.value) return

    const expectedStateSeq = getExpectedStateSeq(lastStateSeq.value, gameState.value?.stateSeq)

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

  // Blind nil: user chose to bid blind nil
  function acceptBlindNil(): void {
    if (!blindNilDecisionPending.value) return
    makeBid({ type: 'blind_nil' as SpadesBidType, count: 0 })
  }

  // Blind nil: user chose to see their cards (decline blind nil)
  function declineBlindNil(): void {
    if (!blindNilDecisionPending.value) return
    userCardsRevealed.value = true
  }

  function playCard(card: StandardCard): void {
    if (!isHumanPlaying.value) return

    const expectedStateSeq = getExpectedStateSeq(lastStateSeq.value, gameState.value?.stateSeq)

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
    logMultiplayerEvent('spades-mp', 'request_state_resync', getDebugSnapshot())
    websocket.send({ type: 'request_state' })
  }

  function enableQueueMode(): void {
    queueController.enable()
  }

  function disableQueueMode(): void {
    queueController.disable()
  }

  function dequeueMessage(): ServerMessage | null {
    return queueController.dequeue()
  }

  function getQueueLength(): number {
    return queueController.length()
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
    resyncWatchdog.start()
    logMultiplayerEvent('spades-mp', 'initialize', getDebugSnapshot())
    requestStateResync()
  }

  function cleanup(): void {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    resyncWatchdog.stop()
    resyncWatchdog.reset()
    gameState.value = null
    isMyTurn.value = false
    validActions.value = []
    validCards.value = []
    gameLost.value = false
    lastStateSeq.value = 0
    queueController.clear()
    logMultiplayerEvent('spades-mp', 'cleanup', getDebugSnapshot())
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
    blindNilDecisionPending,
    userCardsRevealed,
    getDebugSnapshot,

    makeBid,
    acceptBlindNil,
    declineBlindNil,
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
