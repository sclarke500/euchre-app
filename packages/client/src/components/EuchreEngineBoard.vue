<template>
  <CardTable
    ref="tableRef"
    :player-count="4"
    :player-names="director.playerNames.value"
    :player-statuses="director.playerStatuses.value"
    :engine="engine"
    :dealer-seat="dealerSeat"
    :current-turn-seat="currentTurnSeat"
    :dimmed-card-ids="dimmedCardIds"
    layout="normal"
    @card-click="handleCardClick"
  >
    <!-- Player info tags via named slots -->
    <template v-for="(info, i) in director.playerInfo.value" :key="i" #[`player-info-${i}`]>
      <div v-if="info.trumpSymbol" class="info-chip trump-chip" :style="{ color: info.trumpColor }">
        {{ info.trumpSymbol }}
      </div>
    </template>

    <!-- Scoreboard -->
    <div class="scoreboard">
      <div class="score-row">
        <span class="score-label">Us</span>
        <span class="score-value">{{ teamScore(0) }}</span>
        <span class="score-tricks">{{ game.tricksTaken.value[myTeam] }}</span>
      </div>
      <div class="score-row">
        <span class="score-label">Them</span>
        <span class="score-value">{{ teamScore(1) }}</span>
        <span class="score-tricks">{{ game.tricksTaken.value[opponentTeam] }}</span>
      </div>
      <div class="score-header">
        <span></span>
        <span>Pts</span>
        <span>Trk</span>
      </div>
    </div>

    <!-- Leave game button -->
    <button class="leave-btn" @click="handleLeaveClick">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>

    <!-- Game Over overlay -->
    <div v-if="game.gameOver.value" class="game-over-overlay">
      <div class="game-over-panel">
        <div class="game-over-title">Game Over</div>
        <div class="game-over-result">{{ winnerText }}</div>
        <div class="game-over-scores">
          <span>Us {{ teamScore(0) }} - {{ teamScore(1) }} Them</span>
        </div>
        <div v-if="mode === 'singleplayer' || isHost" class="game-over-actions">
          <button class="action-btn primary" @click="handlePlayAgain">Play Again</button>
          <button class="action-btn" @click="emit('leave-game')">Exit</button>
        </div>
        <div v-else class="game-over-actions">
          <div class="panel-message">Waiting for host...</div>
          <button class="action-btn" @click="emit('leave-game')">Exit</button>
        </div>
      </div>
    </div>

    <!-- Leave confirmation modal -->
    <div v-if="showLeaveConfirm" class="game-over-overlay">
      <div class="game-over-panel">
        <div class="game-over-title">Leave Game?</div>
        <div class="panel-message">You'll forfeit the current game.</div>
        <div class="game-over-actions">
          <button class="action-btn" @click="confirmLeave">Leave</button>
          <button class="action-btn primary" @click="showLeaveConfirm = false">Stay</button>
        </div>
      </div>
    </div>

    <!-- User action panel — always visible -->
    <div class="action-panel" :class="{ 'is-my-turn': game.isMyTurn.value && !director.isAnimating.value }">
      <div class="panel-name">
        <span v-if="userTrumpInfo" class="panel-badge" :style="{ color: userTrumpInfo.color }">{{ userTrumpInfo.symbol }}</span>
        {{ userName }}
      </div>

      <div class="panel-tools">
        <button v-if="mode === 'multiplayer'" class="tool-btn" @click="handleResync">Resync</button>
        <button class="tool-btn" @click="openBugReport">Report</button>
      </div>

      <!-- Round 1: Pass or Order Up -->
      <template v-if="showBidding && game.biddingRound.value === 1">
        <button class="action-btn primary" @click="handleOrderUp">
          {{ isUserDealer ? 'Pick Up' : 'Order Up' }}
        </button>
        <button class="action-btn" @click="handlePass">Pass</button>
        <label class="alone-toggle">
          <input type="checkbox" v-model="goAlone" />
          Alone
        </label>
      </template>

      <!-- Round 2: Pass or Call Suit -->
      <template v-else-if="showBidding && game.biddingRound.value === 2">
        <div class="panel-message">Call trump{{ mustCall ? ' (must call)' : '' }}</div>
        <div class="suit-row">
          <button
            v-for="suit in availableSuits"
            :key="suit.name"
            class="action-btn suit-btn"
            :style="{ color: suit.color }"
            @click="handleCallSuit(suit.name)"
          >
            {{ suit.symbol }}
          </button>
        </div>
        <button v-if="!mustCall" class="action-btn" @click="handlePass">Pass</button>
        <label class="alone-toggle">
          <input type="checkbox" v-model="goAlone" />
          Alone
        </label>
      </template>

      <!-- Dealer discard -->
      <template v-else-if="game.phase.value === 'dealer_discard' && isUserDealer">
        <div class="panel-message">Discard a card</div>
      </template>

      <!-- Playing phase — your turn -->
      <template v-else-if="game.phase.value === 'playing' && game.isMyTurn.value && !director.isAnimating.value">
        <div class="panel-message">Your turn</div>
      </template>
    </div>
  </CardTable>

  <Modal :show="showBugReport" @close="showBugReport = false">
    <div class="bug-modal">
      <div class="bug-title">Bug Report</div>
      <div class="bug-subtitle">Copies a snapshot you can paste into a GitHub issue or DM.</div>

      <textarea
        v-model="bugDescription"
        class="bug-textarea"
        rows="4"
        placeholder="What happened? What did you expect? Rough steps to reproduce?"
      />

      <div class="bug-actions">
        <button class="action-btn" @click="copyBugReport">Copy report</button>
        <button class="action-btn" @click="downloadBugReport">Download JSON</button>
        <button v-if="mode === 'multiplayer'" class="action-btn" @click="handleResync">Resync state</button>
        <button class="action-btn primary" @click="showBugReport = false">Close</button>
      </div>

      <div v-if="copyStatus" class="bug-status">{{ copyStatus }}</div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { GamePhase, BidAction, Suit, type TeamScore } from '@euchre/shared'
import CardTable from './CardTable.vue'
import Modal from './Modal.vue'
import { useCardTable } from '@/composables/useCardTable'
import { useGameAdapter } from '@/composables/useGameAdapter'
import { useEuchreDirector } from '@/composables/useEuchreDirector'
import { useMultiplayerGameStore } from '@/stores/multiplayerGameStore'
import { useLobbyStore } from '@/stores/lobbyStore'
import { useGameStore } from '@/stores/gameStore'

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

// Create engine externally — shared between CardTable and Director
const engine = useCardTable()
const game = useGameAdapter(props.mode)

// boardRef is resolved after CardTable mounts
const boardRef = ref<HTMLElement | null>(null)

const director = useEuchreDirector(game, engine, { boardRef })

const dealerSeat = computed(() => director.dealerSeat.value)
const currentTurnSeat = computed(() => director.currentTurnSeat.value)
const goAlone = ref(false)

const userName = computed(() => director.playerNames.value[0] ?? 'You')
const userTrumpInfo = computed(() => {
  const info = director.playerInfo.value[0]
  if (!info?.trumpSymbol) return null
  return { symbol: info.trumpSymbol, color: info.trumpColor }
})

// Map display row (0="Us", 1="Them") to actual team ID based on user's team
const myTeam = computed(() => game.myTeamId.value)
const opponentTeam = computed(() => 1 - game.myTeamId.value)

function teamScore(displayRow: number): number {
  const teamId = displayRow === 0 ? myTeam.value : opponentTeam.value
  return game.scores.value.find((s: TeamScore) => s.teamId === teamId)?.score ?? 0
}

// Show bidding buttons when it's the user's turn during bidding
// In multiplayer, gate on !isAnimating so the deal animation finishes first
const showBidding = computed(() => {
  if (!game.isMyTurn.value) return false
  if (director.isAnimating.value) return false
  const phase = game.phase.value
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

function handlePass() {
  director.setPlayerStatus(0, 'Pass')
  game.makeBid(BidAction.Pass)
  goAlone.value = false
}

function handleResync() {
  game.requestResync?.()
}

const showBugReport = ref(false)
const bugDescription = ref('')
const copyStatus = ref<string>('')

function openBugReport() {
  copyStatus.value = ''
  showBugReport.value = true
}

function buildBugReportPayload() {
  const now = new Date().toISOString()
  const queueLen = game.getQueueLength?.() ?? null
  const rawMpState = props.mode === 'multiplayer' ? (mpStore?.gameState ?? null) : null

  return {
    createdAt: now,
    description: bugDescription.value.trim(),
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
      isMyTurn: game.isMyTurn.value,
      validCards: game.validCards.value,
      lastBidAction: game.lastBidAction.value,
      lastTrickWinnerId: game.lastTrickWinnerId.value,
      tricksTaken: game.tricksTaken.value,
    },
    multiplayer: props.mode === 'multiplayer'
      ? {
          queueLength: queueLen,
          stateSeq: rawMpState?.stateSeq ?? null,
          timedOutPlayer: rawMpState?.timedOutPlayer ?? null,
        }
      : null,
    rawState: rawMpState,
  }
}

async function copyBugReport() {
  try {
    const payload = buildBugReportPayload()
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    copyStatus.value = 'Copied to clipboard.'
    setTimeout(() => { copyStatus.value = '' }, 1500)
  } catch (err) {
    console.error('Failed to copy bug report:', err)
    copyStatus.value = 'Copy failed (see console).'
  }
}

function downloadBugReport() {
  const payload = buildBugReportPayload()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `euchre-bug-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
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
    myTurn: game.isMyTurn.value,
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

  if (phase === GamePhase.DealerDiscard && isUserDealer.value) {
    director.handleDealerDiscard(cardId)
  } else if (phase === GamePhase.Playing && game.isMyTurn.value) {
    if (director.isAnimating.value) return
    // Allow click if validCardIds is empty (server hasn't sent list yet) or card is valid
    if (director.validCardIds.value.size === 0 || director.validCardIds.value.has(cardId)) {
      game.playCard(cardId)
    }
  }
}

// Multiplayer lifecycle
const mpStore = props.mode === 'multiplayer' ? useMultiplayerGameStore() : null
const lobbyStore = props.mode === 'multiplayer' ? useLobbyStore() : null
const gameStore = props.mode === 'singleplayer' ? useGameStore() : null
const isHost = computed(() => lobbyStore?.isHost ?? false)

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
  mpStore?.initialize()
  await nextTick()
  if (tableRef.value) {
    boardRef.value = tableRef.value.boardRef
  }
})

onUnmounted(() => {
  director.cleanup()
  mpStore?.cleanup()
})
</script>

<style scoped lang="scss">
.scoreboard {
  position: absolute;
  top: 10px;
  right: max(12px, env(safe-area-inset-right));
  z-index: 500;
  background: rgba(20, 20, 30, 0.88);
  border: 1px solid #444;
  border-radius: 8px;
  padding: 0;
  backdrop-filter: blur(8px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-size: 14px;
  color: #ccc;
  width: 130px;

  .score-header {
    display: grid;
    grid-template-columns: 1fr 34px 34px;
    gap: 0;
    padding: 3px 10px;
    font-size: 10px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    order: -1;

    span {
      text-align: center;

      &:first-child {
        text-align: left;
      }
    }
  }

  .score-row {
    display: grid;
    grid-template-columns: 1fr 34px 34px;
    gap: 0;
    padding: 4px 10px;
    align-items: center;

    &:last-of-type {
      border-bottom: none;
    }
  }

  .score-label {
    font-weight: 600;
    font-size: 13px;
  }

  .score-value {
    text-align: center;
    font-weight: 700;
    font-size: 15px;
    color: #fff;
  }

  .score-tricks {
    text-align: center;
    font-weight: 600;
    font-size: 13px;
    color: #aaa;
  }
}

.leave-btn {
  position: absolute;
  top: 10px;
  left: max(10px, env(safe-area-inset-left));
  z-index: 500;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid #444;
  background: rgba(30, 30, 40, 0.85);
  color: #ccc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);

  &:hover { background: rgba(50, 50, 65, 0.9); }

  svg {
    width: 20px;
    height: 20px;
  }
}

.info-chip {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
}

.trump-chip {
  background: linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%);
  font-size: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

// User action panel — stacked vertical layout, bottom-right
.action-panel {
  position: absolute;
  bottom: 12px;
  right: max(12px, env(safe-area-inset-right));
  z-index: 600;
  background: rgba(20, 20, 30, 0.92);
  border: 1px solid #444;
  border-radius: 10px;
  padding: 10px 12px;
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  width: 130px;
  min-height: 135px;
  transition: box-shadow var(--anim-slow) ease, border-color var(--anim-slow) ease, background var(--anim-slow) ease;

  &.is-my-turn {
    border: 2px solid rgba(255, 215, 0, 0.5);
    background: rgba(40, 38, 20, 0.92);
    box-shadow:
      0 0 12px rgba(255, 215, 0, 0.2),
      0 0 30px rgba(255, 215, 0, 0.08);
  }
}

.panel-tools {
  display: flex;
  gap: 8px;
}

.tool-btn {
  flex: 1;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: #bbb;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background var(--anim-fast), color var(--anim-fast);

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
}

.bug-modal {
  width: min(520px, 92vw);
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
}

.bug-title {
  font-size: 16px;
  font-weight: 800;
  color: #222;
}

.bug-subtitle {
  font-size: 12px;
  color: rgba(20, 20, 20, 0.75);
}

.bug-textarea {
  width: 100%;
  resize: vertical;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  padding: 10px;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.75);
}

.bug-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.bug-status {
  font-size: 12px;
  color: rgba(20, 20, 20, 0.7);
}

.panel-name {
  font-size: 13px;
  font-weight: 700;
  color: #eee;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;

  .panel-badge {
    font-size: 14px;
    line-height: 1;
  }
}

.panel-message {
  font-size: 12px;
  color: #aaa;
  text-align: center;
}

.action-btn {
  padding: 10px 8px;
  border-radius: 6px;
  border: 1px solid #555;
  background: rgba(50, 50, 65, 0.9);
  color: #ccc;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--anim-fast);
  text-align: center;

  &:hover {
    background: rgba(70, 70, 90, 0.95);
    color: #fff;
  }

  &.primary {
    background: rgba(36, 115, 90, 0.9);
    border-color: #2a8a6a;
    color: #fff;

    &:hover {
      background: rgba(46, 135, 110, 0.95);
    }
  }

  &.suit-btn {
    font-size: 22px;
    padding: 8px 0;
    flex: 1;
    min-width: 0;
    background: rgba(240, 240, 245, 0.92);
    border-color: #aaa;

    &:hover {
      background: rgba(255, 255, 255, 0.97);
    }
  }
}

.suit-row {
  display: flex;
  gap: 4px;
}

.alone-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: #999;
  cursor: pointer;
  user-select: none;

  input {
    accent-color: #2a8a6a;
  }
}

.game-over-overlay {
  position: absolute;
  inset: 0;
  z-index: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.game-over-panel {
  background: rgba(20, 20, 30, 0.95);
  border: 1px solid #555;
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
</style>
