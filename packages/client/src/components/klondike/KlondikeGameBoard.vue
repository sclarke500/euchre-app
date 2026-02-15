<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useKlondikeStore } from '@/stores/klondikeStore'
import BackButton from '../BackButton.vue'
import KlondikeFoundation from './KlondikeFoundation.vue'
import KlondikeStockWaste from './KlondikeStockWaste.vue'
import KlondikeTableauColumn from './KlondikeTableauColumn.vue'
import FlyingCard from './FlyingCard.vue'
import Modal from '../Modal.vue'
import { resetKlondikeAnimation } from '@/composables/useKlondikeAnimation'

const emit = defineEmits<{
  leaveGame: []
}>()

const store = useKlondikeStore()

// Flying cards from store (Pinia reactive)
const flyingCards = computed(() => {
  const cards = store.flyingCards
  if (cards.length > 0) {
    console.log('[GameBoard] flyingCards computed:', cards.length, cards)
  }
  return cards
})

// Timer
const elapsedSeconds = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null

function startTimer() {
  elapsedSeconds.value = 0
  timerInterval = setInterval(() => {
    if (!store.isWon) {
      elapsedSeconds.value++
    }
  }, 1000)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

const formattedTime = computed(() => {
  const mins = Math.floor(elapsedSeconds.value / 60)
  const secs = elapsedSeconds.value % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
})

// Simple scoring: 10 points per card moved to foundation
const score = computed(() => {
  let total = 0
  for (const foundation of store.foundations) {
    total += foundation.cards.length * 10
  }
  return total
})

// Initialize game on mount
onMounted(() => {
  resetKlondikeAnimation()
  store.startNewGame()
  startTimer()
})

onUnmounted(() => {
  stopTimer()
  resetKlondikeAnimation()
})

// Computed
const tableau = computed(() => store.tableau)
const foundations = computed(() => store.foundations)
const stock = computed(() => store.stock)
const waste = computed(() => store.waste)
const visibleWasteCards = computed(() => store.visibleWasteCards)
const selection = computed(() => store.selection)
const moveCount = computed(() => store.moveCount)
const isWon = computed(() => store.isWon)
const canAutoComplete = computed(() => store.canRunAutoComplete)
const isAutoCompleting = computed(() => store.isAutoCompleting)
const canUndo = computed(() => store.canUndo)
const noMovesAvailable = computed(() => store.noMovesAvailable && !isWon.value)

// Check if waste is selected
const isWasteSelected = computed(() => selection.value?.source === 'waste')

// Get selected card index for a tableau column
function getSelectedCardIndex(columnIndex: number): number | null {
  if (!selection.value) return null
  if (selection.value.source !== 'tableau') return null
  if (selection.value.columnIndex !== columnIndex) return null
  return selection.value.cardIndex
}

// Event handlers
function handleDrawCard() {
  store.handleDrawCard()
}

function handleWasteTap() {
  store.handleWasteTap()
}

function handleFoundationTap(index: number) {
  store.handleFoundationTap(index)
}

function handleTableauCardTap(columnIndex: number, cardIndex: number) {
  store.handleTableauTap(columnIndex, cardIndex)
}

function handleEmptyTableauTap(columnIndex: number) {
  store.handleEmptyTableauTap(columnIndex)
}

function handleAutoComplete() {
  store.runAutoComplete()
}

function handleNewGame() {
  stopTimer()
  resetKlondikeAnimation()
  store.startNewGame()
  startTimer()
}

function handleLeaveGame() {
  stopTimer()
  emit('leaveGame')
}

// Undo last move
function handleUndo() {
  store.undo()
}

// TODO: Implement hint functionality
function handleHint() {
  // store.showHint()
  console.log('Hint not yet implemented')
}
</script>

<template>
  <div class="klondike-board">
    <BackButton @click="handleLeaveGame" />

    <!-- Main game area -->
    <div class="game-area">
      <!-- PORTRAIT LAYOUT -->
      <div class="portrait-layout">
        <!-- Top row: Foundations (left) + Stock/Waste (right) -->
        <div class="portrait-top-row">
          <div class="foundations-row">
            <KlondikeFoundation
              v-for="(foundation, index) in foundations"
              :key="index"
              :foundation="foundation"
              :index="index"
              @tap="handleFoundationTap"
            />
          </div>
          <div class="stock-waste-area">
            <KlondikeStockWaste
              :stock="stock"
              :waste="waste"
              :visible-waste-cards="visibleWasteCards"
              :is-waste-selected="isWasteSelected"
              @draw-card="handleDrawCard"
              @tap-waste="handleWasteTap"
            />
          </div>
        </div>

        <!-- Tableau -->
        <div class="portrait-tableau">
          <KlondikeTableauColumn
            v-for="(column, index) in tableau"
            :key="index"
            :column="column"
            :column-index="index"
            :selected-card-index="getSelectedCardIndex(index)"
            @tap-card="handleTableauCardTap"
            @tap-empty="handleEmptyTableauTap"
          />
        </div>
      </div>

      <!-- LANDSCAPE LAYOUT -->
      <div class="landscape-layout">
        <!-- Left sidebar: Foundations -->
        <div class="landscape-left">
          <div class="foundations-column">
            <KlondikeFoundation
              v-for="(foundation, index) in foundations"
              :key="index"
              :foundation="foundation"
              :index="index"
              @tap="handleFoundationTap"
            />
          </div>
        </div>

        <!-- Center: Tableau -->
        <div class="landscape-center">
          <div class="landscape-tableau">
            <KlondikeTableauColumn
              v-for="(column, index) in tableau"
              :key="index"
              :column="column"
              :column-index="index"
              :selected-card-index="getSelectedCardIndex(index)"
              @tap-card="handleTableauCardTap"
              @tap-empty="handleEmptyTableauTap"
            />
          </div>
        </div>

        <!-- Right sidebar: Stock/Waste -->
        <div class="landscape-right">
          <KlondikeStockWaste
            :stock="stock"
            :waste="waste"
            :visible-waste-cards="visibleWasteCards"
            :is-waste-selected="isWasteSelected"
            layout="vertical"
            @draw-card="handleDrawCard"
            @tap-waste="handleWasteTap"
          />
        </div>
      </div>
    </div>

    <!-- Bottom toolbar with stats -->
    <div class="bottom-toolbar">
      <!-- Stats section -->
      <div class="toolbar-stats">
        <span v-if="noMovesAvailable" class="no-moves-indicator">No moves!</span>
        <template v-else>
          <span class="toolbar-stat">{{ score }}</span>
          <span class="toolbar-stat-divider">•</span>
          <span class="toolbar-stat">{{ formattedTime }}</span>
          <span class="toolbar-stat-divider">•</span>
          <span class="toolbar-stat">{{ moveCount }} moves</span>
        </template>
      </div>

      <!-- Actions section -->
      <div class="toolbar-actions">
        <button 
          class="toolbar-btn" 
          :class="{ disabled: !canUndo }"
          :disabled="!canUndo"
          @click="handleUndo" 
          title="Undo"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 10h10a5 5 0 0 1 5 5v2" />
            <path d="M3 10l4-4" />
            <path d="M3 10l4 4" />
          </svg>
        </button>
        <button class="toolbar-btn" @click="handleHint" title="Hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
            <path d="M9 21h6" />
          </svg>
        </button>
        <button v-if="canAutoComplete && !isAutoCompleting" class="toolbar-btn auto" @click="handleAutoComplete" title="Auto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </button>
        <button class="toolbar-btn" @click="handleNewGame" title="New Game">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4" />
            <path d="M12 18v4" />
            <path d="M4.93 4.93l2.83 2.83" />
            <path d="M16.24 16.24l2.83 2.83" />
            <path d="M2 12h4" />
            <path d="M18 12h4" />
            <path d="M4.93 19.07l2.83-2.83" />
            <path d="M16.24 7.76l2.83-2.83" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Flying cards overlay for animations -->
    <Teleport to="body">
      <template v-if="flyingCards.length > 0">
        <FlyingCard
          v-for="fc in flyingCards"
          :key="fc.id"
          :card="fc.card"
          :start-x="fc.startX"
          :start-y="fc.startY"
          :end-x="fc.endX"
          :end-y="fc.endY"
          :width="fc.width"
          :height="fc.height"
        />
      </template>
    </Teleport>

    <!-- Win modal -->
    <Modal :show="isWon">
      <div class="win-modal">
        <h1>🎉 You Win!</h1>
        <div class="win-stats">
          <div class="win-stat">
            <span class="win-stat-value">{{ score }}</span>
            <span class="win-stat-label">Score</span>
          </div>
          <div class="win-stat">
            <span class="win-stat-value">{{ formattedTime }}</span>
            <span class="win-stat-label">Time</span>
          </div>
          <div class="win-stat">
            <span class="win-stat-value">{{ moveCount }}</span>
            <span class="win-stat-label">Moves</span>
          </div>
        </div>
        <div class="win-actions">
          <button class="action-btn primary" @click="handleNewGame">Play Again</button>
          <button class="action-btn" @click="handleLeaveGame">Main Menu</button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped lang="scss">
@use 'sass:color';
.klondike-board {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

// ============================================
// GAME AREA
// ============================================
.game-area {
  flex: 1;
  min-height: 0;
  padding: $spacing-xs;
  overflow: hidden;
}

// ============================================
// PORTRAIT LAYOUT
// ============================================
.portrait-layout {
  display: none;
  flex-direction: column;
  height: 100%;
  gap: $spacing-sm;

  --card-width: 44px;
  --card-height: 62px;
}

.portrait-top-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0 $spacing-xs;
  flex-shrink: 0;
}

.foundations-row {
  display: flex;
  gap: 3px;
}

.stock-waste-area {
  display: flex;
  justify-content: flex-end;
}

.portrait-tableau {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 3px;
  min-height: 0;
  overflow-y: auto;
  padding: $spacing-xs 0;
}

// ============================================
// LANDSCAPE LAYOUT
// ============================================
.landscape-layout {
  display: none;
  height: 100%;
  gap: $spacing-sm;

  // Small cards for landscape to fit 4 foundations vertically on phones
  // 4 cards * 56px + 3 gaps * 3px = 233px, should fit most landscape heights
  --card-width: 40px;
  --card-height: 56px;
}

.landscape-left {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  padding-top: 2px;
}

.foundations-column {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.landscape-center {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  overflow: hidden;
}

.landscape-tableau {
  display: flex;
  justify-content: center;
  gap: $spacing-xs;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: $spacing-xs;
}

.landscape-right {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  padding-top: $spacing-xs;
}

// ============================================
// BOTTOM TOOLBAR
// ============================================
.bottom-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-xs $spacing-sm;
  background: rgba(0, 0, 0, 0.4);
  flex-shrink: 0;
}

.toolbar-stats {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  color: white;
  font-size: 0.8rem;
}

.toolbar-stat {
  font-weight: 500;
}

.toolbar-stat-divider {
  opacity: 0.4;
  font-size: 0.6rem;
}

.no-moves-indicator {
  color: #ff6b6b;
  font-weight: 600;
  animation: pulse-warning 1.5s ease-in-out infinite;
}

@keyframes pulse-warning {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.toolbar-actions {
  display: flex;
  gap: $spacing-xs;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-xs;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  &:active {
    background: rgba(255, 255, 255, 0.15);
  }

  &.disabled {
    opacity: 0.3;
    cursor: not-allowed;
    
    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }

  &.auto {
    background: $secondary-color;
    
    &:hover {
      background: color.adjust($secondary-color, $lightness: 5%);
    }
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

// ============================================
// ORIENTATION MEDIA QUERIES
// ============================================
@media (orientation: portrait) {
  .portrait-layout {
    display: flex;
  }
  .landscape-layout {
    display: none;
  }
}

@media (orientation: landscape) {
  .portrait-layout {
    display: none;
  }
  .landscape-layout {
    display: flex;
  }
}

// Larger screens in portrait - bigger cards
@media (orientation: portrait) and (min-width: 400px) {
  .portrait-layout {
    --card-width: 48px;
    --card-height: 67px;
  }
  .foundations-row {
    gap: 4px;
  }
  .portrait-tableau {
    gap: 4px;
  }
}

// Medium landscape screens (tablets, larger phones)
@media (orientation: landscape) and (min-height: 350px) {
  .landscape-layout {
    --card-width: 50px;
    --card-height: 70px;
  }
  .foundations-column {
    gap: 4px;
  }
}

// Taller landscape screens - can fit bigger cards
@media (orientation: landscape) and (min-height: 500px) {
  .landscape-layout {
    --card-width: 65px;
    --card-height: 91px;
  }
  .foundations-column {
    gap: $spacing-xs;
  }
}

// ============================================
// WIN MODAL
// ============================================
.win-modal {
  text-align: center;
  padding: $spacing-md;

  h1 {
    font-size: 1.5rem;
    margin-bottom: $spacing-md;
    color: $secondary-color;
  }
}

.win-stats {
  display: flex;
  justify-content: center;
  gap: $spacing-lg;
  margin-bottom: $spacing-lg;
}

.win-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.win-stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
}

.win-stat-label {
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
}

.win-actions {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.action-btn {
  padding: $spacing-sm $spacing-lg;
  font-size: 1rem;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
  background: #e0e0e0;
  color: #333;
  border: none;

  &.primary {
    background: $secondary-color;
    color: white;
  }
}
</style>
