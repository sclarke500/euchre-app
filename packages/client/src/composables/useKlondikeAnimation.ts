import { ref, reactive, nextTick } from 'vue'
import type { KlondikeCard } from '@euchre/shared'

export interface FlyingCard {
  id: string
  card: KlondikeCard
  startX: number
  startY: number
  endX: number
  endY: number
  width: number
  height: number
}

export interface CardPosition {
  x: number
  y: number
  width: number
  height: number
}

// Registry of card element refs by location key
// Key format: "tableau-0-5" (column 0, card index 5), "waste", "foundation-2"
const cardRefs = new Map<string, HTMLElement>()

// Registry of container refs for empty targets
const containerRefs = new Map<string, HTMLElement>()

export function useKlondikeAnimation() {
  const flyingCards = ref<FlyingCard[]>([])
  const isAnimating = ref(false)

  // Register a card element for position tracking
  function registerCard(key: string, el: HTMLElement | null) {
    if (el) {
      cardRefs.set(key, el)
    } else {
      cardRefs.delete(key)
    }
  }

  // Register a container element (for empty column targets)
  function registerContainer(key: string, el: HTMLElement | null) {
    if (el) {
      containerRefs.set(key, el)
    } else {
      containerRefs.delete(key)
    }
  }

  // Get card position by key
  function getCardPosition(key: string): CardPosition | null {
    const el = cardRefs.get(key)
    if (!el) return null
    
    const rect = el.getBoundingClientRect()
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    }
  }

  // Get container position (for empty targets)
  function getContainerPosition(key: string): CardPosition | null {
    const el = containerRefs.get(key)
    if (!el) return null
    
    const rect = el.getBoundingClientRect()
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    }
  }

  // Animate card(s) from source to destination
  async function animateMove(
    cards: KlondikeCard[],
    sourceKey: string,
    destKey: string,
    onComplete: () => void
  ): Promise<void> {
    // Get source position
    const sourcePos = getCardPosition(sourceKey) || getContainerPosition(sourceKey)
    if (!sourcePos) {
      // No position found, just execute immediately
      onComplete()
      return
    }

    // Get destination position (might be a container if empty)
    const destPos = getCardPosition(destKey) || getContainerPosition(destKey)
    if (!destPos) {
      onComplete()
      return
    }

    isAnimating.value = true

    // Create flying cards for each card in the stack
    const newFlyingCards: FlyingCard[] = cards.map((card, index) => ({
      id: `flying-${card.id}`,
      card,
      startX: sourcePos.x,
      startY: sourcePos.y + (index * 25), // Offset for stacked cards
      endX: destPos.x,
      endY: destPos.y + (index * 25),
      width: sourcePos.width,
      height: sourcePos.height,
    }))

    flyingCards.value = newFlyingCards

    // Wait for animation to complete (CSS handles the actual animation)
    await new Promise(resolve => setTimeout(resolve, 300))

    // Clear flying cards and execute the state update
    flyingCards.value = []
    isAnimating.value = false
    onComplete()
  }

  // Simple animate without tracking (for quick moves)
  async function animateQuick(duration = 200): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, duration))
  }

  return {
    flyingCards,
    isAnimating,
    registerCard,
    registerContainer,
    getCardPosition,
    getContainerPosition,
    animateMove,
    animateQuick,
  }
}

// Create a singleton instance for the Klondike game
let instance: ReturnType<typeof useKlondikeAnimation> | null = null

export function getKlondikeAnimation() {
  if (!instance) {
    instance = useKlondikeAnimation()
  }
  return instance
}

// Reset the singleton (for new games)
export function resetKlondikeAnimation() {
  instance = null
}
