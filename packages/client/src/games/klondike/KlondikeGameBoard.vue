<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch, nextTick, triggerRef } from 'vue'
import { useKlondikeStore } from './klondikeStore'
import { useKlondikeLayout, type ContainerRect, type CardPosition } from './useKlondikeLayout'
import { canMoveToTableau, canMoveToFoundation } from '@67cards/shared'
import KlondikeContainers from './KlondikeContainers.vue'
import KlondikeCardLayer from './KlondikeCardLayer.vue'
import Modal from '@/components/Modal.vue'

const emit = defineEmits<{
  leaveGame: []
}>()

const store = useKlondikeStore()
const layout = useKlondikeLayout()

// Ref to containers component for drop zone detection
const containersRef = ref<InstanceType<typeof KlondikeContainers> | null>(null)

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

// Card positions - using shallowRef so we can manually trigger updates
const cardPositionsRef = shallowRef<Map<string, CardPosition>>(new Map())

// Helper to update a position reactively (replaces the object to trigger Vue)
function updatePosition(id: string, updates: Partial<CardPosition>) {
  const map = cardPositionsRef.value
  const existing = map.get(id)
  if (existing) {
    map.set(id, { ...existing, ...updates })
    triggerRef(cardPositionsRef)
  }
}

// Track whether we're animating (deal or draw)
const isAnimating = ref(false)

// Track cards that are currently animating (for elevated z-index)
const animatingCardIds = ref<Set<string>>(new Set())

// Drag-and-drop state
interface DragState {
  cardIds: string[]
  startPositions: Map<string, { x: number; y: number; z: number }>
  offsetX: number
  offsetY: number
  sourceType: 'tableau' | 'waste' | 'foundation'
  sourceColumnIndex?: number
  sourceCardIndex?: number
}

const dragState = ref<DragState | null>(null)
const dragOffset = ref({ x: 0, y: 0 })
const activeDropZone = ref<{ type: 'tableau' | 'foundation'; index: number; isValid: boolean } | null>(null)

// Get cards being dragged
const dragCardIds = computed(() => dragState.value?.cardIds ?? [])

// Find what drop zone a point is over
function findDropZone(x: number, y: number): { type: 'tableau' | 'foundation'; index: number; isValid: boolean } | null {
  if (!dragState.value || !containersRef.value) return null
  
  const tableauRefs = containersRef.value.tableauRefs
  const foundationRefs = containersRef.value.foundationRefs
  
  // Get the first dragged card to check validity
  const firstCardId = dragState.value.cardIds[0]
  if (!firstCardId) return null
  
  const firstCardPos = cardPositionsRef.value.get(firstCardId)
  if (!firstCardPos) return null
  
  const draggedCard = firstCardPos.card
  const state = store.gameState
  
  // Check tableau columns
  for (let i = 0; i < tableauRefs.length; i++) {
    const el = tableauRefs[i]
    if (!el) continue
    
    // Skip source column
    if (dragState.value.sourceType === 'tableau' && dragState.value.sourceColumnIndex === i) {
      continue
    }
    
    const rect = el.getBoundingClientRect()
    // Expand hit area vertically for tableau (cards stack down)
    const expandedRect = {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom + 200, // Extend downward for stacked cards
    }
    
    if (x >= expandedRect.left && x <= expandedRect.right && y >= expandedRect.top && y <= expandedRect.bottom) {
      const column = state.tableau[i]
      const isValid = column ? canMoveToTableau(draggedCard, column) : false
      return { type: 'tableau', index: i, isValid }
    }
  }
  
  // Check foundations (only for single card drags)
  if (dragState.value.cardIds.length === 1) {
    for (let i = 0; i < foundationRefs.length; i++) {
      const el = foundationRefs[i]
      if (!el) continue
      
      const rect = el.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const foundation = state.foundations[i]
        const isValid = foundation ? canMoveToFoundation(draggedCard, foundation) : false
        return { type: 'foundation', index: i, isValid }
      }
    }
  }
  
  return null
}

// Handle drag start from card layer
function handleDragStart(cardId: string, x: number, y: number, sourceType: 'tableau' | 'waste' | 'foundation') {
  const cardPos = cardPositionsRef.value.get(cardId)
  if (!cardPos || !cardPos.faceUp) return
  
  // Find source info
  let sourceColumnIndex: number | undefined
  let sourceCardIndex: number | undefined
  let cardIds: string[] = [cardId]
  
  // Find which tableau column/card index this is
  for (let colIdx = 0; colIdx < store.gameState.tableau.length; colIdx++) {
    const column = store.gameState.tableau[colIdx]
    if (!column) continue
    
    for (let cardIdx = 0; cardIdx < column.cards.length; cardIdx++) {
      if (column.cards[cardIdx]?.id === cardId) {
        sourceColumnIndex = colIdx
        sourceCardIndex = cardIdx
        // For tableau, include all face-up cards from this index down
        cardIds = column.cards
          .slice(cardIdx)
          .filter(c => c.faceUp)
          .map(c => c.id)
        break
      }
    }
    if (sourceColumnIndex !== undefined) break
  }
  
  // Check waste
  if (sourceColumnIndex === undefined) {
    const waste = store.gameState.waste
    if (waste.length > 0 && waste[waste.length - 1]?.id === cardId) {
      sourceColumnIndex = undefined
      sourceCardIndex = undefined
      cardIds = [cardId]
    }
  }
  
  // Store original positions for potential snap-back
  const startPositions = new Map<string, { x: number; y: number; z: number }>()
  for (const id of cardIds) {
    const pos = cardPositionsRef.value.get(id)
    if (pos) {
      startPositions.set(id, { x: pos.x, y: pos.y, z: pos.z })
    }
  }
  
  dragState.value = {
    cardIds,
    startPositions,
    offsetX: x - cardPos.x,
    offsetY: y - cardPos.y,
    sourceType: sourceColumnIndex !== undefined ? 'tableau' : 'waste',
    sourceColumnIndex,
    sourceCardIndex,
  }
  
  dragOffset.value = { x: 0, y: 0 }
}

// Handle drag move
function handleDragMove(x: number, y: number) {
  if (!dragState.value) return
  
  const firstCardId = dragState.value.cardIds[0]
  if (!firstCardId) return
  
  const startPos = dragState.value.startPositions.get(firstCardId)
  if (!startPos) return
  
  dragOffset.value = {
    x: x - dragState.value.offsetX - startPos.x,
    y: y - dragState.value.offsetY - startPos.y,
  }
  
  // Update active drop zone
  activeDropZone.value = findDropZone(x, y)
}

// Handle drag end
function handleDragEnd() {
  if (!dragState.value) return
  
  const zone = activeDropZone.value
  
  if (zone?.isValid) {
    // Execute the move - use selectForDrag to avoid auto-play interference
    if (zone.type === 'tableau') {
      if (dragState.value.sourceType === 'tableau' && dragState.value.sourceColumnIndex !== undefined && dragState.value.sourceCardIndex !== undefined) {
        store.selectForDrag('tableau', dragState.value.sourceColumnIndex, dragState.value.sourceCardIndex)
        store.handleEmptyTableauTap(zone.index)
      } else if (dragState.value.sourceType === 'waste') {
        store.selectForDrag('waste')
        store.handleEmptyTableauTap(zone.index)
      }
    } else if (zone.type === 'foundation') {
      if (dragState.value.sourceType === 'tableau' && dragState.value.sourceColumnIndex !== undefined && dragState.value.sourceCardIndex !== undefined) {
        store.selectForDrag('tableau', dragState.value.sourceColumnIndex, dragState.value.sourceCardIndex)
        store.handleFoundationTap(zone.index)
      } else if (dragState.value.sourceType === 'waste') {
        store.selectForDrag('waste')
        store.handleFoundationTap(zone.index)
      }
    }
  }
  
  // Clear drag state (positions will sync from state change)
  dragState.value = null
  dragOffset.value = { x: 0, y: 0 }
  activeDropZone.value = null
}

// Get style for drop zone highlight overlay
function getDropZoneStyle(zone: { type: 'tableau' | 'foundation'; index: number }): Record<string, string> {
  if (!containersRef.value) return {}
  
  const refs = zone.type === 'tableau' 
    ? containersRef.value.tableauRefs 
    : containersRef.value.foundationRefs
  
  const el = refs[zone.index]
  if (!el) return {}
  
  const rect = el.getBoundingClientRect()
  const boardRect = boardRef.value?.getBoundingClientRect()
  if (!boardRect) return {}
  
  return {
    left: `${rect.left - boardRect.left}px`,
    top: `${rect.top - boardRect.top}px`,
    width: `${rect.width}px`,
    height: zone.type === 'tableau' ? `${rect.height + 150}px` : `${rect.height}px`,
  }
}

function hasValidRect(rect: ContainerRect | null): boolean {
  return !!rect && rect.width > 0 && rect.height > 0
}

function containersReadyForLayout(): boolean {
  const c = layout.containers.value
  return (
    hasValidRect(c.stock) &&
    hasValidRect(c.waste) &&
    c.tableau.every(slot => hasValidRect(slot))
  )
}

function syncPositionsFromState() {
  const newPositions = layout.calculatePositions(store.gameState)
  const map = cardPositionsRef.value
  const movingCards: string[] = []

  for (const pos of newPositions) {
    const existing = map.get(pos.id)
    if (existing) {
      const isNewlyFlipped = !existing.faceUp && pos.faceUp
      
      // Check if card is moving (position changed significantly)
      const isMoving = Math.abs(existing.x - pos.x) > 5 || Math.abs(existing.y - pos.y) > 5
      if (isMoving) {
        movingCards.push(pos.id)
      }

      // Always delay flips for newly exposed tableau cards
      const isTableauCard = store.gameState.tableau.some(col => 
        col.cards.some(c => c.id === pos.id)
      )
      
      if (isNewlyFlipped && isTableauCard) {
        // Keep face-down initially and flip after animation
        map.set(pos.id, { ...pos, faceUp: false })
        const cardId = pos.id
        setTimeout(() => {
          updatePosition(cardId, { faceUp: true })
        }, 400)
      } else {
        map.set(pos.id, pos)
      }
    } else {
      map.set(pos.id, pos)
    }
  }

  // Elevate moving cards' z-index during animation
  if (movingCards.length > 0) {
    for (const cardId of movingCards) {
      animatingCardIds.value.add(cardId)
    }
    // Remove after transition completes (300ms + buffer)
    setTimeout(() => {
      for (const cardId of movingCards) {
        animatingCardIds.value.delete(cardId)
      }
    }, 350)
  }

  const newIds = new Set(newPositions.map(p => p.id))
  for (const id of map.keys()) {
    if (!newIds.has(id)) {
      map.delete(id)
    }
  }

  triggerRef(cardPositionsRef)
}

// Update positions when state changes
watch(
  () => store.gameState,
  () => {
    if (isAnimating.value) return // Skip during animations
    if (!containersReadyForLayout()) return // Skip if layout not ready
    syncPositionsFromState()
  },
  { deep: true, immediate: true }
)

watch(
  () => layout.containers.value,
  () => {
    if (isAnimating.value) return
    if (!containersReadyForLayout()) return
    // Only sync if we have cards positioned (avoid overriding deal animation)
    if (cardPositionsRef.value.size > 0) {
      syncPositionsFromState()
    }
  },
  { deep: true }
)

// Convert map to array for template
const cardPositions = computed<CardPosition[]>(() => {
  return Array.from(cardPositionsRef.value.values())
})

// Animate dealing cards from stock to tableau
async function animateDeal() {
  // Containers should be ready by now, but double-check
  if (!containersReadyForLayout()) {
    console.warn('Klondike: Containers not ready for deal animation')
    syncPositionsFromState()
    isAnimating.value = false
    return
  }
  
  isAnimating.value = true
  
  const stockRect = layout.containers.value.stock!
  
  // Get final positions
  const finalPositions = layout.calculatePositions(store.gameState)
  
  // First, place all cards at stock position (create new Map for reactivity)
  const newMap = new Map<string, CardPosition>()
  for (const pos of finalPositions) {
    newMap.set(pos.id, {
      ...pos,
      x: stockRect.x,
      y: stockRect.y,
      faceUp: false, // Start face down
    })
  }
  cardPositionsRef.value = newMap
  
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
  
  // Mark all cards as animating (elevated z-index)
  animatingCardIds.value = new Set(dealOrder.map(d => d.cardId))
  
  // Animate each card to its final position
  for (const { cardId, finalPos, delay: cardDelay } of dealOrder) {
    setTimeout(() => {
      updatePosition(cardId, {
        x: finalPos.x,
        y: finalPos.y,
        z: finalPos.z,
        faceUp: finalPos.faceUp,
      })
      // Remove from animating set after this card's animation completes
      setTimeout(() => {
        animatingCardIds.value.delete(cardId)
      }, 350)
    }, cardDelay)
  }
  
  // Wait for all animations to complete
  await new Promise(r => setTimeout(r, delay + 350)) // 350ms for the CSS transition
  animatingCardIds.value = new Set() // Clear all
  isAnimating.value = false
}

// Board ref for setting card size CSS variables
const boardRef = ref<HTMLElement | null>(null)

// Calculate card size based on available viewport dimensions
function calculateCardSize(): { width: number; height: number } {
  const el = boardRef.value
  if (!el) return { width: 50, height: 70 }

  const vw = el.clientWidth
  const vh = el.clientHeight
  const landscape = vw > vh

  const RATIO = 1.4 // card height / width
  const PAD = 8
  const GAP = 4
  const TOOLBAR = 50

  let maxW: number

  if (landscape) {
    // Width: left foundations(1 card) + gaps + center 7 tableau cols + gaps + right stock/waste(~1.5 card)
    const wFromWidth = (vw - PAD * 2 - GAP * 6 - 8 * 2) / 9.5
    // Height: 4 stacked foundations + gaps + toolbar + padding
    const wFromHeight = (vh - TOOLBAR - PAD * 2 - GAP * 3) / (4 * RATIO)
    maxW = Math.min(wFromWidth, wFromHeight)
  } else {
    // Width: 7 tableau columns + gaps + padding
    const wFromWidth = (vw - PAD * 2 - GAP * 6) / 7
    // Height: top row(1 card) + gap + tableau cascade(~2.1x card height) + toolbar + padding
    const wFromHeight = (vh - TOOLBAR - PAD * 2 - GAP) / (3.1 * RATIO)
    maxW = Math.min(wFromWidth, wFromHeight)
  }

  const width = Math.max(35, Math.min(Math.floor(maxW), 80))
  const height = Math.round(width * RATIO)
  return { width, height }
}

// Update card size from calculated dimensions
function updateCardSize() {
  const { width, height } = calculateCardSize()
  if (boardRef.value) {
    boardRef.value.style.setProperty('--card-width', `${width}px`)
    boardRef.value.style.setProperty('--card-height', `${height}px`)
  }
  layout.setCardSize(width, height)
  if (!isAnimating.value && cardPositionsRef.value.size > 0) {
    syncPositionsFromState()
  }
}

// Initialize game
onMounted(async () => {
  await nextTick()
  updateCardSize()

  // Start the game immediately
  store.startNewGame()
  startTimer()

  window.addEventListener('resize', updateCardSize)

  // Wait for containers to be measured before animating
  if (containersReadyForLayout()) {
    await animateDeal()
  } else {
    // Watch for containers to become ready
    const unwatch = watch(
      () => containersReadyForLayout(),
      async (ready) => {
        if (ready) {
          unwatch()
          await animateDeal()
        }
      }
    )
  }
})

onUnmounted(() => {
  stopTimer()
  window.removeEventListener('resize', updateCardSize)
})

// Container measurement handler
function handleContainerMeasured(
  type: 'stock' | 'waste' | 'foundation' | 'tableau',
  index: number | null,
  rect: ContainerRect
) {
  layout.setContainerRect(type, index, rect)
}

// Click handlers
async function handleStockClick() {
  const stockRect = layout.containers.value.stock
  const prevWasteCount = store.waste.length
  
  // Block the watcher during animation
  isAnimating.value = true
  
  store.handleDrawCard()
  
  // Identify newly drawn cards
  const newWasteCount = store.waste.length
  if (stockRect && newWasteCount > prevWasteCount) {
    const drawnCards = store.waste.slice(prevWasteCount)
    
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
    
    // Also update existing waste card positions (they shift right-to-left)
    const allWastePositions = finalPositions.filter(p => 
      store.waste.some(c => c.id === p.id)
    )
    for (const pos of allWastePositions) {
      if (!drawnCards.some(c => c.id === pos.id)) {
        // Update position of existing waste cards
        updatePosition(pos.id, { x: pos.x, y: pos.y, z: pos.z })
      }
    }
    
    // Wait a frame then animate new cards to final positions
    await nextTick()
    await new Promise(r => setTimeout(r, 20))
    
    // Mark drawn cards as animating (elevated z-index)
    for (const card of drawnCards) {
      animatingCardIds.value.add(card.id)
    }
    
    // Stagger the animations for new cards
    let delay = 0
    for (const card of drawnCards) {
      const finalPos = finalPositions.find(p => p.id === card.id)
      if (finalPos) {
        setTimeout(() => {
          updatePosition(card.id, {
            x: finalPos.x,
            y: finalPos.y,
            faceUp: true,
          })
          // Remove from animating set after animation completes
          setTimeout(() => {
            animatingCardIds.value.delete(card.id)
          }, 350)
        }, delay)
        delay += 60 // Stagger each card
      }
    }
    
    // Wait for animation to complete
    await new Promise(r => setTimeout(r, delay + 350))
  }
  
  animatingCardIds.value = new Set() // Clear all
  isAnimating.value = false
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
    <!-- Watermark -->
    <div class="table-watermark">
      <img src="@/assets/AppLogo.png" alt="" class="watermark-logo" />
      <span class="watermark-name">KLONDIKE</span>
    </div>

    <!-- Container slots (measures positions, handles empty slot clicks) -->
    <KlondikeContainers
      ref="containersRef"
      :state="store.gameState"
      :class="{ 
        'drop-zone-active': dragState !== null,
        'drop-zone-valid': activeDropZone?.isValid 
      }"
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
      :drag-card-ids="dragCardIds"
      :drag-offset-x="dragOffset.x"
      :drag-offset-y="dragOffset.y"
      :animating-card-ids="animatingCardIds"
      @card-click="handleCardClick"
      @drag-start="handleDragStart"
      @drag-move="handleDragMove"
      @drag-end="handleDragEnd"
    />
    
    <!-- Drop zone highlight overlay -->
    <div v-if="activeDropZone" class="drop-zone-highlight" :class="{ valid: activeDropZone.isValid, invalid: !activeDropZone.isValid }">
      <template v-if="activeDropZone.type === 'tableau'">
        <div 
          class="highlight-overlay tableau"
          :style="getDropZoneStyle(activeDropZone)"
        ></div>
      </template>
      <template v-else>
        <div 
          class="highlight-overlay foundation"
          :style="getDropZoneStyle(activeDropZone)"
        ></div>
      </template>
    </div>

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
      <div class="win-modal dialog-panel">
        <h1 class="dialog-title">🎉 You Win!</h1>
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
        <div class="win-actions dialog-actions">
          <button class="action-btn dialog-btn dialog-btn--primary primary" @click="handleNewGame">Play Again</button>
          <button class="action-btn dialog-btn dialog-btn--muted" @click="handleLeaveGame">Main Menu</button>
        </div>
      </div>
    </Modal>

    <!-- New Game confirmation modal -->
    <Modal :show="showNewGameConfirm" @close="cancelNewGame">
      <div class="confirm-modal dialog-panel">
        <h2 class="dialog-title">Start New Game?</h2>
        <p class="dialog-text">Your current progress will be lost.</p>
        <div class="confirm-actions dialog-actions">
          <button class="action-btn dialog-btn dialog-btn--muted" @click="cancelNewGame">Cancel</button>
          <button class="action-btn dialog-btn dialog-btn--primary primary" @click="doNewGame">New Game</button>
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
  
  // Card size CSS variables (set dynamically by calculateCardSize)
  --card-width: 50px;
  --card-height: 70px;
}

// Watermark
.table-watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  pointer-events: none;
  user-select: none;
  z-index: 1;
  
  .watermark-logo {
    width: 120px;
    height: 120px;
    object-fit: contain;
    opacity: 0.1;
  }
  
  .watermark-name {
    font-family: 'Rock Salt', cursive;
    font-size: 1.1rem;
    font-weight: 400;
    color: white;
    text-shadow: 0 0 12px rgba(255, 255, 255, 0.6), 1px 1px 2px rgba(0, 0, 0, 0.5);
    letter-spacing: 0.08em;
    margin-top: -20px;
    -webkit-text-stroke: 0.5px white;
    opacity: 0.18;
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

// Drop zone highlight overlay
.drop-zone-highlight {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5; // Below card layer but above containers
}

.highlight-overlay {
  position: absolute;
  border-radius: 8px;
  transition: all 0.15s ease;
  
  .valid & {
    background: rgba(46, 204, 113, 0.3);
    border: 3px solid rgba(46, 204, 113, 0.8);
    box-shadow: 0 0 20px rgba(46, 204, 113, 0.5);
  }
  
  .invalid & {
    background: rgba(231, 76, 60, 0.2);
    border: 3px dashed rgba(231, 76, 60, 0.6);
  }
}
</style>
