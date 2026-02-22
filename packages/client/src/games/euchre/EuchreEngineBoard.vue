<template>
  <div class="euchre-board-wrapper">
  <CardTable
    ref="tableRef"
    :player-count="4"
    :player-names="director.playerNames.value"
    :player-avatars="director.playerAvatars.value"
    :player-statuses="director.playerStatuses.value"
    :avatar-opacities="avatarOpacities"
    :engine="engine"
    :dealer-seat="dealerSeat"
    :trump-caller-seat="trumpCallerSeat"
    :trump-symbol="trumpSymbol"
    :trump-color="trumpColor"
    :current-turn-seat="currentTurnSeat"
    :dimmed-card-ids="dimmedCardIds"
    layout="normal"
    game-name="EUCHRE"
    @card-click="handleCardClick"
    @layout-changed="handleLayoutChanged"
  >
    <!-- Scoreboard -->
    <div class="scoreboard">
      <div class="score-row">
        <span class="score-label">Us</span>
        <span class="score-value" :class="{ 'score-updated': usScoreAnimating }">
          {{ displayedScores[0] }}
        </span>
      </div>
      <div class="score-row">
        <span class="score-label">Them</span>
        <span class="score-value" :class="{ 'score-updated': themScoreAnimating }">
          {{ displayedScores[1] }}
        </span>
      </div>
    </div>

    <!-- HUD: Menu button -->
    <GameHUD
      game-type="euchre"
      :mode="mode"
      :build-payload="buildBugReportPayload"
      :show-resync="mode === 'multiplayer'"
      @leave="handleLeaveClick"
      @resync="handleResync"
      @rules="showRulesModal = true"
      @bug-report-open="timerPaused = true"
      @bug-report-close="timerPaused = false"
    />

    <!-- Game Over overlay -->
    <Modal :show="game.gameOver.value" :dismiss-on-backdrop="false" aria-label="Game over" @close="emit('leave-game')">
      <div class="game-over-panel dialog-panel">
        <div class="game-over-title dialog-title">Game Over</div>
        <div class="game-over-result dialog-text">{{ winnerText }}</div>
        <div class="game-over-scores dialog-text">
          <span>Us {{ teamScore(0) }} - {{ teamScore(1) }} Them</span>
        </div>
        <div v-if="mode === 'singleplayer' || isHost" class="game-over-actions dialog-actions">
          <button class="action-btn dialog-btn dialog-btn--primary primary" @click="handlePlayAgain">Play Again</button>
          <button class="action-btn dialog-btn dialog-btn--muted" @click="emit('leave-game')">Exit</button>
        </div>
        <div v-else class="game-over-actions dialog-actions">
          <div class="panel-message dialog-text">Waiting for host to start new game...</div>
          <button class="action-btn dialog-btn dialog-btn--muted" @click="emit('leave-game')">Leave</button>
        </div>
      </div>
    </Modal>

    <!-- Leave confirmation modal -->
    <Modal :show="showLeaveConfirm" aria-label="Leave game confirmation" @close="showLeaveConfirm = false">
      <div class="game-over-panel dialog-panel">
        <div class="game-over-title dialog-title">Leave Game?</div>
        <div class="panel-message dialog-text">You'll forfeit the current game.</div>
        <div class="game-over-actions dialog-actions">
          <button class="action-btn dialog-btn dialog-btn--muted" @click="showLeaveConfirm = false">Cancel</button>
          <button class="action-btn dialog-btn dialog-btn--primary primary" @click="confirmLeave">Leave</button>
        </div>
      </div>
    </Modal>

    <!-- Rules modal -->
    <Modal :show="showRulesModal" aria-label="Euchre Rules" @close="showRulesModal = false">
      <div class="modal-light rules-modal">
        <div class="modal-header">
          <h3>Euchre Rules</h3>
        </div>
        <div class="modal-body">
          <p><strong>Overview:</strong> 4 players in 2 teams. First team to 10 points wins. Uses 24 cards (9, 10, J, Q, K, A of each suit).</p>
          
          <p><strong>Card Ranking:</strong> In trump suit: Right Bower (Jack of trump) → Left Bower (Jack of same color) → A → K → Q → 10 → 9. Non-trump: A → K → Q → J → 10 → 9.</p>
          
          <p><strong>Dealing:</strong> 5 cards each. One card turned face-up to propose trump.</p>
          
          <p><strong>Bidding Round 1:</strong> Starting left of dealer, each player may "order up" the face-up card (making its suit trump) or pass. If ordered up, dealer takes the card and discards one.</p>
          
          <p><strong>Bidding Round 2:</strong> If all pass, players may call any OTHER suit as trump, or pass. Dealer must call if all others pass ("stuck the dealer").</p>
          
          <p><strong>Going Alone:</strong> The player who calls trump may "go alone" — their partner sits out. Success earns bonus points.</p>
          
          <p><strong>Play:</strong> Player left of dealer leads. Must follow suit if able. Highest trump wins, otherwise highest card of led suit. Winner leads next trick.</p>
          
          <p><strong>Scoring:</strong></p>
          <p>• Making trump (3-4 tricks): 1 point</p>
          <p>• March (all 5 tricks): 2 points</p>
          <p>• Alone march: 4 points</p>
          <p>• Euchred (makers take ≤2 tricks): 2 points to defenders</p>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" @click="showRulesModal = false">Got it</button>
        </div>
      </div>
    </Modal>

    <!-- Turn timer (left side, self-contained with panel and animation) -->
    <TurnTimer
      v-if="mode === 'multiplayer' && bootInactiveEnabled"
      ref="turnTimerRef"
      :active="game.isHumanTurn.value && !director.isAnimating.value"
      :paused="timerPaused"
      :grace-period-ms="timerSettings.gracePeriodMs"
      :countdown-ms="timerSettings.countdownMs"
      :show-reset-button="humanCount < 3"
      @timeout="handleTurnTimeout"
    />

    <!-- Chat input (multiplayer only) -->
    <ChatInput v-if="mode === 'multiplayer'" />

    <!-- User actions — sliding panel from right -->
    <Transition name="action-slide">
      <div v-if="showActionPanel" class="action-panel-container frosted-panel--right">
        <!-- Round 1: Pass or Order Up -->
        <template v-if="showBidding && game.biddingRound.value === 1">
          <button class="frosted-btn frosted-btn--primary" @click="handleOrderUp">
            {{ isUserDealer ? 'Pick Up' : 'Order Up' }}
          </button>
          <button class="frosted-btn" @click="handlePass">Pass</button>
          <label class="action-checkbox">
            <input type="checkbox" v-model="goAlone" />
            Alone
          </label>
        </template>

        <!-- Round 2: Pass or Call Suit -->
        <template v-else-if="showBidding && game.biddingRound.value === 2">
          <span v-if="mustCall" class="stick-dealer-label">Stick the Dealer!</span>
          <span class="action-label">{{ mustCall ? 'Pick trump' : 'Trump?' }}</span>
          <div class="suit-buttons">
            <button
              v-for="suit in availableSuits"
              :key="suit.name"
              class="frosted-btn suit-btn"
              :style="{ color: suit.color }"
              @click="handleCallSuit(suit.name)"
            >
              {{ suit.symbol }}
            </button>
          </div>
          <button v-if="!mustCall" class="frosted-btn" @click="handlePass">Pass</button>
          <label class="action-checkbox">
            <input type="checkbox" v-model="goAlone" />
            Alone
          </label>
        </template>

        <!-- Dealer discard -->
        <template v-else-if="game.phase.value === 'dealer_discard' && isUserDealer">
          <span class="discard-prompt">Tap a card to discard</span>
        </template>
      </div>
    </Transition>

    <!-- Disconnected player banner (multiplayer only) -->
    <DisconnectedPlayerBanner
      v-if="mode === 'multiplayer' && firstDisconnectedPlayer"
      :player-name="firstDisconnectedPlayer.name"
      :can-boot="true"
      @boot="handleBootDisconnected"
    />
  </CardTable>

  <!-- Chat (multiplayer only) -->
  <template v-if="mode === 'multiplayer'">
    <div class="chat-icon-container">
      <ChatIcon @click="showChatPanel = true" />
    </div>
    <ChatPanel :show="showChatPanel" @close="showChatPanel = false" />
  </template>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { GamePhase, BidAction, Suit, type TeamScore } from '@67cards/shared'
import CardTable from '@/components/CardTable.vue'
import TurnTimer from '@/components/TurnTimer.vue'
import GameHUD from '@/components/GameHUD.vue'
import Modal from '@/components/Modal.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ChatIcon from '@/components/chat/ChatIcon.vue'
import ChatPanel from '@/components/chat/ChatPanel.vue'
import DisconnectedPlayerBanner from '@/components/DisconnectedPlayerBanner.vue'
import { useCardTable } from '@/composables/useCardTable'
import { useEuchreGameAdapter } from './useEuchreGameAdapter'
import { useEuchreDirector } from './useEuchreDirector'
import { useEuchreMultiplayerStore } from './euchreMultiplayerStore'
import { useLobbyStore } from '@/stores/lobbyStore'
import { useEuchreGameStore } from './euchreGameStore'
import { websocket } from '@/services/websocket'

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
}
const SUIT_COLORS: Record<string, string> = {
  hearts: '#e74c3c', diamonds: '#e74c3c', clubs: '#2c3e50', spades: '#2c3e50',
}

const props = defineProps<{
  mode: 'singleplayer' | 'multiplayer'
}>()

const tableRef = ref<InstanceType<typeof CardTable> | null>(null)
const turnTimerRef = ref<InstanceType<typeof TurnTimer> | null>(null)

// Create engine externally — shared between CardTable and Director
const engine = useCardTable()
const game = useEuchreGameAdapter(props.mode)

// boardRef is resolved after CardTable mounts
const boardRef = ref<HTMLElement | null>(null)

const director = useEuchreDirector(game, engine, { boardRef })

const dealerSeat = computed(() => director.dealerSeat.value)
const currentTurnSeat = computed(() => director.currentTurnSeat.value)

// Trump caller info - find which seat called trump
const trumpCallerSeat = computed(() => {
  const info = director.playerInfo.value
  return info.findIndex(p => p.trumpSymbol)
})
const trumpSymbol = computed(() => {
  const seat = trumpCallerSeat.value
  if (seat < 0) return ''
  return director.playerInfo.value[seat]?.trumpSymbol ?? ''
})
const trumpColor = computed(() => {
  const seat = trumpCallerSeat.value
  if (seat < 0) return ''
  return director.playerInfo.value[seat]?.trumpColor ?? ''
})

const goAlone = ref(false)

// Avatar opacities - make partner semi-transparent when someone else goes alone
const avatarOpacities = computed(() => {
  const opacities = [1, 1, 1, 1] // Default full opacity
  const alonePartnerSeat = director.alonePartnerSeat.value
  if (alonePartnerSeat !== null) {
    opacities[alonePartnerSeat] = 0.5 // Semi-transparent
  }
  return opacities
})

const userName = computed(() => director.playerNames.value[0] ?? 'You')

// Timer settings - can be sped up via URL param for testing (e.g., ?timerSpeed=fast)
const timerSettings = computed(() => {
  const params = new URLSearchParams(window.location.search)
  const speed = params.get('timerSpeed')
  if (speed === 'fast') {
    // Fast mode for E2E testing: 2s grace + 3s countdown = 5s total
    return { gracePeriodMs: 2000, countdownMs: 3000 }
  }
  // Default: 30s grace + 30s countdown = 60s total
  // TODO: Re-enable timer after debugging. Was 30000/30000
  return { gracePeriodMs: 600000, countdownMs: 600000 }
})

// Count human players (for reset button visibility)
const humanCount = computed(() => 
  game.players.value.filter(p => p.isHuman).length
)

// First disconnected player (for banner display)
const firstDisconnectedPlayer = computed(() => {
  if (props.mode !== 'multiplayer' || !mpStore) return null
  const disconnected = mpStore.disconnectedPlayers
  return disconnected.length > 0 ? disconnected[0] : null
})

// Boot disconnected player
function handleBootDisconnected() {
  if (!mpStore || !firstDisconnectedPlayer.value) return
  mpStore.bootDisconnectedPlayer(firstDisconnectedPlayer.value.id)
}

// Map display row (0="Us", 1="Them") to actual team ID based on user's team
const myTeam = computed(() => game.myTeamId.value)
const opponentTeam = computed(() => 1 - game.myTeamId.value)

function teamScore(displayRow: number): number {
  const teamId = displayRow === 0 ? myTeam.value : opponentTeam.value
  return game.scores.value.find((s: TeamScore) => s.teamId === teamId)?.score ?? 0
}

// Delayed score display - updates after sweep animation
const displayedScores = ref([0, 0])
const usScoreAnimating = ref(false)
const themScoreAnimating = ref(false)

// Watch actual scores and update displayed scores with delay + animation
watch(
  () => [teamScore(0), teamScore(1)],
  ([newUs, newThem]) => {
    const oldUs = displayedScores.value[0]
    const oldThem = displayedScores.value[1]
    
    // Delay update to sync with sweep animation (~800ms after trick complete)
    setTimeout(() => {
      if (newUs !== oldUs) {
        usScoreAnimating.value = true
        displayedScores.value[0] = newUs
        setTimeout(() => { usScoreAnimating.value = false }, 400)
      }
      if (newThem !== oldThem) {
        themScoreAnimating.value = true
        displayedScores.value[1] = newThem
        setTimeout(() => { themScoreAnimating.value = false }, 400)
      }
    }, 800)
  },
  { immediate: true }
)

// Show bidding buttons when it's the user's turn during bidding
// In multiplayer, gate on !isAnimating so the deal animation finishes first
const showBidding = computed(() => {
  if (!game.isHumanTurn.value) return false
  if (director.isAnimating.value) return false
  const phase = game.phase.value
  return phase === GamePhase.BiddingRound1 || phase === GamePhase.BiddingRound2
})

// Show action panel when bidding or dealer discard
const showActionPanel = computed(() => {
  if (director.isAnimating.value) return false
  const phase = game.phase.value
  
  // DealerDiscard: show if user is dealer (currentPlayer already moved to next leader)
  if (phase === GamePhase.DealerDiscard) {
    return game.dealer.value === game.myPlayerId.value
  }
  
  // Bidding: show if it's user's turn
  if (!game.isHumanTurn.value) return false
  return phase === GamePhase.BiddingRound1 || phase === GamePhase.BiddingRound2
})

const isUserDealer = computed(() => game.dealer.value === game.myPlayerId.value)

// Stick the dealer check
const mustCall = computed(() => {
  return game.biddingRound.value === 2 && isUserDealer.value
})

// Available suits for round 2 (exclude the turned-down suit)
const availableSuits = computed(() => {
  const turnedDown = game.turnUpCard.value?.suit
  return Object.entries(SUIT_SYMBOLS)
    .filter(([name]) => name !== turnedDown)
    .map(([name, symbol]) => ({
      name: name as Suit,
      symbol,
      color: SUIT_COLORS[name] ?? '#ccc',
    }))
})

// --- Bid actions ---

function handleLayoutChanged() {
  director.handleLayoutChange()
}

function handlePass() {
  director.setPlayerStatus(0, 'Pass')
  game.makeBid(BidAction.Pass)
  goAlone.value = false
}

function handleResync() {
  game.requestResync?.()
}

function handleTurnTimeout() {
  // When the player times out on their own turn, leave the game
  // (bootPlayer only works for booting OTHER players who timed out server-side)
  if (props.mode === 'multiplayer') {
    console.warn('[TurnTimer] Timeout reached — leaving game')
    emit('leave-game')
  }
}

function buildBugReportPayload() {
  const queueLen = game.getQueueLength?.() ?? null
  const rawMpState = props.mode === 'multiplayer' ? (mpStore?.gameState ?? null) : null

  const wsInbound = websocket.getRecentInbound?.() ?? []
  const wsOutbound = websocket.getRecentOutbound?.() ?? []
  const mpRecentStates = props.mode === 'multiplayer'
    ? (mpStore?.recentStateSummaries ?? [])
    : []

  return {
    mode: props.mode,
    ui: {
      isAnimating: director.isAnimating.value,
      showBidding: showBidding.value,
      goAlone: goAlone.value,
    },
    adapter: {
      phase: game.phase.value,
      biddingRound: game.biddingRound.value,
      dealer: game.dealer.value,
      currentPlayer: game.currentPlayer.value,
      myPlayerId: game.myPlayerId.value,
      myTeamId: game.myTeamId.value,
      isHumanTurn: game.isHumanTurn.value,
      validPlays: game.validPlays.value,
      lastBidAction: game.lastBidAction.value,
      lastTrickWinnerId: game.lastTrickWinnerId.value,
      tricksTaken: game.tricksTaken.value,
    },
    multiplayer: props.mode === 'multiplayer'
      ? {
          queueLength: queueLen,
          stateSeq: rawMpState?.stateSeq ?? null,
          timedOutPlayer: rawMpState?.timedOutPlayer ?? null,
          recentStateSummaries: mpRecentStates,
        }
      : null,
    websocket: {
      inbound: wsInbound,
      outbound: wsOutbound,
    },
    rawState: rawMpState,
  }
}

function handleOrderUp() {
  const action = isUserDealer.value ? BidAction.PickUp : BidAction.OrderUp
  const label = isUserDealer.value ? 'Pick Up' : 'Order Up'
  director.setPlayerStatus(0, goAlone.value ? `${label} (Alone)` : label)
  game.makeBid(action, undefined, goAlone.value)
  goAlone.value = false
}

function handleCallSuit(suit: Suit) {
  const suitName = suit.charAt(0).toUpperCase() + suit.slice(1)
  director.setPlayerStatus(0, goAlone.value ? `${suitName} (Alone)` : suitName)
  game.makeBid(BidAction.CallTrump, suit, goAlone.value)
  goAlone.value = false
}

// --- Card click (play or discard) ---

// Stable ref for dimmed card IDs — only updates when the actual set of IDs changes,
// preventing flicker from reactive churn (game_state messages, turn_reminders, etc.)
const dimmedCardIds = shallowRef<Set<string>>(new Set())

watch(
  () => ({
    phase: game.phase.value,
    myTurn: game.isHumanTurn.value,
    animating: director.isAnimating.value,
    validSize: director.validCardIds.value.size,
    // Track the valid card IDs themselves (not the Set reference)
    validIds: [...director.validCardIds.value].join(','),
    handIds: game.myHand.value.map(c => c.id).join(','),
  }),
  ({ phase, myTurn, animating, validSize }) => {
    // Compute desired dimmed IDs
    const desired = new Set<string>()
    if (phase === GamePhase.Playing && myTurn && !animating && validSize > 0) {
      for (const card of game.myHand.value) {
        if (!director.validCardIds.value.has(card.id)) {
          desired.add(card.id)
        }
      }
    }

    // Only update the ref if the actual set content changed
    const current = dimmedCardIds.value
    if (desired.size !== current.size ||
        [...desired].some(id => !current.has(id))) {
      dimmedCardIds.value = desired
    }
  },
  { immediate: true },
)

function handleCardClick(cardId: string) {
  const phase = game.phase.value

  // Block all clicks during animation (prevents accidental discard of turn-up card)
  if (director.isAnimating.value) return

  if (phase === GamePhase.DealerDiscard && isUserDealer.value) {
    director.handleDealerDiscard(cardId)
  } else if (phase === GamePhase.Playing && game.isHumanTurn.value) {
    // Allow click if validCardIds is empty (server hasn't sent list yet) or card is valid
    if (director.validCardIds.value.size === 0 || director.validCardIds.value.has(cardId)) {
      game.playCard(cardId)
    }
  }
}

// Multiplayer lifecycle
const mpStore = props.mode === 'multiplayer' ? useEuchreMultiplayerStore() : null
const lobbyStore = props.mode === 'multiplayer' ? useLobbyStore() : null
const gameStore = props.mode === 'singleplayer' ? useEuchreGameStore() : null
const isHost = computed(() => lobbyStore?.isHost ?? false)
const bootInactiveEnabled = computed(() => lobbyStore?.currentTable?.settings?.bootInactive !== false)

// Game over state
const winnerText = computed(() => {
  if (!game.gameOver.value) return ''
  if (game.winner.value === game.myTeamId.value) return 'Your Team Wins!'
  if (game.winner.value !== null) return 'Opponents Win!'
  return 'Game Over'
})

function handlePlayAgain() {
  if (props.mode === 'multiplayer') {
    lobbyStore?.restartGame()
  } else {
    gameStore?.startNewGame()
  }
}

// Leave confirmation for multiplayer
const showLeaveConfirm = ref(false)
const showRulesModal = ref(false)
const showChatPanel = ref(false)
const timerPaused = ref(false)
const emit = defineEmits<{
  'leave-game': []
}>()

function handleLeaveClick() {
  if (props.mode === 'multiplayer' && !game.gameOver.value) {
    showLeaveConfirm.value = true
  } else {
    emit('leave-game')
  }
}

function confirmLeave() {
  showLeaveConfirm.value = false
  emit('leave-game')
}

onMounted(async () => {
  // Initialize game - multiplayer connects to server, single-player starts new game
  if (props.mode === 'multiplayer') {
    mpStore?.initialize()
  } else {
    gameStore?.startNewGame()
  }
  await nextTick()
  if (tableRef.value) {
    boardRef.value = tableRef.value.boardRef
  }
})

// Watch for game_lost signal from server — bail out to menu
watch(() => mpStore?.gameLost, (lost) => {
  if (lost) {
    console.warn('[EuchreBoard] Game lost — returning to menu')
    emit('leave-game')
  }
})

onUnmounted(() => {
  director.cleanup()
  mpStore?.cleanup()
})
</script>

<style scoped lang="scss">
.euchre-board-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.chat-icon-container {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 100;
}

.scoreboard {
  position: fixed;
  top: 8px;
  right: max(8px, env(safe-area-inset-right));
  z-index: 500;
  background: rgba(20, 20, 30, 0.85);
  border: 1px solid $surface-500;
  border-radius: 8px;
  padding: 6px 10px;
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: #ccc;

  .score-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .score-label {
    font-weight: 600;
    font-size: 13px;
    color: #aaa;
  }

  .score-value {
    font-weight: 700;
    font-size: 22px;
    color: #fff;
    min-width: 28px;
    text-align: right;
    position: relative;
    overflow: hidden;

    &.score-updated {
      animation: scoreSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
  }
}

@keyframes scoreSlideIn {
  0% {
    transform: translateY(-100%);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.info-chip {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
}

.trump-chip {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

// User trump badge in avatar slot - dark background to match avatar backdrop
.user-trump-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3a3a4c 0%, #2a2a3c 100%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

// Suit buttons need specific styling
.suit-btn {
  font-size: 24px !important;
  padding: 8px 16px !important;
  background: rgba(240, 240, 245, 0.95) !important;
  border-color: #bbb !important;

  &:hover {
    background: rgba(255, 255, 255, 0.98) !important;
  }
}

.game-over-panel {
  background: rgba(20, 20, 30, 0.95);
  border: 1px solid $surface-500;
  border-radius: 12px;
  padding: 20px 28px;
  text-align: center;
  min-width: 200px;
  backdrop-filter: blur(10px);
}

.game-over-title {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 6px;
}

.game-over-result {
  font-size: 14px;
  font-weight: 600;
  color: #ffd700;
  margin-bottom: 4px;
}

.game-over-scores {
  font-size: 12px;
  color: #aaa;
  margin-bottom: 14px;
}

.game-over-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.rules-content {
  text-align: left;
  font-size: 0.9rem;
  line-height: 1.5;
  
  p {
    margin: 0 0 12px;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
  
  strong {
    color: #fff;
  }
}

// Sliding action panel from right - uses global frosted-panel--right
.action-panel-container {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 600;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding: 16px 14px;
  padding-right: max(14px, env(safe-area-inset-right));
  min-width: 120px;
  border-radius: 20px 0 0 20px;
}

.action-panel-container .suit-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
}

.action-panel-container .suit-btn {
  font-size: 22px !important;
  padding: 8px 14px !important;
  width: 100%;
  background: rgba(240, 240, 245, 0.95) !important;
  border-color: #bbb !important;

  &:hover {
    background: rgba(255, 255, 255, 0.98) !important;
  }
}

.action-panel-container .action-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  cursor: pointer;
  user-select: none;

  input {
    accent-color: #2a8a6a;
  }
}

.action-panel-container .action-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 600;
}

.action-panel-container .discard-prompt {
  color: #ffd700;
  font-size: 15px;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  padding: 8px 16px;
  background: rgba(255, 215, 0, 0.15);
  border-radius: 8px;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.action-panel-container .stick-dealer-label {
  color: #ff6b6b;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  padding: 6px 14px;
  background: rgba(255, 107, 107, 0.15);
  border-radius: 6px;
  border: 1px solid rgba(255, 107, 107, 0.3);
  margin-bottom: 4px;
}

// Slide in from right transition
.action-slide-enter-active {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
}

.action-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease;
}

.action-slide-enter-from,
.action-slide-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(100%);
}

// Restore overlay
.restore-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 25, 20, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.restore-message {
  color: #88aa99;
  font-size: 18px;
  font-weight: 500;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// Chat icon positioned below HUD menu
.chat-icon-container {
  position: absolute;
  top: 60px;
  left: max(10px, env(safe-area-inset-left));
  z-index: 500;
}
</style>
