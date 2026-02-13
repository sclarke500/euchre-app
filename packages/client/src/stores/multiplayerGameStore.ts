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
import { GamePhase, getLegalPlays, BidAction as BidActionEnum } from '@euchre/shared'
import { websocket } from '@/services/websocket'
import { useToast } from '@/composables/useToast'
import { sendBugReport } from '@/services/autoBugReport'

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
  const gameLost = ref(false)  // Set when server says game is unrecoverable

  // Sync tracking
  const lastStateSeq = ref<number>(0)

  // ── Debug history (previous states) ─────────────────────────────────────

  type GameStateSummary = {
    ts: number
    stateSeq: number
    phase: ClientGameState['phase']
    biddingRound: ClientGameState['biddingRound']
    dealer: number
    currentPlayer: number
    trump: ClientGameState['trump']
    trumpCalledBy: ClientGameState['trumpCalledBy']
    goingAlone: boolean
    trickCount: number
    currentTrickCount: number
  }

  const recentStateSummaries = ref<GameStateSummary[]>([])
  const MAX_STATE_SUMMARIES = 10

  function pushStateSummary(state: ClientGameState) {
    const summary: GameStateSummary = {
      ts: Date.now(),
      stateSeq: state.stateSeq,
      phase: state.phase,
      biddingRound: state.biddingRound,
      dealer: state.dealer,
      currentPlayer: state.currentPlayer,
      trump: state.trump,
      trumpCalledBy: state.trumpCalledBy,
      goingAlone: state.goingAlone,
      trickCount: state.completedTricks,
      currentTrickCount: state.currentTrick?.cards?.length ?? 0,
    }
    recentStateSummaries.value = [...recentStateSummaries.value, summary].slice(-MAX_STATE_SUMMARIES)
  }

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
        pushStateSummary(message.state)

        // Fallback: if a `your_turn` message was missed (can happen during view transitions),
        // infer turn enablement from game_state so the user isn't hard-stuck.
        // We only fill validActions/validCards when currently empty so the server's
        // authoritative `your_turn` can still override cleanly when it arrives.
        if (myPlayerId.value >= 0 && message.state.currentPlayer === myPlayerId.value) {
          const phaseNow = message.state.phase
          const shouldEnableTurn =
            phaseNow === GamePhase.BiddingRound1 ||
            phaseNow === GamePhase.BiddingRound2 ||
            phaseNow === GamePhase.Playing ||
            phaseNow === GamePhase.DealerDiscard

          if (shouldEnableTurn) {
            isMyTurn.value = true

            if (validActions.value.length === 0) {
              if (phaseNow === GamePhase.BiddingRound1) {
                validActions.value = myPlayerId.value === message.state.dealer
                  ? [BidActionEnum.PickUp, BidActionEnum.Pass]
                  : [BidActionEnum.OrderUp, BidActionEnum.Pass]
              } else if (phaseNow === GamePhase.BiddingRound2) {
                // Without server passCount we can't know "stick the dealer" moment;
                // allow pass and let server validate.
                validActions.value = [BidActionEnum.CallTrump, BidActionEnum.Pass]
              } else if (phaseNow === GamePhase.DealerDiscard) {
                validActions.value = ['discard']
              } else if (phaseNow === GamePhase.Playing) {
                validActions.value = ['play_card']
              }
            }

            if (validCards.value.length === 0) {
              if (phaseNow === GamePhase.DealerDiscard) {
                validCards.value = (myHand.value ?? []).map(c => c.id)
              } else if (phaseNow === GamePhase.Playing) {
                const trumpSuit = message.state.trump
                const trick = message.state.currentTrick
                if (trumpSuit && trick && myHand.value) {
                  try {
                    validCards.value = getLegalPlays(myHand.value, trick, trumpSuit).map(c => c.id)
                  } catch {
                    // If anything is inconsistent, allow clicks and let server validate.
                    validCards.value = []
                  }
                }
              }
            }
          }
        } else {
          // Not our turn — clear any stale turn state (guards against stale
          // your_turn / turn_reminder messages from reconnection or race conditions)
          isMyTurn.value = false
          validActions.value = []
          validCards.value = []
        }
        break

      case 'your_turn':
        console.log('[MP] your_turn received, actions:', message.validActions)
        // Guard: reject stale your_turn if game state says it's not our turn
        if (gameState.value && gameState.value.currentPlayer !== myPlayerId.value) {
          console.warn('[MP] Ignoring stale your_turn — currentPlayer:', gameState.value.currentPlayer, 'myPlayerId:', myPlayerId.value)
          break
        }
        isMyTurn.value = true
        updateIfChanged(validActions, message.validActions)
        updateIfChanged(validCards, message.validCards ?? [])
        break

      case 'error':
        console.error('[MP] Server error:', message.message)

        // Game is unrecoverable - tell UI to bail out
        if (message.code === 'game_lost') {
          console.warn('[MP] Game lost - returning to menu')
          gameLost.value = true
          return
        }

        // Auto-report gameplay errors (not sync_required, not lobby/table errors)
        if (message.code !== 'sync_required' && gameState.value) {
          const toast = useToast()
          toast.show(
            'We ran into a snag. It has been reported. If the game stops working, please start another game.',
            'error',
            8000
          )

          try {
            // Slim payload to avoid 500KB limit - don't send rawState or full WS history
            sendBugReport({
              createdAt: new Date().toISOString(),
              trigger: 'auto',
              serverError: message.message,
              serverErrorCode: message.code ?? null,
              adapter: {
                phase: phase.value,
                biddingRound: biddingRound.value,
                dealer: dealer.value,
                currentPlayer: currentPlayer.value,
                myPlayerId: myPlayerId.value,
                myTeamId: myTeamId.value,
                isMyTurn: isMyTurn.value,
                validActions: validActions.value,
                validCards: validCards.value,
              },
              multiplayer: {
                stateSeq: lastStateSeq.value,
                queueLength: messageQueue.length,
                timedOutPlayer: gameState.value?.timedOutPlayer ?? null,
                recentStateSummaries: recentStateSummaries.value.slice(-5), // Last 5 only
              },
              recentWsMessages: websocket.getRecentInbound().slice(-10).map(m => ({
                ts: m.ts,
                type: m.message.type,
              })),
            })
          } catch (e) {
            console.error('[BugReport] Failed to collect diagnostics:', e)
          }
        }

        if (message.code === 'sync_required') {
          requestStateResync()
        } else {
          // If the server rejected an action but state indicates it's still our turn,
          // restore local turn state so the UI doesn't get stuck.
          const state = gameState.value
          if (state && myPlayerId.value >= 0 && state.currentPlayer === myPlayerId.value) {
            isMyTurn.value = true

            if (validActions.value.length === 0) {
              if (state.phase === GamePhase.BiddingRound1) {
                validActions.value = myPlayerId.value === state.dealer
                  ? [BidActionEnum.PickUp, BidActionEnum.Pass]
                  : [BidActionEnum.OrderUp, BidActionEnum.Pass]
              } else if (state.phase === GamePhase.BiddingRound2) {
                validActions.value = [BidActionEnum.CallTrump, BidActionEnum.Pass]
              } else if (state.phase === GamePhase.DealerDiscard) {
                validActions.value = ['discard']
              } else if (state.phase === GamePhase.Playing) {
                validActions.value = ['play_card']
              }
            }

            if (validCards.value.length === 0) {
              if (state.phase === GamePhase.DealerDiscard) {
                validCards.value = (myHand.value ?? []).map(c => c.id)
              } else if (state.phase === GamePhase.Playing) {
                const trumpSuit = state.trump
                const trick = state.currentTrick
                if (trumpSuit && trick && myHand.value) {
                  try {
                    validCards.value = getLegalPlays(myHand.value, trick, trumpSuit).map(c => c.id)
                  } catch {
                    validCards.value = []
                  }
                }
              }
            }
          }
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
        // Guard: reject stale reminders if game state says it's not our turn
        if (gameState.value && gameState.value.currentPlayer !== myPlayerId.value) {
          console.warn('[MP] Ignoring stale turn_reminder — currentPlayer:', gameState.value.currentPlayer, 'myPlayerId:', myPlayerId.value)
          break
        }
        isMyTurn.value = true
        // Only update validActions (for bid buttons). Do NOT update validCards —
        // the server may recompute them with stale trick state, causing flicker.
        // validCards are authoritatively set by your_turn only.
        updateIfChanged(validActions, message.validActions)
        break

      case 'bug_report_ack':
        if (message.issueUrl) {
          console.log('[BugReport] Issue created:', message.issueUrl)
        }
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

    if (!websocket.isConnected) {
      console.error('[MP] WebSocket not connected; cannot send bid:', action)
      // Keep local turn enabled so the user can retry.
      isMyTurn.value = true
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

    if (!websocket.isConnected) {
      console.error('[MP] WebSocket not connected; cannot play card:', cardId)
      // Keep local turn enabled so the user can retry.
      isMyTurn.value = true
      return
    }

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

    if (!websocket.isConnected) {
      console.error('[MP] WebSocket not connected; cannot discard card:', cardId)
      isMyTurn.value = true
      return
    }

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
    gameLost.value = false
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
    gameLost,

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

    // Debug
    recentStateSummaries,

    // Queue control (for director)
    enableQueueMode,
    disableQueueMode,
    dequeueMessage,
    getQueueLength,
    applyMessage,
  }
})
