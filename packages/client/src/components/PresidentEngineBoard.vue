<template>
  <CardTable
    ref="tableRef"
    :player-count="playerCount"
    :player-names="director.playerNames.value"
    :player-statuses="director.playerStatuses.value"
    :engine="engine"
    :dealer-seat="-1"
    :current-turn-seat="currentTurnSeat"
    :dimmed-card-ids="dimmedCardIds"
    :selected-card-ids="selectedCardIds"
    :highlighted-card-ids="highlightedCardIds"
    layout="wide"
    @card-click="handleCardClick"
  >
    <!-- Player rank badges via named slots -->
    <template v-for="(player, i) in game.players.value" :key="i" #[`player-info-${playerIdToSeatIndex(i)}`]>
      <div v-if="getRankBadge(i)" class="info-chip rank-chip">
        {{ getRankBadge(i) }}
      </div>
    </template>

    <!-- HUD: Leave + Bug Report buttons -->
    <GameHUD
      game-type="president"
      :build-payload="buildBugReportPayload"
      :show-resync="mode === 'multiplayer'"
      @leave="showLeaveConfirm = true"
      @resync="game.requestResync?.()"
    />

    <!-- Game info (top-left) -->
    <div class="game-info">
      <div class="game-title">President</div>
      <div class="round-info">Round {{ game.roundNumber.value }}</div>
      <div v-if="pileStatus" class="pile-status">{{ pileStatus }}</div>
    </div>

    <!-- User action panel — bottom right -->
    <div class="action-panel" :class="{ 'is-my-turn': game.isHumanTurn.value || game.isHumanGivingCards.value }">
      <div class="panel-header">
        <div class="panel-name">
          <span v-if="userRankBadge" class="panel-badge">{{ userRankBadge }}</span>
          {{ userName }}
        </div>
        <TurnTimer 
          v-if="props.mode === 'multiplayer'"
          ref="turnTimerRef"
          :active="game.isHumanTurn.value && !director.isAnimating.value"
          :grace-period-ms="timerSettings.gracePeriodMs"
          :countdown-ms="timerSettings.countdownMs"
          @timeout="handleTurnTimeout"
        />
      </div>

      <!-- Give-back phase -->
      <template v-if="game.isHumanGivingCards.value">
        <div class="panel-message giving">
          Give {{ game.cardsToGiveCount.value }} card{{ game.cardsToGiveCount.value > 1 ? 's' : '' }}
        </div>
        <div v-if="selectedCardIds.size > 0" class="selection-count">
          {{ selectedCardIds.size }}/{{ game.cardsToGiveCount.value }}
        </div>
        <button
          class="action-btn primary"
          :disabled="selectedCardIds.size !== game.cardsToGiveCount.value"
          @click="confirmGiveBack"
        >
          Give Cards
        </button>
      </template>

      <!-- Playing phase, user's turn -->
      <template v-else-if="game.isHumanTurn.value">
        <div v-if="selectedCardIds.size > 0" class="selection-count">
          {{ selectedCardIds.size }} selected
          <span v-if="!canPlaySelection" class="invalid-hint">Invalid</span>
        </div>
        <div v-else class="panel-message">Your turn</div>
        <button
          class="action-btn primary"
          :disabled="!canPlaySelection"
          @click="playSelectedCards"
        >
          Play{{ selectedCardIds.size > 0 ? ` (${selectedCardIds.size})` : '' }}
        </button>
        <button
          class="action-btn"
          :disabled="game.currentPile.value.currentRank === null"
          @click="passTurn"
        >
          Pass
        </button>
      </template>

      <!-- Waiting -->
      <template v-else-if="phase === PresidentPhase.Playing">
        <div class="panel-message">Waiting...</div>
      </template>
    </div>

    <!-- Round complete modal -->
    <Modal :show="phase === PresidentPhase.RoundComplete" @close="() => {}">
      <div class="round-modal">
        <h3>Round {{ game.roundNumber.value }} Complete!</h3>
        <div class="rankings">
          <div
            v-for="(playerId, index) in game.finishedPlayers.value"
            :key="playerId"
            class="ranking-row"
          >
            <span class="position">#{{ index + 1 }}</span>
            <span class="name">{{ game.players.value[playerId]?.name }}</span>
            <span class="title">{{ game.getPlayerRankDisplay(playerId) }}</span>
          </div>
        </div>
        <p v-if="!game.gameOver.value" class="next-round-msg">Next round starting...</p>
      </div>
    </Modal>

    <!-- Game over modal -->
    <Modal :show="game.gameOver.value" @close="$emit('leave-game')">
      <div class="round-modal">
        <h2>Game Over!</h2>
        <div class="rankings">
          <div
            v-for="(playerId, index) in game.finishedPlayers.value"
            :key="playerId"
            class="ranking-row"
          >
            <span class="position">#{{ index + 1 }}</span>
            <span class="name">{{ game.players.value[playerId]?.name }}</span>
          </div>
        </div>
        <button class="modal-btn confirm" @click="$emit('leave-game')">Back to Menu</button>
      </div>
    </Modal>

    <!-- Leave confirmation modal -->
    <Modal :show="showLeaveConfirm" @close="showLeaveConfirm = false">
      <div class="round-modal">
        <h3>Leave Game?</h3>
        <p>Are you sure you want to leave?</p>
        <div class="modal-buttons">
          <button class="modal-btn" @click="showLeaveConfirm = false">Cancel</button>
          <button class="modal-btn confirm" @click="$emit('leave-game')">Leave</button>
        </div>
      </div>
    </Modal>

  </CardTable>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { PresidentPhase, isValidPlay, sortHandByRank, type StandardCard } from '@euchre/shared'
import CardTable from './CardTable.vue'
import TurnTimer from './TurnTimer.vue'
import Modal from './Modal.vue'
import GameHUD from './GameHUD.vue'
import { useCardTable } from '@/composables/useCardTable'
import { usePresidentGameAdapter } from '@/composables/usePresidentGameAdapter'
import { usePresidentDirector } from '@/composables/usePresidentDirector'
import { websocket } from '@/services/websocket'

const props = withDefaults(defineProps<{
  mode?: 'singleplayer' | 'multiplayer'
}>(), {
  mode: 'singleplayer',
})

const emit = defineEmits<{
  'leave-game': []
}>()

const tableRef = ref<InstanceType<typeof CardTable> | null>(null)
const turnTimerRef = ref<InstanceType<typeof TurnTimer> | null>(null)

// Create engine — shared between CardTable and Director
const engine = useCardTable()
const game = usePresidentGameAdapter(props.mode)

// boardRef resolved after CardTable mounts
const boardRef = ref<HTMLElement | null>(null)

const director = usePresidentDirector(game, engine, { boardRef })

const currentTurnSeat = computed(() => director.currentTurnSeat.value)
const phase = computed(() => game.phase.value)
const playerCount = computed(() => game.players.value.length)
const userName = computed(() => director.playerNames.value[0] ?? 'You')
const userRankBadge = computed(() => getRankBadge(game.humanPlayer.value?.id ?? 0))

// Timer settings - can be sped up via URL param for testing (e.g., ?timerSpeed=fast)
const timerSettings = computed(() => {
  const params = new URLSearchParams(window.location.search)
  const speed = params.get('timerSpeed')
  if (speed === 'fast') {
    // Fast mode for E2E testing: 2s grace + 3s countdown = 5s total
    return { gracePeriodMs: 2000, countdownMs: 3000 }
  }
  // Default: 30s grace + 30s countdown = 60s total
  return { gracePeriodMs: 30000, countdownMs: 30000 }
})
const showLeaveConfirm = ref(false)

// Card selection state (multi-select for same-rank cards)
const selectedCardIds = ref<Set<string>>(new Set())

// Highlighted cards (received in exchange — teal glow for 3s)
const highlightedCardIds = ref<Set<string>>(new Set())
let highlightTimer: ReturnType<typeof setTimeout> | null = null

// Auto-acknowledge exchange and highlight received cards (no modal)
watch(() => game.exchangeInfo.value, (info) => {
  if (!info || game.isHumanGivingCards.value) return

  // Highlight received cards in hand for 3 seconds
  if (info.youReceive?.length) {
    const receivedIds = info.youReceive.map(c => c.id)
    highlightedCardIds.value = new Set(receivedIds)
    if (highlightTimer) clearTimeout(highlightTimer)
    highlightTimer = setTimeout(() => {
      highlightedCardIds.value = new Set()
    }, 3000)
  }

  game.acknowledgeExchange()
})

// ── Seat mapping (duplicated from director for template use) ────────────

function playerIdToSeatIndex(playerId: number): number {
  const myId = game.humanPlayer.value?.id ?? 0
  const count = playerCount.value
  return (playerId - myId + count) % count
}

// ── Rank badges ─────────────────────────────────────────────────────────

function getRankBadge(playerId: number): string | null {
  const display = game.getPlayerRankDisplay(playerId)
  if (!display) return null
  const badges: Record<string, string> = {
    'President': '\u{1F451}',
    'Vice President': '\u{1F396}\u{FE0F}',
    'Citizen': '',
    'Scum': '\u{1F4A9}',
  }
  return badges[display] ?? null
}

// ── Pile status ─────────────────────────────────────────────────────────

const pileStatus = computed(() => {
  const pile = game.currentPile.value
  if (!pile.currentRank) return ''
  const typeLabel =
    pile.currentPlayType === 'pair' ? 'Pair of ' :
    pile.currentPlayType === 'triple' ? 'Triple ' :
    pile.currentPlayType === 'quad' ? 'Quad ' : ''
  return `Beat: ${typeLabel}${pile.currentRank}s`
})

// ── Dimmed cards (unplayable during user's turn) ────────────────────────

const dimmedCardIds = computed(() => {
  const ids = new Set<string>()
  if (!game.isHumanTurn.value && !game.isHumanGivingCards.value) return ids

  const human = game.humanPlayer.value
  if (!human) return ids

  if (game.isHumanGivingCards.value) {
    // During give-back, all cards are selectable — no dimming
    return ids
  }

  // During play, dim cards whose rank can't be part of any valid play
  const validRanks = new Set<string>()
  for (const play of game.validPlays.value) {
    for (const card of play) {
      validRanks.add(card.rank)
    }
  }
  for (const card of human.hand) {
    if (!validRanks.has(card.rank)) {
      ids.add(card.id)
    }
  }
  return ids
})

// ── Card selection ──────────────────────────────────────────────────────

function handleCardClick(cardId: string) {
  if (director.isAnimating.value) return

  const human = game.humanPlayer.value
  if (!human) return

  // Give-back phase: toggle selection for giving cards
  if (game.isHumanGivingCards.value) {
    toggleSelection(cardId, game.cardsToGiveCount.value)
    return
  }

  // Playing phase: toggle selection for playing cards
  if (game.isHumanTurn.value) {
    const card = human.hand.find(c => c.id === cardId)
    if (!card) return

    // Check if this card's rank can be part of a valid play
    const validRanks = new Set<string>()
    for (const play of game.validPlays.value) {
      for (const c of play) validRanks.add(c.rank)
    }
    if (!validRanks.has(card.rank)) return

    toggleSelection(cardId)
    return
  }
}

function toggleSelection(cardId: string, maxCount?: number) {
  const newSelected = new Set(selectedCardIds.value)
  const human = game.humanPlayer.value
  if (!human) return

  if (newSelected.has(cardId)) {
    newSelected.delete(cardId)
  } else {
    // For playing: enforce same-rank constraint
    if (!game.isHumanGivingCards.value) {
      const clickedCard = human.hand.find(c => c.id === cardId)
      if (clickedCard && newSelected.size > 0) {
        const existingId = [...newSelected][0]!
        const existingCard = human.hand.find(c => c.id === existingId)
        if (existingCard && existingCard.rank !== clickedCard.rank) {
          newSelected.clear()
        }
      }
    }

    // For give-back: enforce max count
    if (maxCount !== undefined && newSelected.size >= maxCount) {
      newSelected.clear()
    }

    newSelected.add(cardId)
  }

  selectedCardIds.value = newSelected
}

// ── Play validation ─────────────────────────────────────────────────────

const selectedCards = computed<StandardCard[]>(() => {
  const human = game.humanPlayer.value
  if (!human) return []
  return sortHandByRank(human.hand).filter(c => selectedCardIds.value.has(c.id))
})

const canPlaySelection = computed(() => {
  if (selectedCards.value.length === 0) return false
  return isValidPlay(selectedCards.value, game.currentPile.value, game.superTwosMode.value)
})

// ── Actions ─────────────────────────────────────────────────────────────

function playSelectedCards() {
  if (!canPlaySelection.value) return
  game.playCards(selectedCards.value)
  selectedCardIds.value = new Set()
}

function passTurn() {
  game.pass()
  selectedCardIds.value = new Set()
}

function confirmGiveBack() {
  if (selectedCardIds.value.size !== game.cardsToGiveCount.value) return
  const human = game.humanPlayer.value
  if (!human) return
  const cards = human.hand.filter(c => selectedCardIds.value.has(c.id))
  game.giveCardsBack(cards)
  selectedCardIds.value = new Set()
}

function handleTurnTimeout() {
  // When the player times out on their own turn, leave the game
  // (bootPlayer only works for booting OTHER players who timed out server-side)
  if (props.mode === 'multiplayer') {
    console.warn('[TurnTimer] Timeout reached — leaving game')
    emit('leave-game')
  }
}

// ── Bug Report ──────────────────────────────────────────────────────────

function buildBugReportPayload() {
  const human = game.humanPlayer.value

  return {
    mode: props.mode,
    ui: {
      isAnimating: director.isAnimating.value,
      phase: phase.value,
      selectedCards: selectedCardIds.value.size,
    },
    adapter: {
      roundNumber: game.roundNumber.value,
      phase: game.phase.value,
      myPlayerId: human?.id ?? null,
      isHumanTurn: game.isHumanTurn.value,
      isHumanGivingCards: game.isHumanGivingCards.value,
      playerCount: playerCount.value,
      finishedCount: game.finishedPlayers.value.length,
      pileRank: game.currentPile.value.currentRank,
      pileType: game.currentPile.value.currentPlayType,
    },
    websocket: props.mode === 'multiplayer' ? {
      inbound: websocket.getRecentInbound?.().slice(-10).map(m => ({ ts: m.ts, type: m.message.type })) ?? [],
      outbound: websocket.getRecentOutbound?.().slice(-10).map(m => ({ ts: m.ts, type: m.message.type })) ?? [],
    } : null,
  }
}

// ── Mount ───────────────────────────────────────────────────────────────

onMounted(async () => {
  await nextTick()
  if (tableRef.value) {
    boardRef.value = tableRef.value.boardRef
  }
  if (props.mode === 'multiplayer') {
    game.initialize?.()
  }
})

// Watch for game_lost signal from server — bail out to menu
watch(() => game.gameLost.value, (lost) => {
  if (lost) {
    console.warn('[PresidentBoard] Game lost — returning to menu')
    emit('leave-game')
  }
})

onUnmounted(() => {
  director.cleanup?.()
  if (props.mode === 'multiplayer') {
    game.cleanup?.()
  }
})
</script>

<style scoped lang="scss">
.game-info {
  position: absolute;
  top: 10px;
  left: max(10px, env(safe-area-inset-left));
  z-index: 500;
  background: rgba(20, 20, 30, 0.88);
  border: 1px solid #444;
  border-radius: 8px;
  padding: 8px 12px;
  backdrop-filter: blur(8px);
  font-size: 12px;
  color: #ccc;

  .game-title {
    font-size: 14px;
    font-weight: 700;
    color: #eee;
    margin-bottom: 2px;
  }

  .round-info {
    font-weight: 600;
    margin-bottom: 2px;
  }

  .pile-status {
    color: #f4d03f;
    font-weight: 600;
    font-size: 11px;
  }
}

.info-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.action-panel {
  position: absolute;
  bottom: 12px;
  right: max(12px, env(safe-area-inset-right));
  z-index: 600;
  background: rgba(20, 20, 30, 0.92);
  border: 1px solid #444;
  border-radius: 10px;
  padding: 8px 10px;
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 5px;
  width: 110px;
  min-height: 110px;
  transition: box-shadow var(--anim-slow) ease, border-color var(--anim-slow) ease, background var(--anim-slow) ease;

  &.is-my-turn {
    border: 2px solid rgba(255, 215, 0, 0.5);
    background: rgba(40, 38, 20, 0.92);
    box-shadow:
      0 0 12px rgba(255, 215, 0, 0.2),
      0 0 30px rgba(255, 215, 0, 0.08);
  }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.panel-name {
  font-size: 12px;
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
  font-size: 11px;
  color: #aaa;
  text-align: center;

  &.giving {
    color: #d4a5e8;
    font-weight: 600;
  }
}

.selection-count {
  font-size: 11px;
  font-weight: 600;
  color: #eee;
  text-align: center;

  .invalid-hint {
    color: #ff6b6b;
    font-size: 10px;
    font-style: italic;
  }
}

.action-btn {
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid #555;
  background: rgba(50, 50, 65, 0.9);
  color: #ccc;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--anim-fast);
  text-align: center;

  &:hover:not(:disabled) {
    background: rgba(70, 70, 90, 0.95);
    color: #fff;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.primary {
    background: rgba(36, 115, 90, 0.9);
    border-color: #2a8a6a;
    color: #fff;

    &:hover:not(:disabled) {
      background: rgba(46, 135, 110, 0.95);
    }
  }
}

// Modals
.round-modal {
  padding: 16px;
  text-align: center;
  color: #333;

  h2, h3 {
    margin-bottom: 8px;
  }

  p {
    margin-bottom: 12px;
    opacity: 0.8;
  }
}

.rankings {
  margin: 12px 0;
}

.ranking-row {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 6px;

  &:nth-child(odd) {
    background: rgba(0, 0, 0, 0.04);
  }
}

.position {
  font-weight: bold;
  width: 30px;
}

.name {
  flex: 1;
  text-align: left;
}

.title {
  opacity: 0.7;
  font-style: italic;
}

.next-round-msg {
  font-style: italic;
  opacity: 0.6;
}

.modal-btn {
  padding: 6px 16px;
  font-weight: bold;
  border-radius: 6px;
  border: none;
  background: rgba(0, 0, 0, 0.1);
  color: #333;
  cursor: pointer;

  &.confirm {
    background: #24735a;
    color: #fff;
  }

  &:hover {
    opacity: 0.9;
  }
}

.modal-buttons {
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
