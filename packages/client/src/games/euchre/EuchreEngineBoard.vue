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
    :trump-suit="trumpSuit"
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
          {{ displayedUsScore }}
        </span>
      </div>
      <div class="score-row">
        <span class="score-label">Them</span>
        <span class="score-value" :class="{ 'score-updated': themScoreAnimating }">
          {{ displayedThemScore }}
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
    <Modal :show="game.gameOver.value" scale-with-board :dismiss-on-backdrop="false" aria-label="Game over" @close="emit('leave-game')">
      <div class="game-over-panel dialog-panel">
        <div class="game-over-title dialog-title">Game Over</div>
        <div class="game-over-result dialog-text">{{ winnerText }}</div>
        <div class="game-over-scores dialog-text">
          <div class="final-score">
            <span class="final-score__label">Us</span>
            <span class="final-score__value">{{ teamScore(0) }}</span>
          </div>
          <div class="final-score">
            <span class="final-score__label">Them</span>
            <span class="final-score__value">{{ teamScore(1) }}</span>
          </div>
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
    <Modal :show="showLeaveConfirm" scale-with-board aria-label="Leave game confirmation" @close="showLeaveConfirm = false">
      <div class="game-dialog">
        <div class="game-dialog__title">Leave Game?</div>
        <div class="game-dialog__text">You'll forfeit the current game.</div>
        <div class="game-dialog__actions">
          <button class="game-dialog__btn game-dialog__btn--secondary" @click="showLeaveConfirm = false">Cancel</button>
          <button class="game-dialog__btn game-dialog__btn--primary" @click="confirmLeave">Leave</button>
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
          <p class="settings-note">⚙️ Game options available in Settings (from home screen)</p>
          
          <p><strong>Overview:</strong> 4 players in 2 teams. First team to 10 points wins. Uses 24 cards (9, 10, J, Q, K, A of each suit).</p>
          
          <p><strong>Card Ranking:</strong> In trump suit: Right Bower (Jack of trump) → Left Bower (Jack of same color) → A → K → Q → 10 → 9. Non-trump: A → K → Q → J → 10 → 9.</p>
          
          <p><strong>Dealing:</strong> 5 cards each. One card turned face-up to propose trump.</p>
          
          <p><strong>Bidding Round 1:</strong> Starting left of dealer, each player may "order up" the face-up card (making its suit trump) or pass. If ordered up, dealer takes the card and discards one.</p>
          
          <p><strong>Bidding Round 2:</strong> If all pass, players may call any OTHER suit as trump, or pass. Dealer must call if all others pass ("stuck the dealer").</p>
          
          <p><strong>Going Alone:</strong> The player who calls trump may "go alone" — their partner sits out. Success earns bonus points. <em>Canadian Loner:</em> If enabled, ordering up your partner forces you to go alone.</p>
          
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
          <button class="frosted-btn frosted-btn--pass" @click="handlePass">Pass</button>
          <div class="action-divider"></div>
          <button class="frosted-btn frosted-btn--primary" @click="handleOrderUp">
            {{ isUserDealer ? 'Pick Up' : 'Order Up' }}
          </button>
          <label class="action-checkbox">
            <span class="action-checkbox__text">Go Alone</span>
            <input type="checkbox" switch class="action-checkbox__box" v-model="goAlone" />
          </label>
        </template>

        <!-- Round 2: Pass or Call Suit -->
        <template v-else-if="showBidding && game.biddingRound.value === 2">
          <span v-if="mustCall" class="stick-dealer-label">Stick the Dealer!</span>
          <button v-if="!mustCall" class="frosted-btn frosted-btn--pass" @click="handlePass">Pass</button>
          <div v-if="!mustCall" class="action-divider"></div>
          <span class="action-label">{{ mustCall ? 'Pick trump' : 'Call trump' }}</span>
          <div class="suit-buttons">
            <button
              v-for="suit in availableSuits"
              :key="suit.name"
              class="frosted-btn suit-btn"
              :style="{ color: suit.color }"
              @click="handleCallSuit(suit.name)"
            >
              <SuitGlyph :suit="suit.name" class="suit-btn-glyph" />
            </button>
          </div>
          <label class="action-checkbox">
            <span class="action-checkbox__text">Go Alone</span>
            <input type="checkbox" switch class="action-checkbox__box" v-model="goAlone" />
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

  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { GamePhase, BidAction, Suit, type TeamScore } from '@67cards/shared'
import CardTable from '@/components/CardTable.vue'
import TurnTimer from '@/components/TurnTimer.vue'
import GameHUD from '@/components/GameHUD.vue'
import SuitGlyph from '@/components/SuitGlyph.vue'
import Modal from '@/components/Modal.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import DisconnectedPlayerBanner from '@/components/DisconnectedPlayerBanner.vue'
import { useCardTable } from '@/composables/useCardTable'
import { useEuchreGameAdapter } from './useEuchreGameAdapter'
import { useEuchreDirector } from './useEuchreDirector'
import { useEuchreMultiplayerStore } from './euchreMultiplayerStore'
import { useLobbyStore } from '@/stores/lobbyStore'
import { useEuchreGameStore } from './euchreGameStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { websocket } from '@/services/websocket'
import confetti from 'canvas-confetti'

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const
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
const settings = useSettingsStore()

// boardRef is resolved after CardTable mounts
const boardRef = ref<HTMLElement | null>(null)

const director = useEuchreDirector(game, engine, { boardRef })

const dealerSeat = computed(() => director.dealerSeat.value)
const currentTurnSeat = computed(() => director.currentTurnSeat.value)

// Trump caller info - find which seat called trump
const trumpCallerSeat = computed(() => {
  const info = director.playerInfo.value
  return info.findIndex(p => p.trumpSuit)
})
const trumpSuit = computed(() => {
  const seat = trumpCallerSeat.value
  if (seat < 0) return ''
  return director.playerInfo.value[seat]?.trumpSuit ?? ''
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
const displayedUsScore = ref(0)
const displayedThemScore = ref(0)
const usScoreAnimating = ref(false)
const themScoreAnimating = ref(false)

// Watch actual scores and update displayed scores with delay + animation
watch(
  () => [teamScore(0), teamScore(1)] as [number, number],
  ([newUs, newThem]) => {
    const oldUs = displayedUsScore.value
    const oldThem = displayedThemScore.value
    
    // Delay update to sync with sweep animation (~500ms after round complete)
    setTimeout(() => {
      if (newUs !== oldUs) {
        usScoreAnimating.value = true
        displayedUsScore.value = newUs
        setTimeout(() => { usScoreAnimating.value = false }, 800)
      }
      if (newThem !== oldThem) {
        themScoreAnimating.value = true
        displayedThemScore.value = newThem
        setTimeout(() => { themScoreAnimating.value = false }, 800)
      }
    }, 500)
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
  return SUITS
    .filter(name => name !== turnedDown)
    .map(name => ({
      name: name as Suit,
      color: SUIT_COLORS[name] ?? '#ccc',
    }))
})

// --- Bid actions ---

function handleLayoutChanged(layout: { tableBounds: { width: number } }) {
  director.setTableWidth(layout.tableBounds.width)
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
  
  // Canadian Loner: ordering up your partner forces going alone
  const dealerTeam = game.dealer.value % 2
  const isOrderingPartner = !isUserDealer.value && dealerTeam === game.myTeamId.value
  const forcedAlone = settings.canadianLoner && isOrderingPartner
  const actualGoAlone = goAlone.value || forcedAlone
  
  director.setPlayerStatus(0, actualGoAlone ? `${label} (Alone)` : label)
  game.makeBid(action, undefined, actualGoAlone)
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

  // Block all clicks while recovering from reconnect
  if (game.recoveryState?.value !== 'recovered' && game.recoveryState?.value !== undefined) {
    console.log('[Euchre] Blocking card click during recovery state:', game.recoveryState.value)
    return
  }

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

// Victory confetti when player wins
function celebrateWin() {
  const duration = 2000
  const end = Date.now() + duration
  const colors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6']
  
  ;(function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.6 },
      colors,
      zIndex: 100000,
    })
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.6 },
      colors,
      zIndex: 100000,
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  })()
}

// Watch for win and trigger celebration
watch(() => game.gameOver.value, (gameOver) => {
  if (gameOver && game.winner.value === game.myTeamId.value) {
    celebrateWin()
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
  top: calc(16px + var(--safe-top, 0px));
  left: calc(16px + var(--safe-left, 0px));
  z-index: 100;
}

.scoreboard {
  position: fixed;
  top: calc(8px + var(--safe-top, 0px));
  right: calc(8px + var(--safe-right, 0px));
  transform: scale(0.85); // -15%, anchored to its top-right corner
  transform-origin: top right;
  z-index: 500;
  background: rgba(20, 20, 30, 0.85);
  border: 1px solid $surface-500;
  border-radius: 12px;
  padding: 10px 16px;
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: #ccc;

  .score-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
  }

  .score-label {
    font-weight: 600;
    font-size: $ui-md;
    color: #aaa;
  }

  .score-value {
    font-weight: 700;
    font-size: $ui-xl;
    color: #fff;
    min-width: 44px;
    text-align: right;
    position: relative;
    overflow: hidden;

    &.score-updated {
      animation: scoreSlideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
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
  width: 1.7em; // box tracks the (readable-floored) font so it never crowds
  height: 1.7em;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $ui-sm;
  font-weight: bold;
}

.trump-chip {
  width: 1.5em;
  height: 1.5em;
  border-radius: 50%;
  background: linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%);
  font-size: $ui-md;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

// User trump badge in avatar slot - dark background to match avatar backdrop
.user-trump-badge {
  width: 1.7em;
  height: 1.7em;
  border-radius: 50%;
  background: linear-gradient(135deg, #3a3a4c 0%, #2a2a3c 100%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  font-size: $ui-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

// Suit buttons need specific styling
.suit-btn {
  font-size: $ui-lg !important;
  padding: 8px 16px !important;

  .suit-btn-glyph {
    // SVG pip sized relative to the button's font-size (matches the old text glyph)
    width: 0.85em;
    height: 0.85em;
    margin: 0 auto;
  }
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
  font-size: $ui-md;
  font-weight: 700;
  color: #fff;
  margin-bottom: 6px;
}

.game-over-result {
  font-size: $ui-sm;
  font-weight: 600;
  color: #ffd700;
  margin-bottom: 4px;
}

.game-over-scores {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 14px;

  .final-score {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .final-score__label {
    font-size: $ui-xs;
    color: #aaa;
  }

  .final-score__value {
    font-size: $ui-md;
    font-weight: 700;
    color: #fff;
  }
}

.game-over-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.rules-content {
  text-align: left;
  font-size: $ui-sm;
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
  // Float as a self-contained pill near the right edge (a small gap + the safe
  // inset) rather than a flush drawer — the safe area would otherwise expose its
  // square, border-less right side.
  right: calc(8px + var(--safe-right, 0px));
  // Bottom-anchored in the empty bottom-right corner so the panel clears the
  // right player's avatar (vertically centered on the table edge). Variable
  // panel heights grow upward from here; keep the tallest variant (round-2
  // trump calling) compact or it climbs back into the nameplate.
  bottom: calc(16px + var(--safe-bottom, 0px));
  transform: scale(0.9); // -10%, anchored to its bottom-right corner
  transform-origin: bottom right;
  z-index: 600;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  // Spacing is deliberately tight: the tallest variant (round-2 trump calling)
  // must stay below the right player's nameplate — check both bid rounds
  // before loosening.
  gap: 16px;
  padding: 24px 26px;
  min-width: 210px;
  border-radius: 32px;

  // Unified frosted panel with gold glow (shares vars with user avatar)
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-right: 1px solid var(--panel-border);
  box-shadow: 
    -4px 0 24px rgba(0, 0, 0, 0.4),
    0 0 var(--panel-glow-size) var(--panel-glow-color),
    inset 1px 1px 0 rgba(255, 255, 255, 0.1);
  animation: panel-glow 2s ease-in-out infinite;
}

@keyframes panel-glow {
  0%, 100% {
    box-shadow: 
      -4px 0 24px rgba(0, 0, 0, 0.4),
      0 0 var(--panel-glow-size) var(--panel-glow-color),
      inset 1px 1px 0 rgba(255, 255, 255, 0.1);
  }
  50% {
    box-shadow: 
      -4px 0 24px rgba(0, 0, 0, 0.4),
      0 0 var(--panel-glow-size-pulse) var(--panel-glow-color),
      inset 1px 1px 0 rgba(255, 255, 255, 0.15);
  }
}

// Pass button - neutral, strategic option (not cancel-like)
.action-panel-container .frosted-btn {
  font-size: $ui-lg;
  padding: 16px 28px;
}

.action-panel-container .frosted-btn--pass {
  background: linear-gradient(
    180deg,
    rgba(70, 75, 90, 0.92) 0%,
    rgba(50, 55, 70, 0.95) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
  
  &:hover:not(:disabled) {
    background: linear-gradient(
      180deg,
      rgba(80, 85, 100, 0.95) 0%,
      rgba(60, 65, 80, 0.95) 100%
    );
    border-color: rgba(255, 255, 255, 0.25);
  }
}

// Visual divider between Pass and action buttons
.action-panel-container .action-divider {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.15) 20%,
    rgba(255, 255, 255, 0.15) 80%,
    transparent 100%
  );
  margin: 2px 0;
}

.action-panel-container .suit-buttons {
  // One row: keeps the round-2 panel short enough that its top stays below
  // the right player's avatar (the panel is bottom-anchored and grows upward).
  // Extra width just overlaps empty felt; extra height covers the avatar.
  display: flex;
  gap: 8px;
  width: 100%;

  .suit-btn {
    flex: 1;
  }
}

.action-panel-container .suit-btn {
  font-size: $ui-xl !important;
  padding: 10px 18px !important;
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
  justify-content: space-between;
  gap: 12px;
  color: rgba(255, 255, 255, 0.85);
  font-size: $ui-sm; // label kept modest; the switch is the prominent control
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  margin-top: -4px; // Tuck closer to the action button above
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 10px;

  // Native checkbox — bulletproof (a replaced element can't collapse the way a
  // custom span track can). `switch` attr → native iOS toggle on Safari 17.4+;
  // `accent-color` colors the checked state everywhere else.
  .action-checkbox__box {
    flex-shrink: 0;
    width: ui-size(24px, 4.5vh, 36px);
    height: ui-size(24px, 4.5vh, 36px);
    margin: 0;
    cursor: pointer;
    accent-color: #2a8a6a;

    // WebKit draws `switch` inputs as a native toggle at its intrinsic
    // ~32×18px size — width/height only grow the layout box around it
    // (the control letterboxes inside). `zoom` is what actually scales the
    // drawn toggle. WebKit-only guard so Chrome's square checkbox (which
    // does obey width/height) is unaffected.
    @supports (-webkit-touch-callout: none) {
      width: auto;
      height: auto;
      zoom: 1.8;
    }
  }
}

.action-panel-container .action-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: $ui-md;
  font-weight: 600;
}

.action-panel-container .discard-prompt {
  color: #ffd700;
  font-size: $ui-lg;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  padding: 8px 16px;
  background: rgba(255, 215, 0, 0.15);
  border-radius: 8px;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.action-panel-container .stick-dealer-label {
  color: #ff6b6b;
  font-size: $ui-sm;
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
  font-size: $ui-md;
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
  left: 10px; // ScaledContainer handles safe areas now
  z-index: 500;
}
</style>
