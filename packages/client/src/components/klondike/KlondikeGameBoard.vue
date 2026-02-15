<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick, reactive } from 'vue'
import { useKlondikeStore } from '@/stores/klondikeStore'
import { useKlondikeLayout, type ContainerRect, type CardPosition } from '@/composables/useKlondikeLayout'
import KlondikeContainers from './KlondikeContainers.vue'
import KlondikeCardLayer from './KlondikeCardLayer.vue'
import Modal from '../Modal.vue'

const emit = defineEmits<{
  leaveGame: []
}>()

const store = useKlondikeStore()
const layout = useKlondikeLayout()

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

// Scoring
const score = computed(() => {
  let total = 0
  for (const foundation of store.foundations) {
    total += foundation.cards.length * 10
  }
  return total
})

// Card positions - using ref to maintain object identity for animations
const cardPositionsRef = ref<Map<string, CardPosition>>(new Map())

// Track whether we're animating a deal
const isDealing = ref(false)

// Update positions when state changes
watch(
  () => store.gameState,
  () => {
    if (isDealing.value) return // Skip during deal animation
    
    const newPositions = layout.calculatePositions(store.gameState)
    const map = cardPositionsRef.value
    
    // Update existing positions in place (preserves reactivity for transitions)
    for (const pos of newPositions) {
      const existing = map.get(pos.id)
      if (existing) {
        // Update in place
        existing.x = pos.x
        existing.y = pos.y
        existing.z = pos.z
        existing.faceUp = pos.faceUp
      } else {
        // New card
        map.set(pos.id, pos)
      }
    }
    
    // Remove cards no longer in play
    const newIds = new Set(newPositions.map(p => p.id))
    for (const id of map.keys()) {
      if (!newIds.has(id)) {
        map.delete(id)
      }
    }
  },
  { deep: true, immediate: true }
)

// Convert map to array for template
const cardPositions = computed<CardPosition[]>(() => {
  return Array.from(cardPositionsRef.value.values())
})

// Animate dealing cards from stock to tableau
async function animateDeal() {
  isDealing.value = true
  const map = cardPositionsRef.value
  map.clear()
  
  const stockRect = layout.containers.value.stock
  if (!stockRect) {
    isDealing.value = false
    return
  }
  
  // Get final positions
  const finalPositions = layout.calculatePositions(store.gameState)
  
  // First, place all cards at stock position
  for (const pos of finalPositions) {
    map.set(pos.id, {
      ...pos,
      x: stockRect.x,
      y: stockRect.y,
      faceUp: false, // Start face down
    })
  }
  
  // Wait a frame for initial positions to render
  await nextTick()
  await new Promise(r => setTimeout(r, 50))
  
  // Build deal order: tableau cards dealt row by row (col 0 card 0, col 1 card 0, col 1 card 1, etc.)
  const dealOrder: { cardId: string; finalPos: CardPosition; delay: number }[] = []
  const state = store.gameState
  let delay = 0
  const DEAL_DELAY = 50 // ms between each card
  
  // Deal tableau row by row
  for (let row = 0; row < 7; row++) {
    for (let col = row; col < 7; col++) {
      const column = state.tableau[col]
      if (column && row < column.cards.length) {
        const card = column.cards[row]
        if (card) {
          const finalPos = finalPositions.find(p => p.id === card.id)
          if (finalPos) {
            dealOrder.push({ cardId: card.id, finalPos, delay })
            delay += DEAL_DELAY
          }
        }
      }
    }
  }
  
  // Animate each card to its final position
  for (const { cardId, finalPos, delay: cardDelay } of dealOrder) {
    setTimeout(() => {
      const existing = map.get(cardId)
      if (existing) {
        existing.x = finalPos.x
        existing.y = finalPos.y
        existing.z = finalPos.z
        existing.faceUp = finalPos.faceUp
      }
    }, cardDelay)
  }
  
  // Wait for all animations to complete
  await new Promise(r => setTimeout(r, delay + 350)) // 350ms for the CSS transition
  isDealing.value = false
}

// Board ref for reading CSS variables
const boardRef = ref<HTMLElement | null>(null)

// Initialize game with deal animation
onMounted(async () => {
  // Set card size based on CSS variable from board element
  await nextTick()
  if (boardRef.value) {
    const styles = getComputedStyle(boardRef.value)
    const width = parseInt(styles.getPropertyValue('--card-width')) || 50
    const height = parseInt(styles.getPropertyValue('--card-height')) || 70
    layout.setCardSize(width, height)
  }
  
  // Wait for containers to be measured
  await new Promise(r => setTimeout(r, 150))
  
  store.startNewGame()
  startTimer()
  
  // Animate the deal
  await animateDeal()
})

onUnmounted(() => {
  stopTimer()
  window.removeEventListener('resize', updateCardSize)
})

// Update card size from CSS variables
function updateCardSize() {
  if (boardRef.value) {
    const styles = getComputedStyle(boardRef.value)
    const width = parseInt(styles.getPropertyValue('--card-width')) || 50
    const height = parseInt(styles.getPropertyValue('--card-height')) || 70
    layout.setCardSize(width, height)
  }
}

// Listen for resize to update card sizes
onMounted(() => {
  window.addEventListener('resize', updateCardSize)
})

// Container measurement handler
function handleContainerMeasured(
  type: 'stock' | 'waste' | 'foundation' | 'tableau',
  index: number | null,
  rect: ContainerRect
) {
  layout.setContainerRect(type, index, rect)
}

// Track cards that should animate from stock
const animatingFromStock = ref<Set<string>>(new Set())

// Click handlers
async function handleStockClick() {
  const stockRect = layout.containers.value.stock
  const prevWasteCount = store.waste.length
  
  store.handleDrawCard()
  
  // Identify newly drawn cards
  const newWasteCount = store.waste.length
  if (stockRect && newWasteCount > prevWasteCount) {
    const drawnCards = store.waste.slice(prevWasteCount)
    const drawnIds = new Set(drawnCards.map(c => c.id))
    
    // Position new cards at stock initially
    const map = cardPositionsRef.value
    const finalPositions = layout.calculatePositions(store.gameState)
    
    for (const card of drawnCards) {
      const finalPos = finalPositions.find(p => p.id === card.id)
      if (finalPos) {
        // Place at stock first
        map.set(card.id, {
          ...finalPos,
          x: stockRect.x,
          y: stockRect.y,
          faceUp: false, // Start face down
        })
      }
    }
    
    // Wait a frame then animate to final positions
    await nextTick()
    await new Promise(r => setTimeout(r, 20))
    
    // Stagger the animations
    let delay = 0
    for (const card of drawnCards) {
      const finalPos = finalPositions.find(p => p.id === card.id)
      if (finalPos) {
        setTimeout(() => {
          const existing = map.get(card.id)
          if (existing) {
            existing.x = finalPos.x
            existing.y = finalPos.y
            existing.faceUp = true
          }
        }, delay)
        delay += 60 // Stagger each card
      }
    }
  } else if (store.waste.length === 0 && store.stock.length > 0) {
    // Cards recycled from waste to stock - clear waste cards from map
    const map = cardPositionsRef.value
    // Waste cards no longer exist in our positions after recycle
  }
}

function handleWasteClick() {
  store.handleWasteTap()
}

function handleFoundationClick(index: number) {
  store.handleFoundationTap(index)
}

function handleTableauClick(index: number) {
  // If there's a selection, try to move there
  if (store.selection) {
    store.handleEmptyTableauTap(index)
  }
}

function handleCardClick(cardId: string) {
  // Find which card was clicked and handle appropriately
  const state = store.gameState
  
  // Check waste
  if (state.waste.length > 0 && state.waste[state.waste.length - 1]?.id === cardId) {
    store.handleWasteTap()
    return
  }
  
  // Check tableau
  for (let colIdx = 0; colIdx < state.tableau.length; colIdx++) {
    const column = state.tableau[colIdx]!
    for (let cardIdx = 0; cardIdx < column.cards.length; cardIdx++) {
      if (column.cards[cardIdx]?.id === cardId) {
        store.handleTableauTap(colIdx, cardIdx)
        return
      }
    }
  }
  
  // Check foundations (clicking on foundation top card)
  for (let fIdx = 0; fIdx < state.foundations.length; fIdx++) {
    const foundation = state.foundations[fIdx]!
    if (foundation.cards.length > 0 && foundation.cards[foundation.cards.length - 1]?.id === cardId) {
      store.handleFoundationTap(fIdx)
      return
    }
  }
}

function handleAutoComplete() {
  store.runAutoComplete()
}

async function handleNewGame() {
  stopTimer()
  store.startNewGame()
  startTimer()
  
  // Animate the deal
  await animateDeal()
}

function handleLeaveGame() {
  stopTimer()
  emit('leaveGame')
}

function handleUndo() {
  store.undo()
}

// Computed state for template
const isWon = computed(() => store.isWon)
const moveCount = computed(() => store.moveCount)
const canAutoComplete = computed(() => store.canRunAutoComplete)
const isAutoCompleting = computed(() => store.isAutoCompleting)
const canUndo = computed(() => store.canUndo)
const noMovesAvailable = computed(() => store.noMovesAvailable && !isWon.value)
const selection = computed(() => store.selection)

// New game confirmation
const showNewGameConfirm = ref(false)

function confirmNewGame() {
  showNewGameConfirm.value = true
}

function cancelNewGame() {
  showNewGameConfirm.value = false
}

function doNewGame() {
  showNewGameConfirm.value = false
  handleNewGame()
}
</script>

<template>
  <div ref="boardRef" class="klondike-board">
    <!-- Container slots (measures positions, handles empty slot clicks) -->
    <KlondikeContainers
      :state="store.gameState"
      @container-measured="handleContainerMeasured"
      @stock-click="handleStockClick"
      @waste-click="handleWasteClick"
      @foundation-click="handleFoundationClick"
      @tableau-click="handleTableauClick"
    />

    <!-- All cards in a single layer -->
    <KlondikeCardLayer
      :positions="cardPositions"
      :selection="selection"
      :card-width="layout.cardWidth.value"
      :card-height="layout.cardHeight.value"
      @card-click="handleCardClick"
    />

    <!-- Bottom toolbar -->
    <div class="bottom-toolbar">
      <!-- Left: Back button -->
      <button class="toolbar-btn back" @click="handleLeaveGame" title="Main Menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      </button>

      <!-- Center: Stats -->
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

      <!-- Right: Actions -->
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
        <button v-if="canAutoComplete && !isAutoCompleting" class="toolbar-btn auto" @click="handleAutoComplete" title="Auto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </button>
        <button class="toolbar-btn" @click="confirmNewGame" title="New Game">
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

    <!-- New Game confirmation modal -->
    <Modal :show="showNewGameConfirm">
      <div class="confirm-modal">
        <h2>Start New Game?</h2>
        <p>Your current progress will be lost.</p>
        <div class="confirm-actions">
          <button class="action-btn" @click="cancelNewGame">Cancel</button>
          <button class="action-btn primary" @click="doNewGame">New Game</button>
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
  position: relative;
  
  // Card size CSS variables
  --card-width: 50px;
  --card-height: 70px;
}

@media (min-width: 400px) {
  .klondike-board {
    --card-width: 55px;
    --card-height: 77px;
  }
}

@media (min-width: 500px) {
  .klondike-board {
    --card-width: 65px;
    --card-height: 91px;
  }
}

.bottom-toolbar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
  gap: 8px;
}

.toolbar-stats {
  display: flex;
  align-items: center;
  gap: 8px;
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
  gap: 8px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  &.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  &.auto {
    background: #f1c40f;
    color: #333;
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

.win-modal {
  text-align: center;
  padding: 16px;

  h1 {
    font-size: 1.5rem;
    margin-bottom: 16px;
    color: #f1c40f;
  }
}

.win-stats {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 24px;
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
  gap: 8px;
}

.action-btn {
  padding: 12px 24px;
  font-size: 1rem;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
  background: #e0e0e0;
  color: #333;
  border: none;

  &.primary {
    background: #f1c40f;
    color: #333;
  }
}

.confirm-modal {
  text-align: center;
  padding: 16px;

  h2 {
    font-size: 1.25rem;
    margin-bottom: 8px;
    color: #333;
  }

  p {
    color: #666;
    margin-bottom: 20px;
  }
}

.confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
