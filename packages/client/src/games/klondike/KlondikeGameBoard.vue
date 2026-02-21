<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch, nextTick, triggerRef } from 'vue'
import { useKlondikeStore } from './klondikeStore'
import { useKlondikeLayout, type ContainerRect, type CardPosition } from './useKlondikeLayout'
import { canMoveToTableau, canMoveToFoundation } from '@67cards/shared'
import KlondikeContainers from './KlondikeContainers.vue'
import KlondikeCardLayer from './KlondikeCardLayer.vue'
import Modal from '@/components/Modal.vue'
import confetti from 'canvas-confetti'

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
  
  // Get final positions
  const finalPositions = layout.calculatePositions(store.gameState)
  
  // Deal from left side, 2/3 down the screen
  const dealerX = -100
  const dealerY = window.innerHeight * 0.67
  
  // Build deal order: tableau cards dealt row by row (col 0 card 0, col 1 card 0, col 1 card 1, etc.)
  const dealOrder: { cardId: string; finalPos: CardPosition; delay: number }[] = []
  const state = store.gameState
  let delay = 0
  const DEAL_DELAY = 50 // ms between each card
  const STOCK_ARRIVAL_DELAY = 45
  
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

  const stockCardIdSet = new Set(state.stock.map((card) => card.id))
  const stockArrivalOrder = finalPositions.filter((pos) => stockCardIdSet.has(pos.id))

  // Initialize positions:
  // - Tableau deal cards start at dealer origin (animated deal)
  // - Non-tableau cards (stock/foundation/waste) start at final positions
  const dealtCardIds = new Set(dealOrder.map(d => d.cardId))
  const newMap = new Map<string, CardPosition>()
  for (const pos of finalPositions) {
    if (dealtCardIds.has(pos.id)) {
      newMap.set(pos.id, {
        ...pos,
        x: dealerX,
        y: dealerY,
        faceUp: false,
      })
    } else if (stockCardIdSet.has(pos.id)) {
      newMap.set(pos.id, {
        ...pos,
        x: dealerX,
        y: dealerY,
        faceUp: false,
      })
    } else {
      newMap.set(pos.id, pos)
    }
  }
  cardPositionsRef.value = newMap

  // Wait a frame for initial positions to render
  await nextTick()
  await new Promise(r => setTimeout(r, 50))
  
  // Mark deal + stock-arrival cards as animating (elevated z-index)
  animatingCardIds.value = new Set([
    ...dealOrder.map((d) => d.cardId),
    ...stockArrivalOrder.map((p) => p.id),
  ])
  
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

  // Bring stock pile into place after tableau deal completes.
  for (const [index, pos] of stockArrivalOrder.entries()) {
    setTimeout(() => {
      updatePosition(pos.id, {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        faceUp: false,
      })
      setTimeout(() => {
        animatingCardIds.value.delete(pos.id)
      }, 350)
    }, index * STOCK_ARRIVAL_DELAY)
  }

  if (stockArrivalOrder.length > 0) {
    await new Promise((r) => setTimeout(r, (stockArrivalOrder.length - 1) * STOCK_ARRIVAL_DELAY + 350))
  }

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
  if (isAnimating.value) return

  const stockRect = layout.containers.value.stock
  const wasteRect = layout.containers.value.waste
  const prevWasteCount = store.waste.length
  const prevStockCount = store.stock.length

  if (!stockRect || !wasteRect) {
    store.handleDrawCard()
    return
  }
  
  // Identify cards that will be drawn (top of stock) BEFORE state change
  // These cards are already rendered at the stock position
  const drawCount = store.gameState.drawCount
  const cardsToDrawCount = Math.min(drawCount, prevStockCount)
  const cardsToDrawIds = store.stock.slice(-cardsToDrawCount).map(c => c.id)
  
  // Block the watcher during animation
  isAnimating.value = true
  try {
    // Before changing state, ensure drawn cards are positioned at stock
    const map = cardPositionsRef.value
    
    // Position the cards that will be drawn at the stock location
    for (const cardId of cardsToDrawIds) {
      const existing = map.get(cardId)
      if (existing) {
        map.set(cardId, {
          ...existing,
          x: stockRect.x,
          y: stockRect.y,
          faceUp: false,
        })
      } else {
        const sourceCard = store.stock.find(c => c.id === cardId)
        if (sourceCard) {
          map.set(cardId, {
            id: sourceCard.id,
            x: stockRect.x,
            y: stockRect.y,
            z: 100,
            faceUp: false,
            card: sourceCard,
          })
        }
      }
    }
    triggerRef(cardPositionsRef)

    store.handleDrawCard()

    // Verify cards were drawn
    const newWasteCount = store.waste.length
    if (newWasteCount > prevWasteCount) {
      const drawnCards = store.waste.slice(prevWasteCount)
      const finalPositions = layout.calculatePositions(store.gameState)
    
    // Collect existing waste card positions (they'll collapse after new cards fan out)
    const existingWastePositions = finalPositions.filter(p => 
      store.waste.some(c => c.id === p.id) && !drawnCards.some(c => c.id === p.id)
    )
    
    // Mark drawn cards as animating (elevated z-index)
    for (const card of drawnCards) {
      animatingCardIds.value.add(card.id)
    }
    
    // Small delay to ensure cards are rendered at stock first
    await nextTick()
    await new Promise(r => setTimeout(r, 30))
    
    // Animate: Slide cards from stock to waste center position and flip simultaneously
    // Calculate the center landing position for the waste pile
    const wasteCenterX = wasteRect.x + wasteRect.width / 2 - layout.cardWidth.value / 2
    const wasteCenterY = wasteRect.y
    
    // For multiple cards, stack them slightly offset at the landing position
    for (let i = 0; i < drawnCards.length; i++) {
      const card = drawnCards[i]
      if (!card) continue
      updatePosition(card.id, {
        x: wasteCenterX + (i * 2), // Slight horizontal offset for stacking
        y: wasteCenterY,
        z: 2000 + i, // Keep drawn stack above existing waste during flip phase
        faceUp: true, // Flip as they move
      })
    }
    
    // Wait for slide+flip animation to complete
    await new Promise(r => setTimeout(r, 320))
    
    // Brief pause to let cards "land" before fanning
    await new Promise(r => setTimeout(r, 150))
    
    // Step 2: Fan new cards to their final positions
    for (const card of drawnCards) {
      const finalPos = finalPositions.find(p => p.id === card.id)
      if (finalPos) {
        updatePosition(card.id, {
          x: finalPos.x,
          y: finalPos.y,
          z: finalPos.z,
        })
      }
    }

    // Move existing waste cards in the same fan transition so there is no post-fan snap.
    for (const pos of existingWastePositions) {
      updatePosition(pos.id, {
        x: pos.x,
        y: pos.y,
        z: pos.z,
      })
    }
    
    // Wait for fan animation to complete
    await new Promise(r => setTimeout(r, 350))
    
      // Reconcile all visible card positions from current state.
      // Ensures newly exposed stock cards are rendered after a draw.
      const finalIds = new Set(finalPositions.map((p) => p.id))
      for (const pos of finalPositions) {
        map.set(pos.id, pos)
      }
      for (const id of Array.from(map.keys())) {
        if (!finalIds.has(id)) {
          map.delete(id)
        }
      }
      triggerRef(cardPositionsRef)

      // Clean up
      for (const card of drawnCards) {
        animatingCardIds.value.delete(card.id)
      }
    } else {
      // Recycle/no-draw path: watcher was paused, so force a sync.
      syncPositionsFromState()
    }
  } finally {
    animatingCardIds.value = new Set() // Clear all
    isAnimating.value = false
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

  // Check stock (stock cards are rendered in the card layer and can intercept slot clicks)
  if (state.stock.some(c => c.id === cardId)) {
    void handleStockClick()
    return
  }
  
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

// Victory celebration
function celebrateWin() {
  const duration = 4000
  const end = Date.now() + duration

  const colors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6']
  
  ;(function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.6 },
      colors,
      zIndex: 100000,
    })
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.6 },
      colors,
      zIndex: 100000,
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  })()
}

// Watch for win and trigger celebration
watch(isWon, (won) => {
  if (won) {
    celebrateWin()
  }
})

// Modals
const showNewGameConfirm = ref(false)
const showRulesModal = ref(false)

// DEV: Test victory flow
const testAutoComplete = ref(false)
const testWin = ref(false)
function triggerTestVictory() {
  testAutoComplete.value = true
  setTimeout(() => {
    testAutoComplete.value = false
    testWin.value = true
    celebrateWin()
  }, 2000)
}
function closeTestWin() {
  testWin.value = false
}

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
    
    <!-- Prominent auto-complete button in stock area -->
    <button 
      v-if="(canAutoComplete && !isAutoCompleting && store.stock.length === 0) || testAutoComplete"
      class="auto-complete-prominent"
      @click="handleAutoComplete"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      <span>Auto Complete</span>
    </button>
    
    <!-- DEV: Test victory button -->
    <button class="test-victory-btn" @click="triggerTestVictory">🧪 Test Win</button>
    
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
      <!-- Left: Back and Rules buttons -->
      <div class="toolbar-left">
        <button class="toolbar-btn back" @click="handleLeaveGame" title="Main Menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <button class="toolbar-btn" @click="showRulesModal = true" title="Rules">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        </button>
      </div>

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
    <Modal :show="isWon || testWin" @close="closeTestWin">
      <div class="modal-light victory-modal">
        <div class="modal-header">
          <h3>🎉 You Win!</h3>
        </div>
        <div class="modal-body">
          <div class="victory-stats">
            <div class="victory-stat">
              <span class="stat-value">{{ score }}</span>
              <span class="stat-label">Score</span>
            </div>
            <div class="victory-stat">
              <span class="stat-value">{{ formattedTime }}</span>
              <span class="stat-label">Time</span>
            </div>
            <div class="victory-stat">
              <span class="stat-value">{{ moveCount }}</span>
              <span class="stat-label">Moves</span>
            </div>
          </div>
        </div>
        <div class="modal-footer victory-actions">
          <button class="btn-secondary" @click="handleLeaveGame">Main Menu</button>
          <button class="btn-primary" @click="handleNewGame">Play Again</button>
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

    <!-- Rules modal -->
    <Modal :show="showRulesModal" @close="showRulesModal = false">
      <div class="modal-light rules-modal">
        <div class="modal-header">
          <h3>Klondike Rules</h3>
        </div>
        <div class="modal-body">
          <p><strong>Overview:</strong> The classic solitaire! Move all cards to the four foundation piles, sorted by suit from Ace to King.</p>
          
          <p><strong>Setup:</strong> 7 tableau columns with 1-7 cards each (top card face-up). Remaining cards form the stock pile.</p>
          
          <p><strong>Foundations:</strong> Build up by suit from Ace → King. (♠A, ♠2, ♠3... ♠K)</p>
          
          <p><strong>Tableau:</strong> Build down in alternating colors. (Red 6 on Black 7, etc.) Move any face-up card or stack. Empty columns can only be filled with Kings.</p>
          
          <p><strong>Stock & Waste:</strong> Click stock to draw cards to the waste pile. Top waste card is playable. When stock empties, click to recycle waste.</p>
          
          <p><strong>Moving Cards:</strong> Click to auto-move to foundations, or drag cards between columns. Reveal face-down cards by moving cards above them.</p>
          
          <p><strong>Winning:</strong> Get all 52 cards onto the four foundation piles!</p>
          
          <p><strong>Tips:</strong> Prioritize revealing face-down cards. Don't rush cards to foundations if you might need them for tableau building.</p>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" @click="showRulesModal = false">Got it</button>
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
  background: linear-gradient(135deg, $home-gradient-top 0%, $home-gradient-bottom 100%);
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

.toolbar-left {
  display: flex;
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
    color: $surface-800;
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

// Victory modal (uses modal-light class from global styles)
.victory-modal {
  min-width: 280px;
  
  .modal-header {
    background: linear-gradient(135deg, #f1c40f 0%, #f39c12 100%);
    
    h3 {
      color: #1a1a2e;
      margin: 0;
    }
  }
}

.victory-stats {
  display: flex;
  justify-content: center;
  gap: 24px;
}

.victory-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: bold;
  color: var(--color-text);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.victory-actions {
  justify-content: center;
}

// Prominent auto-complete button (in stock area when empty)
.auto-complete-prominent {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f1c40f 0%, #f39c12 100%);
  border: none;
  border-radius: 12px;
  color: #1a1a2e;
  font-weight: 600;
  font-size: 0.75rem;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(241, 196, 15, 0.4);
  animation: pulse-glow 2s ease-in-out infinite;
  
  svg {
    width: 28px;
    height: 28px;
  }
  
  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(241, 196, 15, 0.5);
  }
  
  &:active {
    transform: scale(0.98);
  }
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 4px 12px rgba(241, 196, 15, 0.4);
  }
  50% {
    box-shadow: 0 4px 20px rgba(241, 196, 15, 0.7);
  }
}

// DEV: Test victory button (remove before production)
.test-victory-btn {
  position: absolute;
  bottom: 80px;
  left: 12px;
  z-index: 100;
  padding: 8px 12px;
  background: rgba(155, 89, 182, 0.9);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  
  &:hover {
    background: rgba(155, 89, 182, 1);
  }
}

.confirm-modal {
  text-align: center;
  padding: 16px;

  h2 {
    font-size: 1.25rem;
    margin-bottom: 8px;
    color: $surface-800;
  }

  p {
    color: $surface-500;
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

.rules-content {
  text-align: left;
  font-size: 0.9rem;
  line-height: 1.5;
  max-height: 60vh;
  overflow-y: auto;
  
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
