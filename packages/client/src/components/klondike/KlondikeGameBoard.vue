<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useKlondikeStore } from '@/stores/klondikeStore'
import BackButton from '../BackButton.vue'
import KlondikeFoundation from './KlondikeFoundation.vue'
import KlondikeStockWaste from './KlondikeStockWaste.vue'
import KlondikeTableauColumn from './KlondikeTableauColumn.vue'
import Modal from '../Modal.vue'

const emit = defineEmits<{
  leaveGame: []
}>()

const store = useKlondikeStore()

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
  store.startNewGame()
  startTimer()
})

onUnmounted(() => {
  stopTimer()
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
  store.startNewGame()
  startTimer()
}

function handleLeaveGame() {
  stopTimer()
  emit('leaveGame')
}

// TODO: Implement undo functionality in store
function handleUndo() {
  // store.undo()
  console.log('Undo not yet implemented')
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

    <!-- Stats bar -->
    <div class="stats-bar">
      <div class="stat">
        <span class="stat-label">Score</span>
        <span class="stat-value">{{ score }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Time</span>
        <span class="stat-value">{{ formattedTime }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Moves</span>
        <span class="stat-value">{{ moveCount }}</span>
      </div>
    </div>

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

    <!-- Bottom toolbar -->
    <div class="bottom-toolbar">
      <button class="toolbar-btn" @click="handleUndo" title="Undo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 10h10a5 5 0 0 1 5 5v2" />
          <path d="M3 10l4-4" />
          <path d="M3 10l4 4" />
        </svg>
        <span>Undo</span>
      </button>
      <button class="toolbar-btn" @click="handleHint" title="Hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
          <path d="M9 21h6" />
          <path d="M10 21v-1h4v1" />
        </svg>
        <span>Hint</span>
      </button>
      <button v-if="canAutoComplete && !isAutoCompleting" class="toolbar-btn auto" @click="handleAutoComplete" title="Auto Complete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <span>Auto</span>
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
        <span>New</span>
      </button>
    </div>

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
// STATS BAR
// ============================================
.stats-bar {
  display: flex;
  justify-content: center;
  gap: $spacing-lg;
  padding: $spacing-xs $spacing-md;
  padding-left: 50px; // Space for back button
  background: rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
}

.stat-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.7;
}

.stat-value {
  font-size: 1rem;
  font-weight: bold;
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

  // Smaller cards for landscape to fit 4 foundations vertically
  --card-width: 55px;
  --card-height: 77px;
}

.landscape-left {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  padding-top: $spacing-xs;
  overflow-y: auto;
  max-height: 100%;
}

.foundations-column {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
  justify-content: center;
  gap: $spacing-sm;
  padding: $spacing-sm;
  background: rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.toolbar-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: $spacing-xs $spacing-sm;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  min-width: 50px;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  &:active {
    background: rgba(255, 255, 255, 0.15);
  }

  &.auto {
    background: $secondary-color;
    
    &:hover {
      background: lighten($secondary-color, 5%);
    }
  }

  svg {
    width: 20px;
    height: 20px;
  }

  span {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
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

// Taller landscape screens - can fit bigger cards
@media (orientation: landscape) and (min-height: 400px) {
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
