<template>
  <CardTable
    ref="tableRef"
    :player-count="4"
    :player-names="playerNames"
    :player-statuses="playerStatuses"
    :avatar-opacities="[1, 1, 1, 1]"
    :engine="engine"
    :dealer-seat="dealerSeat"
    :current-turn-seat="currentTurnSeat"
    :dimmed-card-ids="dimmedCardIds"
    layout="normal"
    game-name="SPADES"
    @card-click="handleCardClick"
  >
    <!-- Player bid info tags (indexed by seat, not player ID) -->
    <template v-for="seat in [0, 1, 2, 3]" :key="seat" #[`player-info-${seat}`]>
      <div v-if="getPlayerAtSeat(seat)?.bid" class="info-chip bid-chip">
        {{ getBidDisplay(getPlayerAtSeat(seat)!.bid!) }}
      </div>
    </template>

    <!-- User avatar bid tag -->
    <template #user-info>
      <div v-if="store.humanPlayer?.bid" class="info-chip bid-chip">
        {{ getBidDisplay(store.humanPlayer.bid) }}
      </div>
    </template>

    <!-- Scoreboard (points and bags with column headers) -->
    <div class="scoreboard spades-scoreboard">
      <div class="score-row">
        <span class="score-label">Us</span>
        <span class="score-value">{{ scores[0]?.score ?? 0 }}</span>
        <span class="score-bags">
          {{ scores[0]?.bags ?? 0 }}<span v-if="(handBags[0] ?? 0) > 0" class="hand-bags">+{{ handBags[0] }}</span>
        </span>
      </div>
      <div class="score-row">
        <span class="score-label">Them</span>
        <span class="score-value">{{ scores[1]?.score ?? 0 }}</span>
        <span class="score-bags">
          {{ scores[1]?.bags ?? 0 }}<span v-if="(handBags[1] ?? 0) > 0" class="hand-bags">+{{ handBags[1] }}</span>
        </span>
      </div>
      <div class="score-header">
        <span></span>
        <span>Pts</span>
        <span>Bags</span>
      </div>
      <div v-if="store.spadesBroken" class="spades-broken-row">
        ♠ Broken
      </div>
    </div>

    <!-- HUD: Menu button -->
    <GameHUD
      game-type="spades"
      :build-payload="buildBugReportPayload"
      :show-resync="mode === 'multiplayer'"
      @leave="handleLeaveClick"
      @resync="store.requestStateResync?.()"
      @rules="showRulesModal = true"
      @bug-report-open="timerPaused = true"
      @bug-report-close="timerPaused = false"
    />

    <!-- Round Summary Modal -->
    <Modal :show="showRoundSummary" aria-label="Round summary" @close="dismissRoundSummary">
      <div class="round-summary-panel dialog-panel">
          <div class="round-summary-title dialog-title">Round Complete</div>
          <div class="round-summary-table">
            <div class="summary-header">
              <span></span>
              <span>Us</span>
              <span>Them</span>
            </div>
            <div class="summary-row">
              <span>Bid</span>
              <span>{{ roundSummary.usBid }}</span>
              <span>{{ roundSummary.themBid }}</span>
            </div>
            <div class="summary-row">
              <span>Tricks</span>
              <span>{{ roundSummary.usTricks }}</span>
              <span>{{ roundSummary.themTricks }}</span>
            </div>
            <div v-if="roundSummary.usBags || roundSummary.themBags" class="summary-row">
              <span>Bags</span>
              <span class="bags">{{ roundSummary.usBags || '' }}</span>
              <span class="bags">{{ roundSummary.themBags || '' }}</span>
            </div>
            <div class="summary-row">
              <span>Base Points</span>
              <span :class="{ positive: roundSummary.usBasePoints > 0, negative: roundSummary.usBasePoints < 0 }">
                {{ roundSummary.usBasePoints >= 0 ? '+' : '' }}{{ roundSummary.usBasePoints }}
              </span>
              <span :class="{ positive: roundSummary.themBasePoints > 0, negative: roundSummary.themBasePoints < 0 }">
                {{ roundSummary.themBasePoints >= 0 ? '+' : '' }}{{ roundSummary.themBasePoints }}
              </span>
            </div>
            <div v-if="roundSummary.usNilBonus || roundSummary.themNilBonus" class="summary-row">
              <span>Nil Bonus</span>
              <span class="positive">{{ roundSummary.usNilBonus ? '+' + roundSummary.usNilBonus : '' }}</span>
              <span class="positive">{{ roundSummary.themNilBonus ? '+' + roundSummary.themNilBonus : '' }}</span>
            </div>
            <div v-if="roundSummary.usNilPenalty || roundSummary.themNilPenalty" class="summary-row">
              <span>Nil Failed</span>
              <span class="negative">{{ roundSummary.usNilPenalty ? '-' + roundSummary.usNilPenalty : '' }}</span>
              <span class="negative">{{ roundSummary.themNilPenalty ? '-' + roundSummary.themNilPenalty : '' }}</span>
            </div>
            <div v-if="roundSummary.usBagPenalty || roundSummary.themBagPenalty" class="summary-row">
              <span>Bag Penalty</span>
              <span class="negative">{{ roundSummary.usBagPenalty ? '-' + roundSummary.usBagPenalty : '' }}</span>
              <span class="negative">{{ roundSummary.themBagPenalty ? '-' + roundSummary.themBagPenalty : '' }}</span>
            </div>
            <div class="summary-row total">
              <span>Round Total</span>
              <span :class="{ positive: roundSummary.usTotal > 0, negative: roundSummary.usTotal < 0 }">
                {{ roundSummary.usTotal >= 0 ? '+' : '' }}{{ roundSummary.usTotal }}
              </span>
              <span :class="{ positive: roundSummary.themTotal > 0, negative: roundSummary.themTotal < 0 }">
                {{ roundSummary.themTotal >= 0 ? '+' : '' }}{{ roundSummary.themTotal }}
              </span>
            </div>
            <div class="summary-row game-total">
              <span>Game Score</span>
              <span>{{ scores[0]?.score ?? 0 }}</span>
              <span>{{ scores[1]?.score ?? 0 }}</span>
            </div>
          </div>
          <div class="game-over-actions dialog-actions">
            <button class="action-btn dialog-btn dialog-btn--primary primary" @click="dismissRoundSummary">Continue</button>
          </div>
      </div>
    </Modal>

    <!-- Game Over overlay -->
    <Modal :show="store.gameOver" :dismiss-on-backdrop="false" aria-label="Game over" @close="emit('leave-game')">
      <div class="game-over-panel dialog-panel">
        <div class="game-over-title dialog-title">Game Over</div>
        <div class="game-over-result dialog-text">{{ winnerText }}</div>
        <div class="game-over-scores dialog-text">
          <span>Us {{ scores[0]?.score ?? 0 }} - {{ scores[1]?.score ?? 0 }} Them</span>
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

    <!-- Leave confirmation -->
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

    <!-- Multiplayer timeout controls -->
    <div v-if="mode === 'multiplayer' && timedOutPlayerName" class="timeout-controls">
      <span class="timeout-label">{{ timedOutPlayerName }} timed out</span>
      <button
        v-if="store.timedOutPlayer !== null && store.timedOutPlayer !== store.humanPlayer?.id"
        class="action-btn danger"
        @click="store.bootPlayer?.(store.timedOutPlayer)"
      >
        Boot Player
      </button>
    </div>

    <!-- Turn timer (left side, self-contained with panel and animation) -->
    <TurnTimer
      v-if="mode === 'multiplayer'"
      ref="turnTimerRef"
      :active="store.isHumanTurn || store.showBidWheel"
      :paused="timerPaused"
      :grace-period-ms="timerSettings.gracePeriodMs"
      :countdown-ms="timerSettings.countdownMs"
      :show-reset-button="humanCount < 3"
      @timeout="handleTurnTimeout"
    />

    <!-- Blind nil prompt (right side) - shows before cards revealed -->
    <BlindNilPrompt
      :visible="store.blindNilDecisionPending"
      @blind-nil="store.submitBlindNil"
      @show-cards="store.revealCards"
    />

    <!-- Bidding wheel (right side) - shows after cards revealed -->
    <SpadesBidWheel
      v-model="selectedBid"
      :visible="store.showBidWheel"
      @bid="handleBid"
    />
  </CardTable>

  <!-- Rules Modal -->
  <Modal :show="showRulesModal" aria-label="Spades Rules" @close="showRulesModal = false">
    <div class="rules-panel dialog-panel rules-modal">
      <h2>Spades Rules</h2>
      <div class="rules-content">
        <p><strong>Overview:</strong> 4 players in 2 teams. First team to 500 points wins. Uses full 52-card deck. Spades are always trump.</p>
        
        <p><strong>Card Ranking:</strong> A (high) → K → Q → J → 10 → 9 → 8 → 7 → 6 → 5 → 4 → 3 → 2 (low). Spades beat all other suits.</p>
        
        <p><strong>Dealing:</strong> 13 cards each (entire deck).</p>
        
        <p><strong>Bidding:</strong> Starting left of dealer, each player bids how many tricks they'll win (1-13). Team bids are combined. You must bid at least 1 (unless going nil).</p>
        
        <p><strong>Nil Bids:</strong></p>
        <p>• Nil: Bid to win zero tricks. +100 if successful, -100 if you take any.</p>
        <p>• Blind Nil: Declare before seeing cards. +200/-200. (High risk, high reward!)</p>
        
        <p><strong>Play:</strong> Player left of dealer leads (cannot lead spades first trick unless only spades in hand). Must follow suit if able. Spades can only be led after being "broken" (played on another trick).</p>
        
        <p><strong>Scoring:</strong></p>
        <p>• Make bid: 10 × bid points</p>
        <p>• Overtricks (bags): +1 each, but 10 bags = -100 penalty</p>
        <p>• Fail bid: -10 × bid points</p>
        <p>• Going negative (-200): Other team wins instantly</p>
      </div>
      <div class="dialog-actions">
        <button class="btn-primary" @click="showRulesModal = false">Got it</button>
      </div>
    </div>
  </Modal>

</template>

<script setup lang="ts">
import { computed, proxyRefs, ref } from 'vue'
import { type SpadesBid } from '@67cards/shared'
import CardTable from '@/components/CardTable.vue'
import GameHUD from '@/components/GameHUD.vue'
import Modal from '@/components/Modal.vue'
import TurnTimer from '@/components/TurnTimer.vue'
import SpadesBidWheel from './SpadesBidWheel.vue'
import BlindNilPrompt from './BlindNilPrompt.vue'
import { useCardTable } from '@/composables/useCardTable'
import { useSpadesGameAdapter } from './useSpadesGameAdapter'
import { useSpadesDirector } from './useSpadesDirector'
import { useSpadesBoardUi } from './useSpadesBoardUi'
import { useLobbyStore } from '@/stores/lobbyStore'

const props = withDefaults(defineProps<{
  mode?: 'singleplayer' | 'multiplayer'
}>(), {
  mode: 'singleplayer',
})

const emit = defineEmits<{
  'leave-game': []
}>()

// Multiplayer lobby integration
const lobbyStore = props.mode === 'multiplayer' ? useLobbyStore() : null
const isHost = computed(() => lobbyStore?.isHost ?? false)

const adapter = useSpadesGameAdapter(props.mode)
const store = proxyRefs(adapter)
const engine = useCardTable()
const tableRef = ref<InstanceType<typeof CardTable> | null>(null)
const turnTimerRef = ref<InstanceType<typeof TurnTimer> | null>(null)

const showLeaveConfirm = ref(false)
const showRulesModal = ref(false)
const timerPaused = ref(false)
const boardRef = ref<HTMLElement | null>(null)

const {
  cardController,
  getPlayerAtSeat,
  playerNames,
  playerStatuses,
  dealerSeat,
  currentTurnSeat,
  dimmedCardIds,
  initializeGame,
} = useSpadesDirector(adapter, engine, {
  mode: props.mode,
  tableRef,
  boardRef,
  onGameLost: () => emit('leave-game'),
})

if (props.mode === 'singleplayer') {
  initializeGame()
}

const {
  showRoundSummary,
  roundSummary,
  selectedBid,
  scores,
  handBags,
  userName,
  currentPlayerName,
  winnerText,
  getBidDisplay,
  handleBid,
  dismissRoundSummary,
} = useSpadesBoardUi(adapter, props.mode)

// Handle card click
function handleCardClick(cardId: string) {
  if (!store.isHumanPlaying) return
  
  const human = store.humanPlayer
  if (!human) return
  
  const card = human.hand.find((c: { id: string }) => c.id === cardId)
  if (!card) return
  
  // Check if legal
  if (!store.validPlays.some((c: { id: string }) => c.id === cardId)) return
  
  store.playCard(card)
}

// Leave game
function handleLeaveClick() {
  if (props.mode === 'multiplayer' && !store.gameOver) {
    showLeaveConfirm.value = true
  } else {
    emit('leave-game')
  }
}

function confirmLeave() {
  showLeaveConfirm.value = false
  emit('leave-game')
}

function handleTurnTimeout() {
  if (props.mode === 'multiplayer') {
    console.warn('[TurnTimer] Timeout reached — leaving game')
    emit('leave-game')
  }
}

const timerSettings = computed(() => {
  const params = new URLSearchParams(window.location.search)
  const speed = params.get('timerSpeed')
  if (speed === 'fast') {
    return { gracePeriodMs: 2000, countdownMs: 3000 }
  }
  // TODO: Re-enable timer after debugging. Was 30000/30000
  return { gracePeriodMs: 600000, countdownMs: 600000 }
})

// Count human players (for reset button visibility)
const humanCount = computed(() => 
  store.players.filter((p: { isHuman?: boolean }) => p.isHuman).length
)

const timedOutPlayerName = computed(() => {
  if (store.timedOutPlayer === null || store.timedOutPlayer === undefined) return null
  return store.players.find((player: { id: number; name: string }) => player.id === store.timedOutPlayer)?.name ?? null
})

// ── Bug Report ──────────────────────────────────────────────────────────
function buildBugReportPayload() {
  // Include user's hand and valid plays for debugging card selection issues
  const humanHand = store.humanPlayer?.hand ?? []
  const validPlayIds = store.validPlays?.map((c: { id: string }) => c.id) ?? []

  return {
    mode: props.mode,
    phase: store.phase,
    currentPlayer: store.currentPlayer,
    roundNumber: store.roundNumber,
    scores: store.scores,
    spadesBroken: store.spadesBroken,
    isHumanTurn: store.isHumanTurn,
    isHumanPlaying: store.isHumanPlaying,
    players: store.players.map((p: any) => ({
      id: p.id,
      name: p.name,
      bid: p.bid,
      tricksWon: p.tricksWon,
      handSize: p.hand?.length ?? p.handSize ?? 0,
    })),
    timedOutPlayer: store.timedOutPlayer ?? null,
    currentTrick: store.currentTrick,
    completedTricksCount: store.completedTricks?.length ?? 0,
    // Debug info for card selection issues
    userHandIds: humanHand.map((c: { id: string }) => c.id),
    validPlayIds,
    dimmedCount: humanHand.length - validPlayIds.length,
  }
}

// Play again
function handlePlayAgain() {
  if (props.mode === 'multiplayer') {
    lobbyStore?.restartGame()
  } else {
    store.startNewGame()
  }
}

</script>

<style scoped lang="scss">
// Standard layout: scoreboard fixed top-right, action panel bottom-left
.scoreboard {
  position: fixed;
  top: 8px;
  right: max(8px, env(safe-area-inset-right));
  z-index: 500;
  background: rgba(20, 20, 30, 0.85);
  border: 1px solid $surface-500;
  border-radius: 7px;
  padding: 0;
  backdrop-filter: blur(8px);
  font-size: 13px;
  color: #ccc;
}

.spades-scoreboard {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 120px;
  
  .score-row {
    display: grid;
    grid-template-columns: 34px 1fr 1fr;
    gap: 2px;
    align-items: center;
    padding: 4px 7px;
  }
  
  .score-label {
    font-weight: 600;
    font-size: 12px;
  }
  
  .score-value {
    font-weight: 700;
    font-size: 14px;
    color: #fff;
    text-align: center;
  }
  
  .score-bags {
    font-size: 13px;
    color: #f39c12;
    text-align: center;
  }
  
  .hand-bags {
    font-size: 11px;
    color: #e74c3c;
    margin-left: 1px;
  }
  
  .score-header {
    display: grid;
    grid-template-columns: 34px 1fr 1fr;
    gap: 2px;
    padding: 2px 7px;
    background: rgba(255, 255, 255, 0.05);
    border-top: 1px solid rgba(255,255,255,0.1);
    font-size: 10px;
    color: #888;
    text-align: center;
    
    span:first-child {
      text-align: left;
    }
  }
}

.round-summary-panel {
  background: rgba(20, 20, 30, 0.95);
  border: 1px solid $surface-500;
  border-radius: 10px;
  padding: 14px 16px;
  min-width: 220px;
  max-width: 90vw;
}

.round-summary-title {
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  text-align: center;
  margin-bottom: 10px;
}

.round-summary-table {
  margin-bottom: 12px;
}

.summary-header {
  display: grid;
  grid-template-columns: 1fr 50px 50px;
  gap: 6px;
  padding: 3px 0;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  margin-bottom: 6px;
  font-weight: 600;
  font-size: 11px;
  color: #aaa;
  text-align: center;
  
  span:first-child {
    text-align: left;
  }
}

.summary-row {
  display: grid;
  grid-template-columns: 1fr 50px 50px;
  gap: 6px;
  padding: 2px 0;
  color: #ccc;
  font-size: 12px;
  text-align: center;
  
  span:first-child {
    text-align: left;
    color: #aaa;
  }
  
  &.total {
    border-top: 1px solid rgba(255,255,255,0.2);
    margin-top: 8px;
    padding-top: 8px;
    font-weight: 700;
    color: #fff;
  }
  
  &.game-total {
    border-top: 2px solid rgba(255,215,0,0.5);
    margin-top: 8px;
    padding-top: 8px;
    font-weight: 700;
    font-size: 1.1rem;
    color: #ffd700;
  }
  
  .positive {
    color: #4CAF50;
  }
  
  .bags {
    color: #f39c12;
  }
  
  .negative {
    color: #e74c3c;
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

// Warning label style
.warning {
  color: #f39c12 !important;
}

// Timeout controls (multiplayer)
.timeout-controls {
  position: fixed;
  bottom: max(16px, env(safe-area-inset-bottom));
  left: max(16px, env(safe-area-inset-left));
  z-index: 600;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  
  .timeout-label {
    color: #f39c12;
    font-size: 13px;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.7);
    padding: 4px 10px;
    border-radius: 4px;
  }
  
  .action-btn.danger {
    padding: 8px 16px;
    background: rgba(180, 60, 60, 0.85);
    border: 1px solid rgba(180, 60, 60, 0.6);
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    
    &:hover {
      background: rgba(200, 80, 80, 0.9);
    }
  }
}

// Spades broken indicator inside scoreboard
.spades-broken-row {
  text-align: center;
  color: #3498db;
  font-size: 10px;
  font-weight: bold;
  padding: 3px 6px;
  border-top: 1px solid $surface-600;
}

.round-indicator {
  position: absolute;
  top: 10px;
  right: 60px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
}

.bid-chip {
  background: rgba(52, 152, 219, 0.8);
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
}

.tricks-chip {
  background: rgba(46, 204, 113, 0.8);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  margin-left: 4px;
}

.info-chip {
  display: inline-block;
  margin-right: 4px;
}

// Rules modal
.rules-panel {
  max-width: 400px;
  
  h2 {
    margin: 0 0 16px;
    font-size: 1.25rem;
  }
}

.rules-content {
  text-align: left;
  font-size: 0.9rem;
  line-height: 1.5;
  color: #ccc;
  
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
</style>
