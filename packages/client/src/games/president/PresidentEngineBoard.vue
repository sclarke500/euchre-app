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
    :layout="playerCount > 5 ? 'wide' : 'normal'"
    game-name="PRESIDENT"
    @card-click="handleCardClick"
  >
    <!-- Player rank badges via named slots -->
    <template v-for="(player, i) in game.players.value" :key="i" #[`player-info-${playerIdToSeatIndex(i)}`]>
      <div v-if="getRankBadge(i)" class="info-chip rank-chip">
        {{ getRankBadge(i) }}
      </div>
    </template>

    <!-- HUD: Menu button -->
    <GameHUD
      game-type="president"
      :build-payload="buildBugReportPayload"
      :show-resync="mode === 'multiplayer'"
      @leave="showLeaveConfirm = true"
      @resync="game.requestResync?.()"
      @rules="showRulesModal = true"
    />

    <!-- Round counter (top-right) -->
    <div class="round-indicator">Round {{ game.roundNumber.value }}</div>

    <!-- User actions — bottom bar -->
    <UserActions :active="game.isHumanTurn.value || game.isHumanGivingCards.value" :class="{ 'normal-table': playerCount <= 5 }">
      <TurnTimer 
        v-if="props.mode === 'multiplayer'"
        ref="turnTimerRef"
        :active="game.isHumanTurn.value && !director.isAnimating.value"
        :grace-period-ms="timerSettings.gracePeriodMs"
        :countdown-ms="timerSettings.countdownMs"
        @timeout="handleTurnTimeout"
      />

      <!-- Give-back phase -->
      <template v-if="game.isHumanGivingCards.value">
        <button
          class="action-btn primary"
          :disabled="selectedCardIds.size !== game.cardsToGiveCount.value"
          @click="confirmGiveBack"
        >
          Give{{ selectedCardIds.size > 0 ? ` (${selectedCardIds.size}/${game.cardsToGiveCount.value})` : ` ${game.cardsToGiveCount.value}` }}
        </button>
      </template>

      <!-- Playing phase, user's turn -->
      <template v-else-if="game.isHumanTurn.value">
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
    </UserActions>

    <!-- Round complete modal -->
    <Modal :show="phase === PresidentPhase.RoundComplete" @close="() => {}">
      <div class="round-modal dialog-panel">
        <h3 class="dialog-title">Round {{ game.roundNumber.value }} Complete!</h3>
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
        <p v-if="!game.gameOver.value" class="next-round-msg dialog-text">Next round starting...</p>
      </div>
    </Modal>

    <!-- Game over modal -->
    <Modal :show="game.gameOver.value" @close="$emit('leave-game')">
      <div class="round-modal dialog-panel">
        <h2 class="dialog-title">Game Over!</h2>
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
        <button class="modal-btn dialog-btn dialog-btn--primary confirm" @click="$emit('leave-game')">Back to Menu</button>
      </div>
    </Modal>

    <!-- Leave confirmation modal -->
    <Modal :show="showLeaveConfirm" @close="showLeaveConfirm = false">
      <div class="round-modal dialog-panel">
        <h3 class="dialog-title">Leave Game?</h3>
        <p class="dialog-text">Are you sure you want to leave?</p>
        <div class="modal-buttons dialog-actions">
          <button class="modal-btn dialog-btn dialog-btn--muted" @click="showLeaveConfirm = false">Cancel</button>
          <button class="modal-btn dialog-btn dialog-btn--primary confirm" @click="$emit('leave-game')">Leave</button>
        </div>
      </div>
    </Modal>

    <!-- Rules Modal -->
    <Modal :show="showRulesModal" @close="showRulesModal = false">
      <div class="round-modal dialog-panel">
        <h3 class="dialog-title">President Rules</h3>
        <div class="rules-content">
          <p><strong>Objective:</strong> Be the first to get rid of all your cards to become President.</p>
          <p><strong>Gameplay:</strong> Play cards equal to or higher than the current pile. You can play singles, pairs, triples, or quads — but must match the play type.</p>
          <p><strong>Passing:</strong> If you can't or don't want to play, pass. When all players pass, the pile clears and the last player to play starts fresh.</p>
          <p><strong>Ranks:</strong> President finishes first (best), then Vice President, down to Scum (last). Next round, Scum gives their best cards to President.</p>
          <p><strong>2s are high:</strong> 2 beats everything except another 2.</p>
        </div>
        <div class="modal-buttons dialog-actions">
          <button class="modal-btn dialog-btn dialog-btn--primary" @click="showRulesModal = false">Got it</button>
        </div>
      </div>
    </Modal>

  </CardTable>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { PresidentPhase, isValidPlay, sortHandByRank, type StandardCard } from '@67cards/shared'
import CardTable from '@/components/CardTable.vue'
import TurnTimer from '@/components/TurnTimer.vue'
import Modal from '@/components/Modal.vue'
import GameHUD from '@/components/GameHUD.vue'
import UserActions from '@/components/UserActions.vue'
import { useCardTable } from '@/composables/useCardTable'
import { usePresidentGameAdapter } from './usePresidentGameAdapter'
import { usePresidentDirector } from './usePresidentDirector'
import { usePresidentGameStore } from './presidentGameStore'
import { useSettingsStore } from '@/stores/settingsStore'
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
const playerCount = computed(() => game.players.value.length || 4) // Default to 4 for President
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
const showRulesModal = ref(false)

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
  // Initialize game - multiplayer connects to server, single-player starts new game
  if (props.mode === 'multiplayer') {
    game.initialize?.()
  } else {
    const presidentStore = usePresidentGameStore()
    const settingsStore = useSettingsStore()
    presidentStore.startNewGame(settingsStore.presidentPlayerCount)
  }
  await nextTick()
  if (tableRef.value) {
    boardRef.value = tableRef.value.boardRef
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
// Round indicator - top right (similar to Spades scoreboard)
.round-indicator {
  position: fixed;
  top: 8px;
  right: max(8px, env(safe-area-inset-right));
  z-index: 500;
  background: rgba(20, 20, 30, 0.85);
  border: 1px solid #444;
  border-radius: 6px;
  padding: 6px 12px;
  backdrop-filter: blur(8px);
  font-size: 12px;
  font-weight: 600;
  color: #ccc;
}

// Action button overrides for President
:deep(.user-actions) {
  .action-btn {
    min-width: 100px;
  }
  
  // More padding for normal-sized table (≤5 players)
  &.normal-table {
    padding: 24px 20px;
    
    .action-btn {
      min-width: 120px;
      padding: 14px 24px;
    }
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

// Invalid hint style for UserActions labels
.invalid-hint {
  color: #ff6b6b;
  font-style: italic;
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
</style>
