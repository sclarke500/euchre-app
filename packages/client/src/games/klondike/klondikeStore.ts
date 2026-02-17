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
  tryAutoPlay,
  clearSelection,
  canAutoComplete,
  autoCompleteStep,
  hasAvailableMoves,
} from '@67cards/shared'

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
  const drawCount = ref<1 | 3>(3)

  // History for undo
  const history = ref<string[]>([])
  const MAX_HISTORY = 50

  // Computed game state
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

  const wasteTopCard = computed(() =>
    waste.value.length > 0 ? waste.value[waste.value.length - 1] : null
  )

  const canRunAutoComplete = computed(() => canAutoComplete(gameState.value))
  const canUndo = computed(() => history.value.length > 0)
  const noMovesAvailable = computed(() => !hasAvailableMoves(gameState.value))

  const visibleWasteCards = computed(() => {
    const len = waste.value.length
    if (len === 0) return []
    const start = Math.max(0, len - drawCount.value)
    return waste.value.slice(start)
  })

  // Save state to history
  function saveToHistory() {
    const snapshot = JSON.stringify(gameState.value)
    history.value.push(snapshot)
    if (history.value.length > MAX_HISTORY) {
      history.value.shift()
    }
  }

  // Update state from a new game state
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

  // Actions
  function undo() {
    if (history.value.length === 0) return
    const previousSnapshot = history.value.pop()!
    const previousState = JSON.parse(previousSnapshot) as KlondikeState
    updateState(previousState, false)
  }

  function startNewGame() {
    history.value = []
    const state = createNewGame(drawCount.value)
    updateState(state, false)
    isAutoCompleting.value = false
  }

  function handleDrawCard() {
    const result = drawCard(gameState.value)
    if (result.success) {
      updateState(result.state)
    }
  }

  function handleTableauTap(columnIndex: number, cardIndex: number) {
    const column = tableau.value[columnIndex]
    if (!column) return

    const card = column.cards[cardIndex]
    if (!card || !card.faceUp) return

    if (selection.value) {
      // Same card tapped - deselect
      if (
        selection.value.source === 'tableau' &&
        selection.value.columnIndex === columnIndex &&
        selection.value.cardIndex === cardIndex
      ) {
        updateState(clearSelection(gameState.value), false)
        return
      }

      // Try to move selection to this column
      const result = moveToTableau(gameState.value, selection.value, columnIndex)
      if (result.success) {
        updateState(result.state)
      } else {
        // Try auto-play or select this card
        const autoResult = tryAutoPlay(gameState.value, 'tableau', columnIndex, cardIndex)
        if (autoResult.success) {
          updateState(autoResult.state)
        } else {
          updateState(selectCard(gameState.value, 'tableau', columnIndex, cardIndex), false)
        }
      }
    } else {
      // No selection - try auto-play first
      const autoResult = tryAutoPlay(gameState.value, 'tableau', columnIndex, cardIndex)
      if (autoResult.success) {
        updateState(autoResult.state)
      } else {
        updateState(selectCard(gameState.value, 'tableau', columnIndex, cardIndex), false)
      }
    }
  }

  function handleEmptyTableauTap(columnIndex: number) {
    if (!selection.value) return

    const result = moveToTableau(gameState.value, selection.value, columnIndex)
    if (result.success) {
      updateState(result.state)
    } else {
      updateState(clearSelection(gameState.value), false)
    }
  }

  // Select card for drag without triggering auto-play
  function selectForDrag(source: 'tableau' | 'waste', columnIndex?: number, cardIndex?: number) {
    if (source === 'tableau' && columnIndex !== undefined && cardIndex !== undefined) {
      updateState(selectCard(gameState.value, 'tableau', columnIndex, cardIndex), false)
    } else if (source === 'waste') {
      updateState(selectCard(gameState.value, 'waste'), false)
    }
  }

  function handleWasteTap() {
    if (waste.value.length === 0) return

    if (selection.value?.source === 'waste') {
      const autoResult = tryAutoPlay(gameState.value, 'waste')
      if (autoResult.success) {
        updateState(autoResult.state)
      } else {
        updateState(clearSelection(gameState.value), false)
      }
      return
    }

    const autoResult = tryAutoPlay(gameState.value, 'waste')
    if (autoResult.success) {
      updateState(autoResult.state)
    } else {
      updateState(selectCard(gameState.value, 'waste'), false)
    }
  }

  function handleFoundationTap(foundationIndex: number) {
    if (!selection.value) return

    const result = moveToFoundation(gameState.value, selection.value, foundationIndex)
    if (result.success) {
      updateState(result.state)
    } else {
      updateState(clearSelection(gameState.value), false)
    }
  }

  async function runAutoComplete() {
    if (!canRunAutoComplete.value || isAutoCompleting.value) return

    isAutoCompleting.value = true

    const step = () => {
      const newState = autoCompleteStep(gameState.value)
      if (newState) {
        updateState(newState)
        if (!newState.isWon) {
          setTimeout(step, 150)
        } else {
          isAutoCompleting.value = false
        }
      } else {
        isAutoCompleting.value = false
      }
    }

    step()
  }

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
    canUndo,
    noMovesAvailable,

    // Actions
    startNewGame,
    handleDrawCard,
    handleTableauTap,
    handleEmptyTableauTap,
    handleWasteTap,
    handleFoundationTap,
    selectForDrag,
    runAutoComplete,
    isCardSelected,
    undo,
  }
})
