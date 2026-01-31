import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  type KlondikeState,
  type KlondikeCard,
  type Selection,
  type TableauColumn,
  type FoundationPile,
  createNewGame,
  drawCard,
  selectCard,
  moveToTableau,
  moveToFoundation,
  autoMoveToFoundation,
  clearSelection,
  getSelectedCards,
  canMoveToTableau,
  canMoveToFoundation,
  canAutoComplete,
  autoCompleteStep,
} from '@euchre/shared'

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

  // Update state from a new game state
  function updateState(state: KlondikeState) {
    tableau.value = state.tableau
    foundations.value = state.foundations
    stock.value = state.stock
    waste.value = state.waste
    selection.value = state.selection
    moveCount.value = state.moveCount
    isWon.value = state.isWon
    drawCount.value = state.drawCount
  }

  // Start a new game
  function startNewGame() {
    const state = createNewGame(drawCount.value)
    updateState(state)
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
  function handleTableauTap(columnIndex: number, cardIndex: number) {
    const column = tableau.value[columnIndex]
    if (!column) return

    const card = column.cards[cardIndex]
    if (!card) return

    // If card is face-down, can't interact
    if (!card.faceUp) return

    // If we have a selection, try to move
    if (selection.value) {
      // If tapping same card, deselect
      if (
        selection.value.source === 'tableau' &&
        selection.value.columnIndex === columnIndex &&
        selection.value.cardIndex === cardIndex
      ) {
        const newState = clearSelection(gameState.value)
        updateState(newState)
        return
      }

      // Try to move to this column
      const result = moveToTableau(gameState.value, selection.value, columnIndex)
      if (result.success) {
        updateState(result.state)
      } else {
        // Invalid move - select this card instead
        const newState = selectCard(gameState.value, 'tableau', columnIndex, cardIndex)
        updateState(newState)
      }
    } else {
      // No selection - select this card
      const newState = selectCard(gameState.value, 'tableau', columnIndex, cardIndex)
      updateState(newState)
    }
  }

  // Handle tapping an empty tableau column (for moving kings)
  function handleEmptyTableauTap(columnIndex: number) {
    if (!selection.value) return

    const result = moveToTableau(gameState.value, selection.value, columnIndex)
    if (result.success) {
      updateState(result.state)
    } else {
      // Invalid move - clear selection
      const newState = clearSelection(gameState.value)
      updateState(newState)
    }
  }

  // Handle tapping the waste pile
  function handleWasteTap() {
    if (waste.value.length === 0) return

    // If we have a selection from waste, deselect
    if (selection.value?.source === 'waste') {
      const newState = clearSelection(gameState.value)
      updateState(newState)
      return
    }

    // If we have a different selection, clear it first and select waste
    const newState = selectCard(gameState.value, 'waste')
    updateState(newState)
  }

  // Handle tapping a foundation pile
  function handleFoundationTap(foundationIndex: number) {
    if (!selection.value) return

    const result = moveToFoundation(gameState.value, selection.value, foundationIndex)
    if (result.success) {
      updateState(result.state)
    } else {
      // Invalid move - clear selection
      const newState = clearSelection(gameState.value)
      updateState(newState)
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

    // Computed
    gameState,
    wasteTopCard,
    visibleWasteCards,
    canRunAutoComplete,

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
  }
})
