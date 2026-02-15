import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  PresidentClientGameState,
  PresidentClientPlayer,
  PresidentPile,
  StandardCard,
  PlayerRank,
  ServerMessage,
} from '@euchre/shared'
import { PresidentPhase } from '@euchre/shared'
import { websocket } from '@/services/websocket'
import { updateIfChanged } from './utils'
import { buildMultiplayerDebugSnapshot, logMultiplayerEvent } from './multiplayerDebug'
import { createMultiplayerQueueController } from './multiplayerQueue'
import { createMultiplayerResyncWatchdog } from './multiplayerResync'
import { getExpectedStateSeq, handleCommonMultiplayerError, isSyncRequiredError, updateLastStateSeq } from './multiplayerSync'

export const usePresidentMultiplayerStore = defineStore('presidentMultiplayer', () => {
  // State from server
  const gameState = ref<PresidentClientGameState | null>(null)
  const validActions = ref<string[]>([])
  const validPlays = ref<string[][]>([]) // Array of valid card ID combinations
  const isMyTurn = ref(false)

  // Card exchange info (for summary modal after exchange)
  const exchangeInfo = ref<{
    youGive: StandardCard[]
    youReceive: StandardCard[]
    otherPlayerName: string
    yourRole: string
  } | null>(null)

  // Give-back phase state (President/VP choosing cards to give)
  const isAwaitingGiveCards = ref(false)
  const cardsToGiveCount = ref(0)
  const receivedCardsForGiveBack = ref<StandardCard[]>([])
  const giveBackRole = ref('')

  // Local UI state
  const lastPlayMade = ref<{ playerId: number; cards: StandardCard[]; playerName: string } | null>(null)
  const lastPass = ref<{ playerId: number; playerName: string } | null>(null)
  const pileCleared = ref(false)
  const gameLost = ref(false)  // Set when server says game is unrecoverable

  // Sync tracking
  const lastStateSeq = ref<number>(0)

  // Message queue — when enabled, messages are buffered instead of applied
  // immediately. The director's processing loop dequeues and applies them
  // one at a time, with animation pauses between each.
  const queueController = createMultiplayerQueueController<ServerMessage>(applyMessage)
  const resyncWatchdog = createMultiplayerResyncWatchdog({
    isGameActive: () => gameState.value !== null,
    isWaitingForUs: () => isMyTurn.value || isAwaitingGiveCards.value,
    onStaleState: ({ staleThresholdMs, timeSinceLastUpdate, isWaitingForUs }) => {
      logMultiplayerEvent('president-mp', 'stale_state_resync', getDebugSnapshot(), {
        staleThresholdMs,
        timeSinceLastUpdate,
        isWaitingForUs,
      })
      requestStateResync()
    },
  })

  // Computed getters for easy access
  const phase = computed(() => gameState.value?.phase ?? PresidentPhase.Setup)
  const players = computed(() => gameState.value?.players ?? [])
  const currentPlayer = computed(() => gameState.value?.currentPlayer ?? 0)
  const currentPile = computed(() => gameState.value?.currentPile ?? { plays: [], currentPlayType: null, currentRank: null })
  const consecutivePasses = computed(() => gameState.value?.consecutivePasses ?? 0)
  const finishedPlayers = computed(() => gameState.value?.finishedPlayers ?? [])
  const roundNumber = computed(() => gameState.value?.roundNumber ?? 1)
  const gameOver = computed(() => gameState.value?.gameOver ?? false)
  const lastPlayerId = computed(() => gameState.value?.lastPlayerId ?? null)
  const superTwosMode = computed(() => gameState.value?.superTwosMode ?? false)
  const timedOutPlayer = computed(() => gameState.value?.timedOutPlayer ?? null)

  // Find the human player (the one with a hand)
  const myPlayer = computed(() => {
    return players.value.find((p) => p.hand !== undefined) ?? null
  })

  const myPlayerId = computed(() => myPlayer.value?.id ?? -1)
  const myHand = computed(() => myPlayer.value?.hand ?? [])
  const myRank = computed(() => myPlayer.value?.rank ?? null)
  const myFinishOrder = computed(() => myPlayer.value?.finishOrder ?? null)

  function getDebugSnapshot() {
    return buildMultiplayerDebugSnapshot({
      store: 'president-mp',
      phase: String(phase.value),
      stateSeq: lastStateSeq.value,
      currentPlayer: gameState.value?.currentPlayer ?? null,
      myPlayerId: myPlayerId.value >= 0 ? myPlayerId.value : null,
      isMyTurn: isMyTurn.value,
      queueMode: queueController.isEnabled(),
      queueLength: queueController.length(),
      validActionsCount: validActions.value.length,
      validPlaysCount: validPlays.value.length,
      gameLost: gameLost.value,
      timedOutPlayer: gameState.value?.timedOutPlayer ?? null,
    })
  }

  // Active players (not yet finished)
  const activePlayers = computed(() => players.value.filter(p => p.finishOrder === null))

  // WebSocket message entry point — buffers in queue mode, applies directly otherwise
  function handleMessage(message: ServerMessage): void {
    if (queueController.isEnabled()) {
      // Keep state sequence tracking up to date even while buffering.
      // Otherwise, outgoing actions can include a stale expectedStateSeq and be rejected.
      if (message.type === 'president_game_state') {
        updateLastStateSeq(lastStateSeq, message.state.stateSeq)
        resyncWatchdog.markStateReceived()
      }

      // If server tells us we're out of sync, request resync immediately.
      if (isSyncRequiredError(message)) {
        requestStateResync()
      }

      queueController.enqueue(message)
      logMultiplayerEvent('president-mp', 'queue_message', getDebugSnapshot(), {
        messageType: message.type,
      })
    } else {
      applyMessage(message)
    }
  }

  // Actually mutates reactive state for a single message.
  // In queue mode, called by the director's processing loop.
  // In direct mode, called by handleMessage immediately.
  function applyMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'president_game_state':
        updateIfChanged(isMyTurn, false)
        updateIfChanged(validActions, [])
        updateIfChanged(validPlays, [])
        gameState.value = message.state
        updateLastStateSeq(lastStateSeq, message.state.stateSeq)
        resyncWatchdog.markStateReceived()
        logMultiplayerEvent('president-mp', 'apply_game_state', getDebugSnapshot())
        break

      case 'president_your_turn':
        updateIfChanged(isMyTurn, true)
        updateIfChanged(validActions, message.validActions)
        updateIfChanged(validPlays, message.validPlays)
        logMultiplayerEvent('president-mp', 'apply_your_turn', getDebugSnapshot(), {
          validActions: message.validActions,
          validPlaysCount: message.validPlays.length,
        })
        break

      case 'president_play_made':
        lastPlayMade.value = {
          playerId: message.playerId,
          cards: message.cards,
          playerName: message.playerName,
        }
        // Clear after a delay
        setTimeout(() => {
          lastPlayMade.value = null
        }, 1500)
        break

      case 'president_passed':
        lastPass.value = {
          playerId: message.playerId,
          playerName: message.playerName,
        }
        // Clear after a delay
        setTimeout(() => {
          lastPass.value = null
        }, 1500)
        break

      case 'president_pile_cleared':
        pileCleared.value = true
        // Clear after a delay
        setTimeout(() => {
          pileCleared.value = false
        }, 1000)
        break

      case 'president_player_finished':
        // Player finished - will be reflected in game state
        console.log(`${message.playerName} finished in position ${message.finishPosition}`)
        break

      case 'president_round_complete':
        // Round complete - rankings in message
        console.log('Round complete:', message.roundNumber)
        break

      case 'president_game_over':
        // Game over - final rankings in message
        console.log('Game over:', message.finalRankings)
        break

      case 'president_card_exchange_info':
        exchangeInfo.value = {
          youGive: message.youGive,
          youReceive: message.youReceive,
          otherPlayerName: message.otherPlayerName,
          yourRole: message.yourRole,
        }
        // Clear give-back state when we receive exchange summary
        isAwaitingGiveCards.value = false
        cardsToGiveCount.value = 0
        receivedCardsForGiveBack.value = []
        giveBackRole.value = ''
        break

      case 'president_awaiting_give_cards':
        // President or VP needs to choose cards to give back
        isAwaitingGiveCards.value = true
        cardsToGiveCount.value = message.cardsToGive
        receivedCardsForGiveBack.value = message.receivedCards ?? []
        giveBackRole.value = message.yourRole
        break

      case 'player_timed_out':
        // Player timed out - game state will reflect this
        console.log(`Player ${message.playerName} timed out`)
        break

      case 'player_booted':
        // Player booted and replaced with AI
        console.log(`Player ${message.playerName} was booted`)
        break

      case 'error':
        console.error('[MP] Server error:', message.message)
        logMultiplayerEvent('president-mp', 'apply_error', getDebugSnapshot(), {
          code: message.code ?? null,
          message: message.message,
        })
        const commonError = handleCommonMultiplayerError(message, gameLost, requestStateResync)
        if (commonError.gameLost) {
          console.warn('[MP] Game lost - returning to menu')
          return
        }
        break
    }
  }

  // Actions - send messages to server
  function playCards(cardIds: string[]): void {
    if (!isMyTurn.value) return

    // Validate the play is in validPlays
    const isValid = validPlays.value.some(vp =>
      vp.length === cardIds.length &&
      vp.every(id => cardIds.includes(id))
    )
    if (!isValid) {
      console.warn('Invalid play attempted:', cardIds)
      return
    }

    websocket.send({
      type: 'president_play_cards',
      cardIds,
      expectedStateSeq: getExpectedStateSeq(lastStateSeq.value, gameState.value?.stateSeq),
    })

    isMyTurn.value = false
    validActions.value = []
    validPlays.value = []
  }

  function pass(): void {
    if (!isMyTurn.value) return
    if (!validActions.value.includes('pass')) return

    websocket.send({
      type: 'president_pass',
      expectedStateSeq: getExpectedStateSeq(lastStateSeq.value, gameState.value?.stateSeq),
    })

    isMyTurn.value = false
    validActions.value = []
    validPlays.value = []
  }

  function acknowledgeExchange(): void {
    // Clear the exchange info - the UI will handle this
    exchangeInfo.value = null
  }

  function giveCards(cardIds: string[]): void {
    if (!isAwaitingGiveCards.value) return
    if (cardIds.length !== cardsToGiveCount.value) return

    websocket.send({
      type: 'president_give_cards',
      cardIds,
      expectedStateSeq: getExpectedStateSeq(lastStateSeq.value, gameState.value?.stateSeq),
    })

    // Clear state - server will send exchange_info after processing
    isAwaitingGiveCards.value = false
  }

  function bootPlayer(playerId: number): void {
    websocket.send({
      type: 'boot_player',
      playerId,
    })
  }

  function requestStateResync(): void {
    logMultiplayerEvent('president-mp', 'request_state_resync', getDebugSnapshot())
    websocket.send({
      type: 'request_state',
    })
  }

  function enableQueueMode(): void {
    queueController.enable()
  }

  function disableQueueMode(): void {
    queueController.disable()
  }

  function dequeueMessage(): ServerMessage | null {
    return queueController.dequeue() ?? null
  }

  function getQueueLength(): number {
    return queueController.length()
  }

  // Initialize - set up WebSocket listener
  let unsubscribe: (() => void) | null = null

  function initialize(): void {
    if (unsubscribe) return
    unsubscribe = websocket.onMessage(handleMessage)
    resyncWatchdog.start()
    logMultiplayerEvent('president-mp', 'initialize', getDebugSnapshot())
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
    validPlays.value = []
    exchangeInfo.value = null
    isAwaitingGiveCards.value = false
    cardsToGiveCount.value = 0
    receivedCardsForGiveBack.value = []
    giveBackRole.value = ''
    lastStateSeq.value = 0
    queueController.clear()
    gameLost.value = false
    logMultiplayerEvent('president-mp', 'cleanup', getDebugSnapshot())
  }

  return {
    // State
    gameState,
    validActions,
    validPlays,
    isMyTurn,
    exchangeInfo,
    lastPlayMade,
    lastPass,
    pileCleared,
    gameLost,
    
    // Give-back phase state
    isAwaitingGiveCards,
    cardsToGiveCount,
    receivedCardsForGiveBack,
    giveBackRole,

    // Computed
    phase,
    players,
    currentPlayer,
    currentPile,
    consecutivePasses,
    finishedPlayers,
    roundNumber,
    gameOver,
    lastPlayerId,
    superTwosMode,
    timedOutPlayer,
    myPlayer,
    myPlayerId,
    myHand,
    myRank,
    myFinishOrder,
    activePlayers,
    getDebugSnapshot,

    // Actions
    playCards,
    pass,
    acknowledgeExchange,
    giveCards,
    bootPlayer,
    requestStateResync,
    initialize,
    cleanup,

    // Queue control (for director)
    enableQueueMode,
    disableQueueMode,
    dequeueMessage,
    getQueueLength,
    applyMessage,
  }
})
