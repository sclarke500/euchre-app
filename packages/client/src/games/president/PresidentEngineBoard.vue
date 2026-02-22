<template>
  <div class="president-board-wrapper">
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
    @layout-changed="handleLayoutChanged"
  >
    <!-- Player rank badges via named slots -->
    <template v-for="(player, i) in game.players.value" :key="i" #[`player-info-${playerIdToSeatIndex(i)}`]>
      <span v-if="getRankBadge(i)" class="rank-badge">{{ getRankBadge(i) }}</span>
    </template>

    <!-- User rank badge -->
    <template #user-info>
      <span v-if="userRankBadge" class="rank-badge user-rank">{{ userRankBadge }}</span>
    </template>

    <!-- HUD: Menu button -->
    <GameHUD
      game-type="president"
      :mode="mode"
      :build-payload="buildBugReportPayload"
      :show-resync="mode === 'multiplayer'"
      @leave="handleLeaveClick"
      @resync="game.requestResync?.()"
      @rules="showRulesModal = true"
      @bug-report-open="timerPaused = true"
      @bug-report-close="timerPaused = false"
    />

    <!-- Round counter (top-right) -->
    <div class="round-indicator">Round {{ game.roundNumber.value }}</div>

    <!-- Exchange phase status (center of table) -->
    <Transition name="fade">
      <div v-if="exchangeStatus" class="exchange-status">
        {{ exchangeStatus }}
      </div>
    </Transition>

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

    <!-- Disconnected player banner (multiplayer only) -->
    <DisconnectedPlayerBanner
      v-if="mode === 'multiplayer' && firstDisconnectedPlayer"
      :player-name="firstDisconnectedPlayer.name"
      :can-boot="true"
      @boot="handleBootDisconnected"
    />

    <!-- Chat input (multiplayer only) -->
    <ChatInput v-if="mode === 'multiplayer'" />

    <!-- User actions — sliding panel from right -->
    <Transition name="action-slide">
      <div v-if="showActionPanel" class="action-panel-container frosted-panel--right">

        <!-- Exchange phase: President/VP selecting cards -->
        <template v-if="game.isInExchange.value && game.exchangeCanSelect.value">
          <span class="action-label">
            Select {{ game.exchangeCardsNeeded.value }} card{{ game.exchangeCardsNeeded.value !== 1 ? 's' : '' }}
          </span>
          <button
            class="frosted-btn frosted-btn--primary"
            :disabled="selectedCardIds.size !== game.exchangeCardsNeeded.value"
            @click="confirmExchange"
          >
            Exchange ({{ selectedCardIds.size }}/{{ game.exchangeCardsNeeded.value }})
          </button>
        </template>

        <!-- Exchange phase: Scum/ViceScum with pre-selected cards -->
        <template v-else-if="game.isInExchange.value && !game.exchangeCanSelect.value">
          <span class="action-label">
            Your {{ game.exchangePreSelectedIds.value.length }} best card{{ game.exchangePreSelectedIds.value.length !== 1 ? 's' : '' }}
          </span>
          <button
            class="frosted-btn frosted-btn--primary"
            @click="confirmExchange"
          >
            Exchange
          </button>
        </template>

        <!-- SP Give-back phase (backwards compat) -->
        <template v-else-if="game.isHumanGivingCards.value">
          <span class="action-label">
            Select {{ game.cardsToGiveCount.value }} to give back
          </span>
          <button
            class="frosted-btn frosted-btn--primary"
            :disabled="selectedCardIds.size !== game.cardsToGiveCount.value"
            @click="confirmGiveBack"
          >
            Give ({{ selectedCardIds.size }}/{{ game.cardsToGiveCount.value }})
          </button>
        </template>

        <!-- Playing phase, user's turn -->
        <template v-else-if="game.isHumanTurn.value">
          <button
            v-if="game.currentPile.value.currentRank !== null"
            class="frosted-btn frosted-btn--pass"
            @click="passTurn"
          >
            Pass
          </button>
          <div v-if="game.currentPile.value.currentRank !== null" class="action-divider"></div>
          <span v-if="game.currentPile.value.currentRank === null" class="action-label lead-label">Your lead</span>
          <button
            class="frosted-btn frosted-btn--primary"
            :disabled="!canPlaySelection"
            @click="playSelectedCards"
          >
            Play{{ selectedCardIds.size > 0 ? ` (${selectedCardIds.size})` : '' }}
          </button>
        </template>

      </div>
    </Transition>

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
    <Modal :show="game.gameOver.value" :dismiss-on-backdrop="false" @close="$emit('leave-game')">
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
        <div v-if="mode === 'singleplayer' || isHost" class="modal-buttons dialog-actions">
          <button class="modal-btn dialog-btn dialog-btn--primary confirm" @click="handlePlayAgain">Play Again</button>
          <button class="modal-btn dialog-btn dialog-btn--muted" @click="$emit('leave-game')">Exit</button>
        </div>
        <div v-else class="modal-buttons dialog-actions">
          <p class="panel-message dialog-text">Waiting for host to start new game...</p>
          <button class="modal-btn dialog-btn dialog-btn--muted" @click="$emit('leave-game')">Leave</button>
        </div>
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
      <div class="modal-light rules-modal">
        <div class="modal-header">
          <h3>President Rules</h3>
        </div>
        <div class="modal-body">
          <p><strong>Overview:</strong> 4 players. Be the first to empty your hand to become President. Also known as "Scum" or "Asshole".</p>
          
          <p><strong>Card Ranking:</strong> 2 (high) → A → K → Q → J → 10 → 9 → 8 → 7 → 6 → 5 → 4 → 3 (low). Suits don't matter.</p>
          
          <p><strong>Starting:</strong> Player with 3♣ leads first. After that, the Scum (last place) leads.</p>
          
          <p><strong>Play:</strong> Play 1 or more cards of the same rank, matching the count (single, pair, triple, quad). Cards must equal or beat the pile's rank. Or pass.</p>
          
          <p><strong>Clearing:</strong> When everyone passes, pile clears. Last player to play leads the next round. Playing a 2 (or set of 2s) also clears instantly.</p>
          
          <p><strong>Finishing Order:</strong></p>
          <p>• 1st out → President</p>
          <p>• 2nd out → Vice President</p>
          <p>• 3rd out → Vice Scum</p>
          <p>• Last → Scum</p>
          
          <p><strong>Card Exchange:</strong> Before each round, Scum gives their 2 best cards to President, and Vice Scum gives 1 to Vice President. They give back any cards of their choice.</p>
          
          <p><strong>Winning:</strong> After several rounds, the player who finishes as President most often wins!</p>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" @click="showRulesModal = false">Got it</button>
        </div>
      </div>
    </Modal>

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
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { PresidentPhase, isValidPlay, sortHandByRank, type StandardCard } from '@67cards/shared'
import CardTable from '@/components/CardTable.vue'
import TurnTimer from '@/components/TurnTimer.vue'
import Modal from '@/components/Modal.vue'
import GameHUD from '@/components/GameHUD.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ChatIcon from '@/components/chat/ChatIcon.vue'
import ChatPanel from '@/components/chat/ChatPanel.vue'
import DisconnectedPlayerBanner from '@/components/DisconnectedPlayerBanner.vue'
import { useCardTable } from '@/composables/useCardTable'
import { usePresidentGameAdapter } from './usePresidentGameAdapter'
import { usePresidentDirector } from './usePresidentDirector'
import { usePresidentGameStore } from './presidentGameStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { websocket } from '@/services/websocket'
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
const bootInactiveEnabled = computed(() => lobbyStore?.currentTable?.settings?.bootInactive !== false)

// Singleplayer store for startNewGame
const presidentStore = props.mode === 'singleplayer' ? usePresidentGameStore() : null

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

// Show action panel when user needs to act
const showActionPanel = computed(() => {
  if (director.isAnimating.value) return false
  return game.isHumanTurn.value || game.isInExchange.value || game.isHumanGivingCards.value
})
const playerCount = computed(() => game.players.value.length || 4) // Default to 4 for President
const userName = computed(() => director.playerNames.value[0] ?? 'You')
const userRankBadge = computed(() => getRankBadge(game.humanPlayer.value?.id ?? 0))

// Exchange phase status message - always visible during exchange
const exchangeStatus = computed(() => {
  if (game.phase.value === PresidentPhase.CardExchange) {
    return 'Card Exchange'
  }
  return null
})

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
const showLeaveConfirm = ref(false)
const showRulesModal = ref(false)
const showChatPanel = ref(false)
const timerPaused = ref(false)

function handleLeaveClick() {
  if (props.mode === 'multiplayer' && !game.gameOver.value) {
    showLeaveConfirm.value = true
  } else {
    emit('leave-game')
  }
}

// Count human players (non-AI)
const humanCount = computed(() => 
  game.players.value.filter(p => p.isHuman).length
)

// First disconnected player (for banner display)
const firstDisconnectedPlayer = computed(() => {
  if (props.mode !== 'multiplayer') return null
  const disconnected = game.disconnectedPlayers?.value ?? []
  return disconnected.length > 0 ? disconnected[0] : null
})

// Boot disconnected player
function handleBootDisconnected() {
  if (!firstDisconnectedPlayer.value) return
  game.bootDisconnectedPlayer?.(firstDisconnectedPlayer.value.id)
}

// Card selection state (multi-select for same-rank cards)
const selectedCardIds = ref<Set<string>>(new Set())

// Highlighted cards (received in exchange — teal glow for 3s)
const highlightedCardIds = ref<Set<string>>(new Set())
let highlightTimer: ReturnType<typeof setTimeout> | null = null

// Auto-acknowledge exchange and highlight received cards (no modal)
watch(() => game.exchangeInfo.value, (info) => {
  if (!info) return

  // Highlight received cards in hand for 3 seconds
  // This applies both during give-back phase (so President sees what they got)
  // and after exchange completes (so Scum sees what they got from President)
  if (info.youReceive?.length) {
    const receivedIds = info.youReceive.map(c => c.id)
    highlightedCardIds.value = new Set(receivedIds)
    if (highlightTimer) clearTimeout(highlightTimer)
    highlightTimer = setTimeout(() => {
      highlightedCardIds.value = new Set()
    }, 3000)
  }

  // Only auto-acknowledge when not in give-back phase
  // (give-back phase uses synthetic exchangeInfo for highlighting only)
  if (!game.isHumanGivingCards.value) {
    game.acknowledgeExchange()
  }
})

// Pre-select cards for Scum/ViceScum during exchange phase
watch(() => game.exchangePreSelectedIds.value, (preSelectedIds) => {
  if (preSelectedIds && preSelectedIds.length > 0) {
    // Scum/ViceScum: show their best cards as selected (locked)
    selectedCardIds.value = new Set(preSelectedIds)
  }
}, { immediate: true })

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
    'Vice Scum': '\u{1FAA0}',  // 🪠 plunger
    'Scum': '\u{1F4A9}',
  }
  return badges[display] ?? null
}

// ── Dimmed cards (unplayable during user's turn) ────────────────────────

const dimmedCardIds = computed(() => {
  const ids = new Set<string>()
  if (!game.isHumanTurn.value && !game.isInExchange.value && !game.isHumanGivingCards.value) return ids

  const human = game.humanPlayer.value
  if (!human) return ids

  if (game.isInExchange.value || game.isHumanGivingCards.value) {
    // During exchange/give-back, all cards are selectable — no dimming
    return ids
  }

  // If no valid plays, dim ALL cards to indicate user must pass
  if (game.validPlays.value.length === 0) {
    for (const card of human.hand) {
      ids.add(card.id)
    }
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

// ── Layout handling ─────────────────────────────────────────────────────

function handleLayoutChanged(layout: { tableBounds: { width: number } }) {
  director.setTableWidth(layout.tableBounds.width)
  director.handleLayoutChange()
}

// ── Card selection ──────────────────────────────────────────────────────

function handleCardClick(cardId: string) {
  if (director.isAnimating.value) return

  const human = game.humanPlayer.value
  if (!human) return

  // Exchange phase (MP): President/VP can select, Scum/ViceScum cannot
  if (game.isInExchange.value) {
    if (game.exchangeCanSelect.value) {
      // President/VP: can toggle selection
      toggleSelection(cardId, game.exchangeCardsNeeded.value)
    }
    // Scum/ViceScum: cards are pre-selected, ignore clicks
    return
  }

  // Give-back phase (SP): toggle selection for giving cards
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
  const selectedCount = selectedCardIds.value.size
  const expectedCount = game.cardsToGiveCount.value
  
  console.log('[President] confirmGiveBack:', {
    selectedCount,
    expectedCount,
    selectedIds: [...selectedCardIds.value],
    isHumanGivingCards: game.isHumanGivingCards.value,
  })
  
  if (selectedCount !== expectedCount) {
    console.warn('[President] confirmGiveBack: count mismatch', selectedCount, '!=', expectedCount)
    return
  }
  
  const human = game.humanPlayer.value
  if (!human) {
    console.warn('[President] confirmGiveBack: no human player')
    return
  }
  
  const cards = human.hand.filter(c => selectedCardIds.value.has(c.id))
  
  // Defensive check: make sure we found all selected cards
  if (cards.length !== selectedCount) {
    console.error('[President] confirmGiveBack: cards not found in hand!', {
      found: cards.length,
      expected: selectedCount,
      selectedIds: [...selectedCardIds.value],
      handIds: human.hand.map(c => c.id),
    })
    // Still try to submit what we have - the store will validate
  }
  
  game.giveCardsBack(cards)
  selectedCardIds.value = new Set()
}

function confirmExchange() {
  const human = game.humanPlayer.value
  if (!human) {
    console.warn('[President] confirmExchange: no human player')
    return
  }

  let cards: typeof human.hand
  
  if (game.exchangeCanSelect.value) {
    // President/VP: use selected cards
    cards = human.hand.filter(c => selectedCardIds.value.has(c.id))
    console.log('[President] confirmExchange (selector):', {
      selectedCount: cards.length,
      expectedCount: game.exchangeCardsNeeded.value,
    })
  } else {
    // Scum/ViceScum: use pre-selected cards (may be empty array — server has them)
    cards = human.hand.filter(c => game.exchangePreSelectedIds.value.includes(c.id))
    console.log('[President] confirmExchange (pre-selected):', {
      cardCount: cards.length,
    })
  }
  
  game.confirmExchange(cards)
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

function handlePlayAgain() {
  if (props.mode === 'multiplayer') {
    lobbyStore?.restartGame()
  } else {
    presidentStore?.startNewGame()
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
    const settingsStore = useSettingsStore()
    presidentStore?.startNewGame(settingsStore.presidentPlayerCount)
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
.president-board-wrapper {
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

// Round indicator - top right (similar to Spades scoreboard)
.round-indicator {
  position: fixed;
  top: 8px;
  right: max(8px, env(safe-area-inset-right));
  z-index: 500;
  background: rgba(20, 20, 30, 0.85);
  border: 1px solid $surface-500;
  border-radius: 6px;
  padding: 6px 12px;
  backdrop-filter: blur(8px);
  font-size: 12px;
  font-weight: 600;
  color: #ccc;
}

// Exchange status - subtle indicator in center of table
.exchange-status {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  background: rgba(30, 30, 45, 0.8);
  border: 1px solid $surface-500;
  border-radius: 16px;
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 500;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 1px;
  animation: subtle-pulse 2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes subtle-pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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
  gap: 14px;
  padding: 18px 16px;
  padding-right: max(16px, env(safe-area-inset-right));
  min-width: 130px;
  border-radius: 20px 0 0 20px;
  
  // Unified frosted panel with gold glow (shares vars with user avatar)
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-right: none;
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

.action-panel-container .action-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

.action-panel-container .lead-label {
  color: #ffd700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
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

// Rank badges (President 👑, Scum 💩, etc.)
.rank-badge {
  font-size: 28px;
  line-height: 1;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
}

// Action hint text above buttons
.action-hint {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 4px;
}

// Invalid hint style for UserActions labels
.invalid-hint {
  color: #ff6b6b;
  font-style: italic;
}

// Modals - match Spades round summary styling
.round-modal {
  min-width: 240px;
  max-width: 90vw;
  text-align: center;

  h2, h3 {
    margin-bottom: 12px;
    color: #fff;
  }

  p {
    margin-bottom: 12px;
    color: rgba(255, 255, 255, 0.7);
  }
}

.rankings {
  margin: 12px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  padding: 8px 0;
}

.ranking-row {
  display: grid;
  grid-template-columns: 35px 1fr auto;
  gap: 8px;
  padding: 6px 8px;
  color: #ccc;
  font-size: 0.9rem;

  &:nth-child(odd) {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }
  
  &:first-child {
    color: #ffd700;
    font-weight: 600;
  }
}

.position {
  font-weight: bold;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}

.name {
  text-align: left;
  color: #fff;
}

.title {
  color: rgba(255, 255, 255, 0.6);
  font-style: italic;
  font-size: 0.85rem;
}

.next-round-msg {
  font-style: italic;
  color: rgba(255, 255, 255, 0.5);
}

.modal-btn {
  padding: 6px 16px;
  font-weight: bold;
  border-radius: 6px;
  border: none;
  background: rgba(0, 0, 0, 0.1);
  color: $surface-800;
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

// Game over / resume modal panel (unified with Spades/Euchre)
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

.game-over-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
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
