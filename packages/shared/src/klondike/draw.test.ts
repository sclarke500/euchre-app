/**
 * Unit tests for Klondike draw mechanics
 * Tests both strict (Vegas) and wrap (traditional) recycle modes
 */

import { describe, it, expect } from 'vitest'
import { createNewGame } from './game.js'
import { drawCard } from './moves.js'
import type { KlondikeState, KlondikeCard } from './types.js'

// Helper to create a minimal test state with just stock/waste
function createTestState(
  stockCards: string[],
  wasteCards: string[],
  drawCount: 1 | 3,
  recycleMode: 'strict' | 'wrap'
): KlondikeState {
  const makeCard = (id: string): KlondikeCard => ({
    id,
    suit: 'hearts' as any,
    rank: 'A' as any,
    faceUp: false,
  })

  return {
    tableau: Array(7).fill({ cards: [] }),
    foundations: Array(4).fill({ suit: null, cards: [] }),
    stock: stockCards.map(makeCard),
    waste: wasteCards.map(c => ({ ...makeCard(c), faceUp: true })),
    selection: null,
    moveCount: 0,
    isWon: false,
    drawCount,
    recycleMode,
  }
}

// Helper to get top of waste (playable card)
function getPlayable(state: KlondikeState): string | null {
  if (state.waste.length === 0) return null
  return state.waste[state.waste.length - 1]!.id
}

// Helper to cycle through and collect all accessible cards
function getAllAccessible(state: KlondikeState, maxClicks = 50): Set<string> {
  const accessible = new Set<string>()
  let current = state
  let clicks = 0
  const seenStates = new Set<string>()

  while (clicks < maxClicks) {
    const stateKey = `${current.stock.map(c => c.id).join(',')}-${current.waste.map(c => c.id).join(',')}`
    if (seenStates.has(stateKey)) break // Full cycle detected
    seenStates.add(stateKey)

    const result = drawCard(current)
    if (!result.success) break
    current = result.state
    clicks++

    const playable = getPlayable(current)
    if (playable) accessible.add(playable)
  }

  return accessible
}

describe('Klondike Draw - Strict Mode (Vegas)', () => {
  it('draws 3 cards at a time', () => {
    const state = createTestState(['A', 'B', 'C', 'D', 'E'], [], 3, 'strict')
    const result = drawCard(state)
    
    expect(result.success).toBe(true)
    expect(result.state.waste.length).toBe(3)
    expect(result.state.stock.length).toBe(2)
    expect(getPlayable(result.state)).toBe('E') // Top of stock ends up on top of waste
  })

  it('draws 1 card at a time when drawCount=1', () => {
    const state = createTestState(['A', 'B', 'C', 'D', 'E'], [], 1, 'strict')
    const result = drawCard(state)
    
    expect(result.success).toBe(true)
    expect(result.state.waste.length).toBe(1)
    expect(result.state.stock.length).toBe(4)
    expect(getPlayable(result.state)).toBe('E')
  })

  it('with 5 cards draw-3 strict, card D is locked forever', () => {
    const state = createTestState(['A', 'B', 'C', 'D', 'E'], [], 3, 'strict')
    const accessible = getAllAccessible(state)
    
    expect(accessible.has('A')).toBe(true)
    expect(accessible.has('B')).toBe(true)
    expect(accessible.has('C')).toBe(true)
    expect(accessible.has('D')).toBe(false) // D is locked!
    expect(accessible.has('E')).toBe(true)
    expect(accessible.size).toBe(4)
  })

  it('with 6 cards draw-3 strict, some cards are locked', () => {
    const state = createTestState(['A', 'B', 'C', 'D', 'E', 'F'], [], 3, 'strict')
    const accessible = getAllAccessible(state)
    
    // With 6 cards: F, C, D, A accessible. E, B locked.
    expect(accessible.has('F')).toBe(true)
    expect(accessible.has('C')).toBe(true)
    expect(accessible.has('D')).toBe(true)
    expect(accessible.has('A')).toBe(true)
    expect(accessible.has('E')).toBe(false)
    expect(accessible.has('B')).toBe(false)
    expect(accessible.size).toBe(4)
  })

  it('recycle is a separate action when stock is empty', () => {
    const state = createTestState([], ['A', 'B', 'C'], 3, 'strict')
    const result = drawCard(state)
    
    expect(result.success).toBe(true)
    expect(result.moveType).toBe('recycle')
    expect(result.state.stock.length).toBe(3)
    expect(result.state.waste.length).toBe(0)
  })

  it('draw-1 strict allows access to all cards', () => {
    const state = createTestState(['A', 'B', 'C', 'D', 'E'], [], 1, 'strict')
    const accessible = getAllAccessible(state)
    
    expect(accessible.size).toBe(5)
    expect(accessible.has('A')).toBe(true)
    expect(accessible.has('B')).toBe(true)
    expect(accessible.has('C')).toBe(true)
    expect(accessible.has('D')).toBe(true)
    expect(accessible.has('E')).toBe(true)
  })
})

describe('Klondike Draw - Wrap Mode (Traditional)', () => {
  it('wraps partial draw to access all cards', () => {
    const state = createTestState(['A', 'B', 'C', 'D', 'E'], [], 3, 'wrap')
    const accessible = getAllAccessible(state)
    
    // Wrap mode should allow access to ALL cards
    expect(accessible.size).toBe(5)
    expect(accessible.has('A')).toBe(true)
    expect(accessible.has('B')).toBe(true)
    expect(accessible.has('C')).toBe(true)
    expect(accessible.has('D')).toBe(true)
    expect(accessible.has('E')).toBe(true)
  })

  it('with 6 cards draw-3 wrap, same as strict (divisible by drawCount)', () => {
    // When card count is divisible by drawCount, there are no partial draws,
    // so wrap mode offers no advantage - same cards are locked as in strict
    const state = createTestState(['A', 'B', 'C', 'D', 'E', 'F'], [], 3, 'wrap')
    const accessible = getAllAccessible(state)
    
    // Same as strict: F, C, D, A accessible. E, B locked.
    expect(accessible.size).toBe(4)
  })

  it('with 7 cards draw-3 wrap, all cards accessible', () => {
    // 7 % 3 = 1, so there's a partial draw that enables wrap shifting
    const state = createTestState(['A', 'B', 'C', 'D', 'E', 'F', 'G'], [], 3, 'wrap')
    const accessible = getAllAccessible(state)
    
    expect(accessible.size).toBe(7)
  })

  it('auto-recycles when stock has fewer than drawCount', () => {
    // Start with 2 cards in stock, 3 in waste
    const state = createTestState(['A', 'B'], ['C', 'D', 'E'], 3, 'wrap')
    const result = drawCard(state)
    
    expect(result.success).toBe(true)
    // Should have drawn A, B, then recycled C,D,E and drawn one more
    // Result should have 3 cards visible on waste
  })

  it('with empty stock, recycles then draws', () => {
    const state = createTestState([], ['A', 'B', 'C', 'D', 'E'], 3, 'wrap')
    const result = drawCard(state)
    
    expect(result.success).toBe(true)
    // In wrap mode, should recycle AND draw in one action
    expect(result.state.waste.length).toBe(3)
  })
})

describe('Klondike Draw - Edge Cases', () => {
  it('fails when both stock and waste are empty', () => {
    const state = createTestState([], [], 3, 'strict')
    const result = drawCard(state)
    
    expect(result.success).toBe(false)
  })

  it('handles single card in stock', () => {
    const state = createTestState(['A'], [], 3, 'strict')
    const result = drawCard(state)
    
    expect(result.success).toBe(true)
    expect(result.state.waste.length).toBe(1)
    expect(getPlayable(result.state)).toBe('A')
  })

  it('handles exactly drawCount cards', () => {
    const state = createTestState(['A', 'B', 'C'], [], 3, 'strict')
    const result = drawCard(state)
    
    expect(result.success).toBe(true)
    expect(result.state.stock.length).toBe(0)
    expect(result.state.waste.length).toBe(3)
  })
})
