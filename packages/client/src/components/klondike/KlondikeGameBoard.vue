<script setup lang="ts">
import { computed, onMounted } from 'vue'
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

// Initialize game on mount
onMounted(() => {
  store.startNewGame()
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
  store.startNewGame()
}

function handleLeaveGame() {
  emit('leaveGame')
}
</script>

<template>
  <div class="klondike-board">
    <BackButton @click="handleLeaveGame" />

    <!-- Header with game controls -->
    <div class="game-header">
      <div class="game-info">
        <span class="move-count">Moves: {{ moveCount }}</span>
      </div>
      <button v-if="canAutoComplete && !isAutoCompleting" class="auto-btn" @click="handleAutoComplete">
        Auto
      </button>
    </div>

    <!-- Main game area - different layouts for portrait/landscape -->
    <div class="game-area">
      <!-- PORTRAIT: Foundations at top, tableau below, stock/waste at bottom -->
      <div class="portrait-layout">
        <div class="portrait-top">
          <div class="foundations-row">
            <KlondikeFoundation
              v-for="(foundation, index) in foundations"
              :key="index"
              :foundation="foundation"
              :index="index"
              @tap="handleFoundationTap"
            />
          </div>
        </div>

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

        <div class="portrait-bottom">
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

      <!-- LANDSCAPE: Tableau in center, foundations on right, stock/waste at bottom left -->
      <div class="landscape-layout">
        <div class="landscape-main">
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

        <div class="landscape-sidebar">
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

        <div class="landscape-stock-waste">
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
    </div>

    <!-- Win modal -->
    <Modal :show="isWon">
      <div class="win-modal">
        <h1>You Win!</h1>
        <p>Completed in {{ moveCount }} moves</p>
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
  padding: $spacing-sm;
  box-sizing: border-box;
  overflow: hidden;
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-xs $spacing-sm;
  padding-left: 50px; // Space for fixed back button
  color: white;
  flex-shrink: 0;
}

.game-info {
  display: flex;
  gap: $spacing-md;
}

.move-count {
  font-size: 0.875rem;
  opacity: 0.9;
}

.auto-btn {
  padding: $spacing-xs $spacing-md;
  background: $secondary-color;
  color: white;
  font-weight: bold;
  border-radius: 6px;
  font-size: 0.875rem;
}

.game-area {
  flex: 1;
  min-height: 0;
  position: relative;
}

// ============================================
// PORTRAIT LAYOUT
// ============================================
.portrait-layout {
  display: none;
  flex-direction: column;
  height: 100%;
  gap: $spacing-sm;

  // Smaller card sizes for portrait
  --card-width: 48px;
  --card-height: 67px;
}

.portrait-top {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-start;
  padding-left: $spacing-sm;
}

.foundations-row {
  display: flex;
  gap: 4px;
}

.portrait-tableau {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 4px;
  min-height: 0;
  overflow-y: auto;
  padding: $spacing-xs;
}

.portrait-bottom {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: $spacing-sm;
}

// ============================================
// LANDSCAPE LAYOUT
// ============================================
.landscape-layout {
  display: none;
  height: 100%;

  // Standard card sizes for landscape
  --card-width: 70px;
  --card-height: 98px;
}

.landscape-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.landscape-tableau {
  display: flex;
  justify-content: center;
  gap: $spacing-sm;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: $spacing-sm;
}

.landscape-sidebar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding: $spacing-sm;
}

.foundations-column {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.landscape-stock-waste {
  position: absolute;
  bottom: $spacing-sm;
  left: $spacing-sm;
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

// ============================================
// Win modal styles
// ============================================
.win-modal {
  text-align: center;
  padding: $spacing-md;

  h1 {
    font-size: 1.5rem;
    margin-bottom: $spacing-sm;
    color: $secondary-color;
  }

  p {
    font-size: 1rem;
    color: #555;
    margin-bottom: $spacing-lg;
  }
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

  &.primary {
    background: $secondary-color;
    color: white;
  }
}
</style>
