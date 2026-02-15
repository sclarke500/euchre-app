/**
 * Solitaire Card Animation System
 * 
 * Uses FLIP technique for smooth animations:
 * - First: Record starting positions
 * - Last: Update state, get ending positions
 * - Invert: Transform cards back to start
 * - Play: Animate transform to zero
 * 
 * Reusable across solitaire games (Klondike, Spider, FreeCell, etc.)
 */

import { ref, nextTick } from 'vue'

export interface CardRect {
  x: number
  y: number
  width: number
  height: number
}

export interface AnimatingCard {
  id: string
  fromX: number
  fromY: number
  toX: number
  toY: number
}

// Track positions of all cards by ID
const cardPositions = new Map<string, CardRect>()

// Cards currently animating (used to apply inverted transform)
const animatingCards = ref<Map<string, AnimatingCard>>(new Map())

// Animation duration
const ANIMATION_DURATION = 300

export function useSolitaireCards() {
  
  /**
   * Register a card's current position (call from card component)
   */
  function registerCardPosition(id: string, rect: CardRect) {
    cardPositions.set(id, rect)
  }

  /**
   * Get a card's last known position
   */
  function getCardPosition(id: string): CardRect | undefined {
    return cardPositions.get(id)
  }

  /**
   * Capture positions of cards before a state change
   * Returns a map of card ID -> position
   */
  function capturePositions(cardIds: string[]): Map<string, CardRect> {
    const captured = new Map<string, CardRect>()
    for (const id of cardIds) {
      const pos = cardPositions.get(id)
      if (pos) {
        captured.set(id, { ...pos })
      }
    }
    return captured
  }

  /**
   * Animate cards from their old positions to new positions
   * Call this AFTER state has changed
   */
  async function animateCards(
    beforePositions: Map<string, CardRect>,
    getNewPosition: (id: string) => CardRect | null
  ): Promise<void> {
    const toAnimate: AnimatingCard[] = []

    for (const [id, oldPos] of beforePositions) {
      const newPos = getNewPosition(id)
      if (newPos) {
        // Calculate the offset from old to new
        const dx = oldPos.x - newPos.x
        const dy = oldPos.y - newPos.y

        // Only animate if there's actual movement
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          toAnimate.push({
            id,
            fromX: dx,
            fromY: dy,
            toX: 0,
            toY: 0,
          })
        }
      }
    }

    if (toAnimate.length === 0) return

    // Set initial inverted positions (FLIP - Invert)
    const newMap = new Map<string, AnimatingCard>()
    for (const card of toAnimate) {
      newMap.set(card.id, card)
    }
    animatingCards.value = newMap

    // Wait a frame for the inverted transform to apply
    await nextTick()
    await new Promise(r => requestAnimationFrame(r))

    // Now animate to final position (FLIP - Play)
    const finalMap = new Map<string, AnimatingCard>()
    for (const card of toAnimate) {
      finalMap.set(card.id, { ...card, fromX: 0, fromY: 0 })
    }
    animatingCards.value = finalMap

    // Wait for animation to complete
    await new Promise(r => setTimeout(r, ANIMATION_DURATION))

    // Clear animating state
    animatingCards.value = new Map()
  }

  /**
   * Get the current animation offset for a card (if animating)
   * Returns { x, y } offset to apply as transform
   */
  function getAnimationOffset(id: string): { x: number; y: number } | null {
    const anim = animatingCards.value.get(id)
    if (anim) {
      return { x: anim.fromX, y: anim.fromY }
    }
    return null
  }

  /**
   * Check if any cards are currently animating
   */
  function isAnimating(): boolean {
    return animatingCards.value.size > 0
  }

  return {
    registerCardPosition,
    getCardPosition,
    capturePositions,
    animateCards,
    getAnimationOffset,
    isAnimating,
    animatingCards,
  }
}

// Singleton instance for shared state
let instance: ReturnType<typeof useSolitaireCards> | null = null

export function getSolitaireCards() {
  if (!instance) {
    instance = useSolitaireCards()
  }
  return instance
}

export function resetSolitaireCards() {
  cardPositions.clear()
  if (instance) {
    instance.animatingCards.value = new Map()
  }
  instance = null
}
