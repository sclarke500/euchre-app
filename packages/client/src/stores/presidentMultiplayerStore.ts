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

  // Sync tracking
  const lastStateSeq = ref<number>(0)
  let syncCheckInterval: ReturnType<typeof setInterval> | null = null
  let lastStateReceivedAt = 0

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

  // Active players (not yet finished)
  const activePlayers = computed(() => players.value.filter(p => p.finishOrder === null))

  // Message handler for WebSocket messages
  function handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'president_game_state':
        const myPlayerInState = message.state.players.find(p => p.hand !== undefined)
        console.log('[DEBUG] president_game_state received:', {
          phase: message.state.phase,
          seq: message.state.stateSeq,
          currentPlayer: message.state.currentPlayer,
          myPlayerId: myPlayerInState?.id,
          myHand: myPlayerInState?.hand?.map(c => c.id),
        })
        gameState.value = message.state
        lastStateSeq.value = message.state.stateSeq
        lastStateReceivedAt = Date.now()
        break

      case 'president_your_turn':
        console.log('[DEBUG] president_your_turn received:', {
          validActions: message.validActions,
          validPlays: message.validPlays,
          myHand: myHand.value.map(c => c.id),
        })
        isMyTurn.value = true
        validActions.value = message.validActions
        validPlays.value = message.validPlays
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
        receivedCardsForGiveBack.value = message.receivedCards
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
    console.log('Requesting President state resync from server')
    websocket.send({
      type: 'request_state',
    })
  }

  // Initialize - set up WebSocket listener
  let unsubscribe: (() => void) | null = null

  function initialize(): void {
    if (unsubscribe) return
    unsubscribe = websocket.onMessage(handleMessage)

    // Set up periodic sync check
    syncCheckInterval = setInterval(() => {
      // Check for stale state during turn or card-giving phase
      const needsSync = isMyTurn.value || isAwaitingGiveCards.value
      if (!gameState.value || !needsSync) return

      const timeSinceLastUpdate = Date.now() - lastStateReceivedAt
      if (timeSinceLastUpdate > 10000) {
        console.log('No state update for 10s while waiting for action - requesting resync')
        requestStateResync()
        lastStateReceivedAt = Date.now()
      }
    }, 5000)
  }

  function cleanup(): void {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    if (syncCheckInterval) {
      clearInterval(syncCheckInterval)
      syncCheckInterval = null
    }
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
    lastStateReceivedAt = 0
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

    // Actions
    playCards,
    pass,
    acknowledgeExchange,
    giveCards,
    bootPlayer,
    initialize,
    cleanup,
  }
})
