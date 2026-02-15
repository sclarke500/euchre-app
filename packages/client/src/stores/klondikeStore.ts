import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import {
  type KlondikeState,
  type KlondikeCard,
  type Selection,
  type TableauColumn,
  type FoundationPile,
  type MoveResult,
  createNewGame,
  drawCard,
  selectCard,
  moveToTableau,
  moveToFoundation,
  autoMoveToFoundation,
  tryAutoPlay,
  clearSelection,
  getSelectedCards,
  canMoveToTableau,
  canMoveToFoundation,
  canAutoComplete,
  autoCompleteStep,
  hasAvailableMoves,
  findValidFoundation,
  findValidTableau,
} from '@euchre/shared'
import { getKlondikeAnimation, type FlyingCard } from '@/composables/useKlondikeAnimation'

// Animation config
const ANIMATION_DURATION = 250 // ms

export const useKlondikeStore = defineStore('klondike', () => {
  // State
  const tableau = ref<TableauColumn[]>([])
  const foundations = ref<FoundationPile[]>([])
  const stock = ref<KlondikeCard[]>([])
  const waste = ref<KlondikeCard[]>([])
  const selection = ref<Selection | null>(null)
  const moveCount = ref(0)
  const isWon = ref(false)
  const isAutoCompleting = ref(false)
  const drawCount = ref<1 | 3>(3) // Default to draw 3
  
  // Animation state
  const isAnimating = ref(false)
  const flyingCards = ref<FlyingCard[]>([])
  const hiddenCardIds = ref<Set<string>>(new Set()) // Cards hidden during animation
  
  // History for undo (store serialized states)
  const history = ref<string[]>([])
  const MAX_HISTORY = 50

  // Computed game state for operations
  const gameState = computed<KlondikeState>(() => ({
    tableau: tableau.value,
    foundations: foundations.value,
    stock: stock.value,
    waste: waste.value,
    selection: selection.value,
    moveCount: moveCount.value,
    isWon: isWon.value,
    drawCount: drawCount.value,
  }))

  // Top card of waste (the one player can interact with)
  const wasteTopCard = computed(() =>
    waste.value.length > 0 ? waste.value[waste.value.length - 1] : null
  )

  // Check if auto-complete is available
  const canRunAutoComplete = computed(() => canAutoComplete(gameState.value))

  // Check if undo is available
  const canUndo = computed(() => history.value.length > 0)

  // Check if there are any available moves
  const noMovesAvailable = computed(() => !hasAvailableMoves(gameState.value))

  // Save current state to history
  function saveToHistory() {
    const snapshot = JSON.stringify(gameState.value)
    history.value.push(snapshot)
    // Limit history size
    if (history.value.length > MAX_HISTORY) {
      history.value.shift()
    }
  }

  // Update state from a new game state (optionally saving to history first)
  function updateState(state: KlondikeState, addToHistory = true) {
    if (addToHistory) {
      saveToHistory()
    }
    tableau.value = state.tableau
    foundations.value = state.foundations
    stock.value = state.stock
    waste.value = state.waste
    selection.value = state.selection
    moveCount.value = state.moveCount
    isWon.value = state.isWon
    drawCount.value = state.drawCount
  }

  // Undo last move
  function undo() {
    if (history.value.length === 0) return
    
    const previousSnapshot = history.value.pop()!
    const previousState = JSON.parse(previousSnapshot) as KlondikeState
    updateState(previousState, false) // Don't add this restoration to history
  }

  // Start a new game
  function startNewGame() {
    history.value = [] // Clear history on new game
    const state = createNewGame(drawCount.value)
    updateState(state, false) // Don't save initial state to history
    isAutoCompleting.value = false
  }

  // Get visible waste cards (up to drawCount from the top)
  const visibleWasteCards = computed(() => {
    const len = waste.value.length
    if (len === 0) return []
    // Show up to drawCount cards from the top of waste
    const start = Math.max(0, len - drawCount.value)
    return waste.value.slice(start)
  })

  // Draw a card from stock to waste (or recycle waste)
  function handleDrawCard() {
    const result = drawCard(gameState.value)
    if (result.success) {
      updateState(result.state)
    }
  }

  // Handle tapping a tableau card
  async function handleTableauTap(columnIndex: number, cardIndex: number) {
    if (isAnimating.value) return
    
    const column = tableau.value[columnIndex]
    if (!column) return

    const card = column.cards[cardIndex]
    if (!card) return

    // If card is face-down, can't interact
    if (!card.faceUp) return

    // If we have a selection, try to move to this column
    if (selection.value) {
      // If tapping same card, try auto-play or deselect
      if (
        selection.value.source === 'tableau' &&
        selection.value.columnIndex === columnIndex &&
        selection.value.cardIndex === cardIndex
      ) {
        const newState = clearSelection(gameState.value)
        updateState(newState, false) // Don't save selection changes to history
        return
      }

      // Try to move selection to this column
      const result = moveToTableau(gameState.value, selection.value, columnIndex)
      if (result.success) {
        const cards = getSelectedCards(gameState.value, selection.value)
        const sourceKey = getSourceKey(selection.value)
        const destKey = getDestKey('tableau', columnIndex, gameState.value)
        await animateAndApply(cards, sourceKey, destKey, result.state)
      } else {
        // Invalid move - try auto-play on tapped card, or select it
        const dest = findAutoPlayDestination(gameState.value, 'tableau', columnIndex, cardIndex)
        if (dest) {
          const autoResult = tryAutoPlay(gameState.value, 'tableau', columnIndex, cardIndex)
          if (autoResult.success) {
            const tempSelection: Selection = { source: 'tableau', columnIndex, cardIndex }
            const cards = getSelectedCards(gameState.value, tempSelection)
            const sourceKey = `tableau-${columnIndex}-${cardIndex}`
            const destKey = getDestKey(dest.type, dest.index, gameState.value)
            await animateAndApply(cards, sourceKey, destKey, autoResult.state)
            return
          }
        }
        const newState = selectCard(gameState.value, 'tableau', columnIndex, cardIndex)
        updateState(newState, false) // Don't save selection changes to history
      }
    } else {
      // No selection - try auto-play first
      const dest = findAutoPlayDestination(gameState.value, 'tableau', columnIndex, cardIndex)
      if (dest) {
        const autoResult = tryAutoPlay(gameState.value, 'tableau', columnIndex, cardIndex)
        if (autoResult.success) {
          const tempSelection: Selection = { source: 'tableau', columnIndex, cardIndex }
          const cards = getSelectedCards(gameState.value, tempSelection)
          const sourceKey = `tableau-${columnIndex}-${cardIndex}`
          const destKey = getDestKey(dest.type, dest.index, gameState.value)
          await animateAndApply(cards, sourceKey, destKey, autoResult.state)
          return
        }
      }
      // No auto-play available, select the card
      const newState = selectCard(gameState.value, 'tableau', columnIndex, cardIndex)
      updateState(newState, false) // Don't save selection changes to history
    }
  }

  // Handle tapping an empty tableau column (for moving kings)
  async function handleEmptyTableauTap(columnIndex: number) {
    if (isAnimating.value) return
    if (!selection.value) return

    const result = moveToTableau(gameState.value, selection.value, columnIndex)
    if (result.success) {
      const cards = getSelectedCards(gameState.value, selection.value)
      const sourceKey = getSourceKey(selection.value)
      const destKey = `tableau-${columnIndex}` // Empty column
      await animateAndApply(cards, sourceKey, destKey, result.state)
    } else {
      // Invalid move - clear selection
      const newState = clearSelection(gameState.value)
      updateState(newState, false) // Don't save selection changes to history
    }
  }

  // Handle tapping the waste pile
  async function handleWasteTap() {
    if (isAnimating.value) return
    if (waste.value.length === 0) return

    // If we have a selection from waste, try auto-play or deselect
    if (selection.value?.source === 'waste') {
      // Try auto-play
      const dest = findAutoPlayDestination(gameState.value, 'waste')
      if (dest) {
        const autoResult = tryAutoPlay(gameState.value, 'waste')
        if (autoResult.success) {
          const cards = [waste.value[waste.value.length - 1]!]
          const sourceKey = 'waste'
          const destKey = getDestKey(dest.type, dest.index, gameState.value)
          await animateAndApply(cards, sourceKey, destKey, autoResult.state)
          return
        }
      }
      // No valid move, deselect
      const newState = clearSelection(gameState.value)
      updateState(newState, false) // Don't save selection changes to history
      return
    }

    // Clear any existing selection and try auto-play on waste
    const dest = findAutoPlayDestination(gameState.value, 'waste')
    if (dest) {
      const autoResult = tryAutoPlay(gameState.value, 'waste')
      if (autoResult.success) {
        const cards = [waste.value[waste.value.length - 1]!]
        const sourceKey = 'waste'
        const destKey = getDestKey(dest.type, dest.index, gameState.value)
        await animateAndApply(cards, sourceKey, destKey, autoResult.state)
        return
      }
    }
    // No auto-play available, select the waste card
    const newState = selectCard(gameState.value, 'waste')
    updateState(newState, false) // Don't save selection changes to history
  }

  // Handle tapping a foundation pile
  async function handleFoundationTap(foundationIndex: number) {
    if (isAnimating.value) return
    if (!selection.value) return

    const result = moveToFoundation(gameState.value, selection.value, foundationIndex)
    if (result.success) {
      const cards = getSelectedCards(gameState.value, selection.value)
      const sourceKey = getSourceKey(selection.value)
      const destKey = `foundation-${foundationIndex}`
      await animateAndApply(cards, sourceKey, destKey, result.state)
    } else {
      // Invalid move - clear selection
      const newState = clearSelection(gameState.value)
      updateState(newState, false) // Don't save selection changes to history
    }
  }

  // Handle double-tap to auto-move to foundation
  function handleAutoMoveToFoundation() {
    if (!selection.value) return

    const result = autoMoveToFoundation(gameState.value, selection.value)
    if (result.success) {
      updateState(result.state)
    }
  }

  // Run auto-complete animation
  async function runAutoComplete() {
    if (!canRunAutoComplete.value || isAutoCompleting.value) return

    isAutoCompleting.value = true

    const step = () => {
      const newState = autoCompleteStep(gameState.value)
      if (newState) {
        updateState(newState)
        if (!newState.isWon) {
          setTimeout(step, 150) // Animate quickly
        } else {
          isAutoCompleting.value = false
        }
      } else {
        isAutoCompleting.value = false
      }
    }

    step()
  }

  // Check if a card is selected
  function isCardSelected(source: 'tableau' | 'waste', columnIndex?: number, cardIndex?: number): boolean {
    if (!selection.value) return false

    if (source === 'waste') {
      return selection.value.source === 'waste'
    }

    if (source === 'tableau' && columnIndex !== undefined && cardIndex !== undefined) {
      return (
        selection.value.source === 'tableau' &&
        selection.value.columnIndex === columnIndex &&
        selection.value.cardIndex !== undefined &&
        cardIndex >= selection.value.cardIndex
      )
    }

    return false
  }

  // Get source key for animation based on selection
  function getSourceKey(sel: Selection): string {
    if (sel.source === 'waste') {
      return 'waste'
    }
    // Tableau: use the first selected card's position
    return `tableau-${sel.columnIndex}-${sel.cardIndex}`
  }

  // Get destination key for animation
  function getDestKey(destType: 'tableau' | 'foundation', destIndex: number, state: KlondikeState): string {
    if (destType === 'foundation') {
      // If foundation is empty, use container, otherwise use top card position
      const foundation = state.foundations[destIndex]
      if (foundation && foundation.cards.length > 0) {
        return `foundation-${destIndex}`
      }
      return `foundation-${destIndex}`
    }
    // Tableau: cards will land on top of the column
    const column = state.tableau[destIndex]
    if (column && column.cards.length > 0) {
      return `tableau-${destIndex}-${column.cards.length - 1}`
    }
    return `tableau-${destIndex}`
  }

  // Find destination from tryAutoPlay by pre-checking
  function findAutoPlayDestination(
    state: KlondikeState,
    source: 'tableau' | 'waste',
    columnIndex?: number,
    cardIndex?: number
  ): { type: 'foundation' | 'tableau', index: number } | null {
    let cards: KlondikeCard[]
    let sourceColIdx: number | undefined
    
    if (source === 'waste') {
      if (state.waste.length === 0) return null
      cards = [state.waste[state.waste.length - 1]!]
    } else {
      if (columnIndex === undefined || cardIndex === undefined) return null
      const column = state.tableau[columnIndex]
      if (!column || !column.cards[cardIndex]?.faceUp) return null
      cards = column.cards.slice(cardIndex)
      sourceColIdx = columnIndex
    }

    // Single card: try foundation first
    if (cards.length === 1) {
      const foundationIdx = findValidFoundation(cards[0]!, state.foundations)
      if (foundationIdx !== -1) {
        return { type: 'foundation', index: foundationIdx }
      }
    }

    // Try tableau
    const tableauIdx = findValidTableau(cards[0]!, state.tableau, sourceColIdx)
    if (tableauIdx !== -1) {
      return { type: 'tableau', index: tableauIdx }
    }

    return null
  }

  // Animate a move and then apply state
  async function animateAndApply(
    cards: KlondikeCard[],
    sourceKey: string,
    destKey: string,
    newState: KlondikeState
  ) {
    const animation = getKlondikeAnimation()
    
    if (isAnimating.value) {
      // Skip animation if already animating
      updateState(newState)
      return
    }

    // Get positions
    const sourcePos = animation.getCardPosition(sourceKey) || animation.getContainerPosition(sourceKey)
    const destPos = animation.getCardPosition(destKey) || animation.getContainerPosition(destKey)
    
    if (!sourcePos || !destPos) {
      console.log('[Store] Missing positions, skipping animation', { sourceKey, destKey, sourcePos, destPos })
      updateState(newState)
      return
    }

    isAnimating.value = true
    
    // Calculate destination offset for tableau stacking
    // Cards stack with ~30% of card height offset for face-up cards
    const FACE_UP_OFFSET_RATIO = 0.30
    let destOffsetY = 0
    
    // If destination is a tableau column with cards, offset by one card position
    if (destKey.startsWith('tableau-')) {
      const parts = destKey.split('-')
      const colIndex = parseInt(parts[1]!)
      const column = gameState.value.tableau[colIndex]
      if (column && column.cards.length > 0) {
        // There are cards in the column, so we land below the top card
        destOffsetY = destPos.height * FACE_UP_OFFSET_RATIO
      }
    }
    
    // Create flying cards in store (for reactivity)
    const newFlyingCards: FlyingCard[] = cards.map((card, index) => ({
      id: `flying-${card.id}`,
      card,
      startX: sourcePos.x,
      startY: sourcePos.y + (index * destPos.height * FACE_UP_OFFSET_RATIO),
      endX: destPos.x,
      endY: destPos.y + destOffsetY + (index * destPos.height * FACE_UP_OFFSET_RATIO),
      width: sourcePos.width,
      height: sourcePos.height,
    }))
    
    // Hide the source cards
    const cardIds = cards.map(c => c.id)
    hiddenCardIds.value = new Set(cardIds)
    
    flyingCards.value = newFlyingCards
    console.log('[Store] Flying cards set:', flyingCards.value.length, 'hidden:', cardIds)

    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, ANIMATION_DURATION + 50))

    // Clear flying cards, update state, then unhide
    flyingCards.value = []
    updateState(newState)
    hiddenCardIds.value = new Set()
    isAnimating.value = false
  }

  return {
    // State
    tableau,
    foundations,
    stock,
    waste,
    selection,
    moveCount,
    isWon,
    isAutoCompleting,
    drawCount,
    isAnimating,
    flyingCards,
    hiddenCardIds,

    // Computed
    gameState,
    wasteTopCard,
    visibleWasteCards,
    canRunAutoComplete,
    canUndo,
    noMovesAvailable,

    // Actions
    startNewGame,
    handleDrawCard,
    handleTableauTap,
    handleEmptyTableauTap,
    handleWasteTap,
    handleFoundationTap,
    handleAutoMoveToFoundation,
    runAutoComplete,
    isCardSelected,
    undo,
  }
})
