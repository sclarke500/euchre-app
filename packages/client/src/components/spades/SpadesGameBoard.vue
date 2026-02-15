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
    </div>

    <!-- HUD: Leave + Bug Report buttons -->
    <GameHUD
      game-type="spades"
      :build-payload="buildBugReportPayload"
      :show-resync="mode === 'multiplayer'"
      @leave="handleLeaveClick"
      @resync="store.requestStateResync?.()"
    />

    <!-- Spades Broken indicator -->
    <div v-if="store.spadesBroken" class="spades-broken-indicator">
      ♠ Broken
    </div>

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
        <div class="game-over-actions dialog-actions">
          <button class="action-btn dialog-btn dialog-btn--primary primary" @click="handlePlayAgain">Play Again</button>
          <button class="action-btn dialog-btn dialog-btn--muted" @click="emit('leave-game')">Exit</button>
        </div>
      </div>
    </Modal>

    <!-- Leave confirmation -->
    <Modal :show="showLeaveConfirm" aria-label="Leave game confirmation" @close="showLeaveConfirm = false">
      <div class="game-over-panel dialog-panel">
        <div class="game-over-title dialog-title">Leave Game?</div>
        <div class="panel-message dialog-text">You'll forfeit the current game.</div>
        <div class="game-over-actions dialog-actions">
          <button class="action-btn dialog-btn dialog-btn--muted" @click="confirmLeave">Leave</button>
          <button class="action-btn dialog-btn dialog-btn--primary primary" @click="showLeaveConfirm = false">Stay</button>
        </div>
      </div>
    </Modal>

    <!-- Action panel -->
    <div class="action-panel" :class="{ 'is-my-turn': store.isHumanTurn }">
      <div class="panel-header">
        <div class="panel-name">
          {{ userName }}
          <span v-if="store.humanPlayer?.bid" class="info-chip bid-chip user-bid-chip">
            {{ getBidDisplay(store.humanPlayer.bid) }}
          </span>
        </div>
        <TurnTimer
          v-if="mode === 'multiplayer'"
          ref="turnTimerRef"
          :active="store.isHumanTurn"
          :grace-period-ms="timerSettings.gracePeriodMs"
          :countdown-ms="timerSettings.countdownMs"
          @timeout="handleTurnTimeout"
        />
      </div>

      <template v-if="mode === 'multiplayer' && timedOutPlayerName">
        <div class="panel-message warning">{{ timedOutPlayerName }} timed out</div>
        <button
          v-if="store.timedOutPlayer !== null && store.timedOutPlayer !== store.humanPlayer?.id"
          class="action-btn"
          @click="store.bootPlayer?.(store.timedOutPlayer)"
        >
          Boot Player
        </button>
      </template>

      <!-- Bidding phase -->
      <template v-if="store.isHumanBidding">
        <div class="panel-message">Your bid</div>
        <div class="bid-selector">
          <select v-model="selectedBid" class="bid-select">
            <option v-for="n in 14" :key="n-1" :value="n-1">{{ n-1 }}</option>
          </select>
          <button class="action-btn primary" @click="handleBid">Bid {{ selectedBid }}</button>
        </div>
        <div class="special-bids">
          <button class="action-btn nil-btn" @click="handleNilBid">Nil</button>
        </div>
      </template>

      <!-- Playing phase -->
      <template v-else-if="store.isHumanPlaying">
        <div class="panel-message">Your turn - play a card</div>
      </template>

      <!-- Waiting -->
      <template v-else-if="store.phase === 'bidding'">
        <div class="panel-message">Waiting for bids...</div>
      </template>

      <template v-else-if="store.phase === 'playing' || store.phase === 'trick_complete'">
        <div class="panel-message">{{ currentPlayerName }}'s turn</div>
      </template>
    </div>
  </CardTable>
</template>

<script setup lang="ts">
import { computed, proxyRefs, ref } from 'vue'
import { type SpadesBid } from '@euchre/shared'
import CardTable from '../CardTable.vue'
import GameHUD from '../GameHUD.vue'
import Modal from '../Modal.vue'
import TurnTimer from '../TurnTimer.vue'
import { useCardTable } from '@/composables/useCardTable'
import { useSpadesGameAdapter } from '@/composables/useSpadesGameAdapter'
import { useSpadesDirector } from '@/composables/useSpadesDirector'
import { useSpadesBoardUi } from '@/composables/useSpadesBoardUi'

const props = withDefaults(defineProps<{
  mode?: 'singleplayer' | 'multiplayer'
}>(), {
  mode: 'singleplayer',
})

const emit = defineEmits<{
  'leave-game': []
}>()

const adapter = useSpadesGameAdapter(props.mode)
const store = proxyRefs(adapter)
const engine = useCardTable()
const tableRef = ref<InstanceType<typeof CardTable> | null>(null)
const turnTimerRef = ref<InstanceType<typeof TurnTimer> | null>(null)

const showLeaveConfirm = ref(false)
const boardRef = ref<HTMLElement | null>(null)

const {
  cardController,
  getPlayerAtSeat,
  playerNames,
  playerStatuses,
  dealerSeat,
  currentTurnSeat,
  dimmedCardIds,
} = useSpadesDirector(adapter, engine, {
  mode: props.mode,
  tableRef,
  boardRef,
  onGameLost: () => emit('leave-game'),
})

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
  handleNilBid,
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
  showLeaveConfirm.value = true
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
  return { gracePeriodMs: 30000, countdownMs: 30000 }
})

const timedOutPlayerName = computed(() => {
  if (store.timedOutPlayer === null || store.timedOutPlayer === undefined) return null
  return store.players.find((player: { id: number; name: string }) => player.id === store.timedOutPlayer)?.name ?? null
})

// ── Bug Report ──────────────────────────────────────────────────────────
function buildBugReportPayload() {
  return {
    mode: props.mode,
    phase: store.phase,
    currentPlayer: store.currentPlayer,
    roundNumber: store.roundNumber,
    scores: store.scores,
    spadesBroken: store.spadesBroken,
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
  }
}

// Play again
function handlePlayAgain() {
  store.startNewGame()
}

</script>

<style scoped lang="scss">
// Standard layout: scoreboard top-right, action panel bottom-left
.scoreboard {
  position: absolute;
  top: 10px;
  right: max(60px, env(safe-area-inset-right) + 50px);
  z-index: 500;
  background: rgba(20, 20, 30, 0.88);
  border: 1px solid #444;
  border-radius: 8px;
  padding: 8px 12px;
  backdrop-filter: blur(8px);
  font-size: 14px;
  color: #ccc;
}

.spades-scoreboard {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 130px;
  
  .score-row {
    display: grid;
    grid-template-columns: 40px 1fr 1fr;
    gap: 4px;
    align-items: center;
    padding: 6px 10px;
  }
  
  .score-label {
    font-weight: 600;
  }
  
  .score-value {
    font-weight: 700;
    font-size: 16px;
    color: #fff;
    text-align: center;
  }
  
  .score-bags {
    font-size: 14px;
    color: #f39c12;
    text-align: center;
  }
  
  .hand-bags {
    font-size: 11px;
    color: #e74c3c;
    margin-left: 2px;
  }
  
  .score-header {
    display: grid;
    grid-template-columns: 40px 1fr 1fr;
    gap: 4px;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.05);
    border-top: 1px solid rgba(255,255,255,0.1);
    font-size: 11px;
    color: #888;
    text-align: center;
    
    span:first-child {
      text-align: left;
    }
  }
}

.round-summary-panel {
  background: rgba(20, 20, 30, 0.95);
  border: 1px solid #555;
  border-radius: 12px;
  padding: 20px;
  min-width: 280px;
  max-width: 90vw;
}

.round-summary-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: #fff;
  text-align: center;
  margin-bottom: 16px;
}

.round-summary-table {
  margin-bottom: 16px;
}

.summary-header {
  display: grid;
  grid-template-columns: 1fr 60px 60px;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  margin-bottom: 8px;
  font-weight: 600;
  color: #aaa;
  text-align: center;
  
  span:first-child {
    text-align: left;
  }
}

.summary-row {
  display: grid;
  grid-template-columns: 1fr 60px 60px;
  gap: 8px;
  padding: 4px 0;
  color: #ccc;
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

.action-panel {
  position: absolute;
  bottom: 12px;
  right: max(12px, env(safe-area-inset-right));
  z-index: 600;
  background: rgba(20, 20, 30, 0.9);
  border: 1px solid #444;
  border-radius: 12px;
  padding: 12px 16px;
  backdrop-filter: blur(8px);
  min-width: 180px;
  
  &.is-my-turn {
    border: 2px solid rgba(255, 215, 0, 0.5);
    background: rgba(40, 38, 20, 0.92);
    box-shadow:
      0 0 12px rgba(255, 215, 0, 0.2),
      0 0 30px rgba(255, 215, 0, 0.08);
  }
  
  .panel-header {
    margin-bottom: 8px;
  }
  
  .panel-name {
    font-weight: 600;
    color: #fff;
    font-size: 1rem;
  }
  
  .panel-message {
    color: #aaa;
    font-size: 0.9rem;
    margin-bottom: 8px;

    &.warning {
      color: #f39c12;
      font-weight: 600;
    }
  }
}

.action-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  &.primary {
    background: linear-gradient(135deg, #d4a84b 0%, #b8942f 100%);
    color: #1a1a1a;
    
    &:hover {
      background: linear-gradient(135deg, #e0b555 0%, #c9a340 100%);
    }
  }
}

.spades-broken-indicator {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: #3498db;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: bold;
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

.bid-selector {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.bid-select {
  padding: 8px 12px;
  font-size: 1rem;
  border-radius: 8px;
  border: none;
  background: white;
  color: #1e4d2b;
}

.special-bids {
  display: flex;
  gap: 8px;
}

.nil-btn {
  background: #e74c3c !important;
  color: white !important;
}

.info-chip {
  display: inline-block;
  margin-right: 4px;
}
</style>
