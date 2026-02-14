// Klondike move validation and execution

import type { KlondikeCard, KlondikeState, Selection, MoveResult, FoundationPile, TableauColumn } from './types.js'
import { RANK_VALUES, RED_SUITS } from './types.js'
import { FullRank } from '../core/types.js'
import { cloneState, checkWin } from './game.js'

/**
 * Check if a card is red (hearts or diamonds)
 */
export function isRed(card: KlondikeCard): boolean {
  return RED_SUITS.has(card.suit)
}

/**
 * Check if two cards have opposite colors
 */
export function isOppositeColor(card1: KlondikeCard, card2: KlondikeCard): boolean {
  return isRed(card1) !== isRed(card2)
}

/**
 * Get the rank value (Ace=1, King=13)
 */
export function getRankValue(card: KlondikeCard): number {
  return RANK_VALUES[card.rank]
}

/**
 * Check if a card can be placed on a foundation pile
 * - Empty foundation: only Ace
 * - Non-empty: same suit, one rank higher
 */
export function canMoveToFoundation(card: KlondikeCard, foundation: FoundationPile): boolean {
  if (foundation.cards.length === 0) {
    // Empty foundation: only Ace
    return card.rank === FullRank.Ace
  }

  const topCard = foundation.cards[foundation.cards.length - 1]!
  // Same suit, one rank higher
  return card.suit === topCard.suit && getRankValue(card) === getRankValue(topCard) + 1
}

/**
 * Check if card(s) can be placed on a tableau column
 * - Empty column: only King
 * - Non-empty: opposite color, one rank lower
 */
export function canMoveToTableau(card: KlondikeCard, column: TableauColumn): boolean {
  if (column.cards.length === 0) {
    // Empty column: only King
    return card.rank === FullRank.King
  }

  const topCard = column.cards[column.cards.length - 1]!
  // Opposite color, one rank lower than top card
  return isOppositeColor(card, topCard) && getRankValue(card) === getRankValue(topCard) - 1
}

/**
 * Find a foundation pile that can accept this card
 * Returns the index, or -1 if none
 */
export function findValidFoundation(card: KlondikeCard, foundations: FoundationPile[]): number {
  for (let i = 0; i < foundations.length; i++) {
    if (canMoveToFoundation(card, foundations[i]!)) {
      return i
    }
  }
  return -1
}

/**
 * Find a tableau column that can accept this card
 * Optionally exclude a source column (to avoid moving to same column)
 * Returns the index, or -1 if none
 */
export function findValidTableau(
  card: KlondikeCard, 
  tableau: TableauColumn[], 
  excludeColumn?: number
): number {
  for (let i = 0; i < tableau.length; i++) {
    if (i === excludeColumn) continue
    if (canMoveToTableau(card, tableau[i]!)) {
      return i
    }
  }
  return -1
}

/**
 * Draw card(s) from stock to waste
 * Respects the drawCount setting (1 or 3 cards at a time)
 */
export function drawCard(state: KlondikeState): MoveResult {
  const newState = cloneState(state)

  if (newState.stock.length === 0) {
    // Recycle waste back to stock
    if (newState.waste.length === 0) {
      return { success: false, state }
    }

    // Move all waste cards back to stock (reversed), face-down
    newState.stock = newState.waste.reverse().map((c) => ({ ...c, faceUp: false }))
    newState.waste = []
    newState.selection = null
    newState.moveCount++

    return { success: true, state: newState, moveType: 'recycle' }
  }

  // Draw cards from stock to waste (1 or 3 based on drawCount)
  const cardsToDraw = Math.min(newState.drawCount, newState.stock.length)
  for (let i = 0; i < cardsToDraw; i++) {
    const card = newState.stock.pop()!
    card.faceUp = true
    newState.waste.push(card)
  }
  newState.selection = null
  newState.moveCount++

  return { success: true, state: newState, moveType: 'draw' }
}

/**
 * Get the cards that would be moved from a selection
 */
export function getSelectedCards(state: KlondikeState, selection: Selection): KlondikeCard[] {
  if (selection.source === 'waste') {
    const card = state.waste[state.waste.length - 1]
    return card ? [card] : []
  }

  // Tableau: get all cards from cardIndex to end
  const column = state.tableau[selection.columnIndex!]
  if (!column) return []
  return column.cards.slice(selection.cardIndex)
}

/**
 * Move selected cards to a tableau column
 */
export function moveToTableau(
  state: KlondikeState,
  selection: Selection,
  targetColumnIndex: number
): MoveResult {
  const cards = getSelectedCards(state, selection)
  if (cards.length === 0) {
    return { success: false, state }
  }

  const bottomCard = cards[0]!
  const targetColumn = state.tableau[targetColumnIndex]
  if (!targetColumn || !canMoveToTableau(bottomCard, targetColumn)) {
    return { success: false, state }
  }

  const newState = cloneState(state)
  const newTargetColumn = newState.tableau[targetColumnIndex]!

  // Remove cards from source
  if (selection.source === 'waste') {
    newState.waste.pop()
  } else {
    const sourceColumn = newState.tableau[selection.columnIndex!]!
    sourceColumn.cards = sourceColumn.cards.slice(0, selection.cardIndex)

    // Flip top card of source column if needed
    if (sourceColumn.cards.length > 0) {
      sourceColumn.cards[sourceColumn.cards.length - 1]!.faceUp = true
    }
  }

  // Add cards to target
  newTargetColumn.cards.push(...cards.map((c) => ({ ...c })))

  newState.selection = null
  newState.moveCount++

  const moveType = selection.source === 'waste' ? 'waste-to-tableau' : 'tableau-to-tableau'
  return { success: true, state: newState, moveType }
}

/**
 * Move selected card to a foundation
 * Only single cards can go to foundations
 */
export function moveToFoundation(
  state: KlondikeState,
  selection: Selection,
  targetFoundationIndex: number
): MoveResult {
  const cards = getSelectedCards(state, selection)

  // Can only move single cards to foundation
  if (cards.length !== 1) {
    return { success: false, state }
  }

  const card = cards[0]!
  const targetFoundation = state.foundations[targetFoundationIndex]
  if (!targetFoundation || !canMoveToFoundation(card, targetFoundation)) {
    return { success: false, state }
  }

  const newState = cloneState(state)
  const newFoundation = newState.foundations[targetFoundationIndex]!

  // Remove card from source
  if (selection.source === 'waste') {
    newState.waste.pop()
  } else {
    const sourceColumn = newState.tableau[selection.columnIndex!]!
    sourceColumn.cards.pop()

    // Flip top card of source column if needed
    if (sourceColumn.cards.length > 0) {
      sourceColumn.cards[sourceColumn.cards.length - 1]!.faceUp = true
    }
  }

  // Add card to foundation
  if (newFoundation.suit === null) {
    newFoundation.suit = card.suit
  }
  newFoundation.cards.push({ ...card })

  newState.selection = null
  newState.moveCount++
  newState.isWon = checkWin(newState)

  const moveType = selection.source === 'waste' ? 'waste-to-foundation' : 'tableau-to-foundation'
  return { success: true, state: newState, moveType }
}

/**
 * Auto-move card to foundation if possible (double-tap behavior)
 * Returns the new state if successful, null otherwise
 */
export function autoMoveToFoundation(
  state: KlondikeState,
  selection: Selection
): MoveResult {
  const cards = getSelectedCards(state, selection)
  if (cards.length !== 1) {
    return { success: false, state }
  }

  const card = cards[0]!
  const foundationIndex = findValidFoundation(card, state.foundations)

  if (foundationIndex === -1) {
    return { success: false, state }
  }

  return moveToFoundation(state, selection, foundationIndex)
}

/**
 * Try to auto-play a card when tapped
 * Priority: Foundation first (single cards only), then tableau
 * Returns MoveResult with success=true if a move was made
 */
export function tryAutoPlay(
  state: KlondikeState,
  source: 'tableau' | 'waste',
  columnIndex?: number,
  cardIndex?: number
): MoveResult {
  // Build a selection for the tapped card
  let selection: Selection
  let cards: KlondikeCard[]
  let sourceColumnIndex: number | undefined

  if (source === 'waste') {
    if (state.waste.length === 0) {
      return { success: false, state }
    }
    selection = { source: 'waste', cardIndex: state.waste.length - 1 }
    cards = [state.waste[state.waste.length - 1]!]
  } else {
    // Tableau
    if (columnIndex === undefined || cardIndex === undefined) {
      return { success: false, state }
    }
    const column = state.tableau[columnIndex]
    if (!column || cardIndex >= column.cards.length) {
      return { success: false, state }
    }
    const card = column.cards[cardIndex]
    if (!card || !card.faceUp) {
      return { success: false, state }
    }
    selection = { source: 'tableau', columnIndex, cardIndex }
    cards = column.cards.slice(cardIndex)
    sourceColumnIndex = columnIndex
  }

  // Single card: try foundation first
  if (cards.length === 1) {
    const card = cards[0]!
    const foundationIndex = findValidFoundation(card, state.foundations)
    if (foundationIndex !== -1) {
      return moveToFoundation(state, selection, foundationIndex)
    }
  }

  // Try to move to a tableau column
  const bottomCard = cards[0]!
  const tableauIndex = findValidTableau(bottomCard, state.tableau, sourceColumnIndex)
  if (tableauIndex !== -1) {
    return moveToTableau(state, selection, tableauIndex)
  }

  // No valid auto-play found
  return { success: false, state }
}

/**
 * Select a card or clear selection
 */
export function selectCard(
  state: KlondikeState,
  source: 'tableau' | 'waste',
  columnIndex?: number,
  cardIndex?: number
): KlondikeState {
  const newState = cloneState(state)

  // If tapping waste, select the top card
  if (source === 'waste') {
    if (state.waste.length === 0) {
      newState.selection = null
    } else {
      newState.selection = {
        source: 'waste',
        cardIndex: state.waste.length - 1,
      }
    }
    return newState
  }

  // Tableau selection
  if (columnIndex === undefined || cardIndex === undefined) {
    newState.selection = null
    return newState
  }

  const column = state.tableau[columnIndex]
  if (!column || cardIndex >= column.cards.length) {
    newState.selection = null
    return newState
  }

  const card = column.cards[cardIndex]
  if (!card || !card.faceUp) {
    // Can't select face-down cards
    newState.selection = null
    return newState
  }

  // Check if tapping already selected card (deselect)
  if (
    state.selection &&
    state.selection.source === 'tableau' &&
    state.selection.columnIndex === columnIndex &&
    state.selection.cardIndex === cardIndex
  ) {
    newState.selection = null
    return newState
  }

  newState.selection = {
    source: 'tableau',
    columnIndex,
    cardIndex,
  }

  return newState
}

/**
 * Clear the current selection
 */
export function clearSelection(state: KlondikeState): KlondikeState {
  const newState = cloneState(state)
  newState.selection = null
  return newState
}

/**
 * Check if any moves are available
 * Returns true if there's at least one possible move
 */
export function hasAvailableMoves(state: KlondikeState): boolean {
  // Can draw from stock or recycle waste?
  if (state.stock.length > 0 || state.waste.length > 0) {
    // Drawing is always an option if there are cards
    return true
  }

  // Check waste top card
  if (state.waste.length > 0) {
    const wasteCard = state.waste[state.waste.length - 1]!
    // Can move to foundation?
    if (findValidFoundation(wasteCard, state.foundations) !== -1) return true
    // Can move to tableau?
    if (findValidTableau(wasteCard, state.tableau) !== -1) return true
  }

  // Check all face-up tableau cards
  for (let colIdx = 0; colIdx < state.tableau.length; colIdx++) {
    const column = state.tableau[colIdx]!
    for (let cardIdx = 0; cardIdx < column.cards.length; cardIdx++) {
      const card = column.cards[cardIdx]!
      if (!card.faceUp) continue

      // Single top card can go to foundation
      if (cardIdx === column.cards.length - 1) {
        if (findValidFoundation(card, state.foundations) !== -1) return true
      }

      // Any face-up card (and cards below it) can potentially move to another tableau
      if (findValidTableau(card, state.tableau, colIdx) !== -1) return true
    }
  }

  // No moves found
  return false
}
