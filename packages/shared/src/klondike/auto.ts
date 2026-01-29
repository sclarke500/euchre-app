// Klondike auto-complete logic
// Auto-complete when all cards are face-up and no stock/waste

import type { KlondikeState, KlondikeCard } from './types.js'
import { cloneState, checkWin } from './game.js'
import { canMoveToFoundation, getRankValue } from './moves.js'

/**
 * Check if auto-complete is available
 * Conditions:
 * - Stock is empty
 * - Waste is empty
 * - All tableau cards are face-up
 */
export function canAutoComplete(state: KlondikeState): boolean {
  // Stock and waste must be empty
  if (state.stock.length > 0 || state.waste.length > 0) {
    return false
  }

  // All tableau cards must be face-up
  for (const column of state.tableau) {
    for (const card of column.cards) {
      if (!card.faceUp) {
        return false
      }
    }
  }

  return true
}

/**
 * Find the next card that can be moved to a foundation
 * Returns [columnIndex, card] or null if none found
 */
function findNextAutoMove(state: KlondikeState): [number, KlondikeCard] | null {
  // Find the minimum rank currently safe to place on foundations
  // A card is safe to auto-move if both cards of the opposite color
  // with rank one less are already in foundations

  for (let colIndex = 0; colIndex < state.tableau.length; colIndex++) {
    const column = state.tableau[colIndex]!
    if (column.cards.length === 0) continue

    const topCard = column.cards[column.cards.length - 1]!

    // Check if this card can go on any foundation
    for (const foundation of state.foundations) {
      if (canMoveToFoundation(topCard, foundation)) {
        return [colIndex, topCard]
      }
    }
  }

  return null
}

/**
 * Perform one step of auto-complete
 * Returns the new state, or null if no move was made
 */
export function autoCompleteStep(state: KlondikeState): KlondikeState | null {
  if (!canAutoComplete(state)) {
    return null
  }

  const move = findNextAutoMove(state)
  if (!move) {
    return null
  }

  const [colIndex, card] = move
  const newState = cloneState(state)

  // Find the foundation to move to
  let targetFoundationIndex = -1
  for (let i = 0; i < newState.foundations.length; i++) {
    if (canMoveToFoundation(card, newState.foundations[i]!)) {
      targetFoundationIndex = i
      break
    }
  }

  if (targetFoundationIndex === -1) {
    return null
  }

  // Move the card
  const column = newState.tableau[colIndex]!
  const movedCard = column.cards.pop()!

  const foundation = newState.foundations[targetFoundationIndex]!
  if (foundation.suit === null) {
    foundation.suit = movedCard.suit
  }
  foundation.cards.push(movedCard)

  newState.moveCount++
  newState.isWon = checkWin(newState)

  return newState
}

/**
 * Perform full auto-complete animation sequence
 * Returns array of states for each step (for animation)
 */
export function getAutoCompleteSequence(state: KlondikeState): KlondikeState[] {
  const sequence: KlondikeState[] = []
  let currentState = state

  while (true) {
    const nextState = autoCompleteStep(currentState)
    if (!nextState) break

    sequence.push(nextState)
    currentState = nextState

    // Safety check to prevent infinite loops
    if (sequence.length > 52) break
  }

  return sequence
}
