/**
 * Klondike card engine - single deck of cards with absolute positioning
 * Uses the same approach as multiplayer games for smooth animations
 */

import { ref, computed, shallowRef, type Ref, type ComputedRef, type ShallowRef } from 'vue'
import type { KlondikeCard } from '@67cards/shared'
import { Suit } from '@67cards/shared'
import { CardTimings } from '@/utils/animationTimings'

export interface CardPosition {
  x: number
  y: number
  rotation: number
  zIndex: number
  scale: number
  flipY: number  // 0 = face down, 180 = face up
}

export interface ManagedKlondikeCard {
  card: KlondikeCard
  position: CardPosition
  container: string  // 'stock' | 'waste' | 'foundation-0' | 'tableau-0' | etc
}

export interface BoardCardRef {
  moveTo: (target: Partial<CardPosition>, duration?: number) => Promise<void>
  setPosition: (pos: CardPosition) => void
  getPosition: () => CardPosition
}

export interface KlondikeLayout {
  cardWidth: number
  cardHeight: number
  stock: { x: number; y: number }
  waste: { x: number; y: number }
  foundations: { x: number; y: number }[]
  tableau: { x: number; y: number }[]
  faceDownOffset: number  // vertical offset for face-down cards
  faceUpOffset: number    // vertical offset for face-up cards
}

export interface KlondikeEngineConfig {
  animationDuration?: number
}

export function useKlondikeEngine(config: KlondikeEngineConfig = {}) {
  const animationDuration = config.animationDuration ?? CardTimings.collapse

  // All cards in the game
  const cards = shallowRef<ManagedKlondikeCard[]>([])
  
  // Card ref management
  const cardRefs = new Map<string, BoardCardRef>()
  
  // Layout configuration
  const layout = ref<KlondikeLayout | null>(null)
  
  // Reactivity trigger
  const cardsTrigger = ref(0)
  
  function refreshCards() {
    cardsTrigger.value++
  }

  // Computed list for rendering
  const allCards = computed(() => {
    cardsTrigger.value
    return cards.value
  })

  function setCardRef(cardId: string, el: any) {
    if (!el) {
      cardRefs.delete(cardId)
      return
    }
    cardRefs.set(cardId, el as BoardCardRef)
  }

  function getCardRef(cardId: string): BoardCardRef | undefined {
    return cardRefs.get(cardId)
  }

  // Initialize layout based on board dimensions
  function setupLayout(boardWidth: number, boardHeight: number, cardWidth: number, cardHeight: number) {
    const padding = 10
    const gap = 8
    
    // Calculate positions
    // Top row: 4 foundations on left, gap, stock + waste on right
    const topY = padding
    
    // Foundations start from left
    const foundationPositions: { x: number; y: number }[] = []
    for (let i = 0; i < 4; i++) {
      foundationPositions.push({
        x: padding + i * (cardWidth + gap) + cardWidth / 2,
        y: topY + cardHeight / 2,
      })
    }
    
    // Stock and waste on right
    const stockX = boardWidth - padding - cardWidth / 2
    const wasteX = stockX - cardWidth - gap
    
    // Tableau row
    const tableauY = topY + cardHeight + gap * 2
    const tableauPositions: { x: number; y: number }[] = []
    const tableauGap = (boardWidth - padding * 2 - 7 * cardWidth) / 6
    for (let i = 0; i < 7; i++) {
      tableauPositions.push({
        x: padding + i * (cardWidth + tableauGap) + cardWidth / 2,
        y: tableauY + cardHeight / 2,
      })
    }

    layout.value = {
      cardWidth,
      cardHeight,
      stock: { x: stockX, y: topY + cardHeight / 2 },
      waste: { x: wasteX, y: topY + cardHeight / 2 },
      foundations: foundationPositions,
      tableau: tableauPositions,
      faceDownOffset: cardHeight * 0.19,
      faceUpOffset: cardHeight * 0.30,
    }
  }

  // Add a card to the engine
  function addCard(card: KlondikeCard, container: string, position: CardPosition): ManagedKlondikeCard {
    const managed: ManagedKlondikeCard = {
      card,
      position,
      container,
    }
    cards.value = [...cards.value, managed]
    return managed
  }

  // Get cards in a container
  function getCardsInContainer(container: string): ManagedKlondikeCard[] {
    return cards.value.filter(c => c.container === container)
  }

  // Calculate position for a card in a container
  function calculatePosition(
    container: string,
    indexInContainer: number,
    faceUp: boolean,
    containerCards: ManagedKlondikeCard[]
  ): CardPosition {
    if (!layout.value) {
      return { x: 0, y: 0, rotation: 0, zIndex: 100, scale: 1, flipY: 0 }
    }

    const l = layout.value
    const baseScale = 1.0

    if (container === 'stock') {
      return {
        x: l.stock.x,
        y: l.stock.y - indexInContainer * 0.5,
        rotation: 0,
        zIndex: 100 + indexInContainer,
        scale: baseScale,
        flipY: 0,
      }
    }

    if (container === 'waste') {
      // Fan horizontally showing up to 3 cards
      const fanOffset = indexInContainer * 18
      return {
        x: l.waste.x - fanOffset,
        y: l.waste.y,
        rotation: 0,
        zIndex: 100 + indexInContainer,
        scale: baseScale,
        flipY: 180,
      }
    }

    if (container.startsWith('foundation-')) {
      const foundationIndex = parseInt(container.split('-')[1] ?? '0')
      const pos = l.foundations[foundationIndex]
      if (!pos) return { x: 0, y: 0, rotation: 0, zIndex: 100, scale: baseScale, flipY: 180 }
      return {
        x: pos.x,
        y: pos.y,
        rotation: 0,
        zIndex: 100 + indexInContainer,
        scale: baseScale,
        flipY: 180,
      }
    }

    if (container.startsWith('tableau-')) {
      const colIndex = parseInt(container.split('-')[1] ?? '0')
      const pos = l.tableau[colIndex]
      if (!pos) return { x: 0, y: 0, rotation: 0, zIndex: 100, scale: baseScale, flipY: 0 }
      
      // Calculate vertical offset based on cards above
      let yOffset = 0
      for (let i = 0; i < indexInContainer; i++) {
        const cardAbove = containerCards[i]
        const isFaceUp = cardAbove?.card.faceUp ?? false
        yOffset += isFaceUp ? l.faceUpOffset : l.faceDownOffset
      }
      
      return {
        x: pos.x,
        y: pos.y + yOffset,
        rotation: 0,
        zIndex: 100 + indexInContainer,
        scale: baseScale,
        flipY: faceUp ? 180 : 0,
      }
    }

    return { x: 0, y: 0, rotation: 0, zIndex: 100, scale: baseScale, flipY: 0 }
  }

  // Move a card to a new container with animation
  async function moveCard(
    cardId: string,
    toContainer: string,
    options: { duration?: number; flipTo?: boolean } = {}
  ): Promise<void> {
    const duration = options.duration ?? animationDuration
    
    const managed = cards.value.find(c => c.card.id === cardId)
    if (!managed) return

    const oldContainer = managed.container
    managed.container = toContainer

    // Get updated container cards
    const containerCards = getCardsInContainer(toContainer)
    const newIndex = containerCards.findIndex(c => c.card.id === cardId)
    
    // Calculate new position
    const faceUp = options.flipTo ?? managed.card.faceUp
    const newPos = calculatePosition(toContainer, newIndex, faceUp, containerCards)

    // Animate
    const ref = cardRefs.get(cardId)
    if (ref) {
      await ref.moveTo(newPos, duration)
    }

    // Update stored position
    managed.position = newPos
    refreshCards()
  }

  // Move multiple cards (for tableau stacks)
  async function moveCards(
    cardIds: string[],
    toContainer: string,
    options: { duration?: number } = {}
  ): Promise<void> {
    const duration = options.duration ?? animationDuration
    
    // Update all containers first
    for (const cardId of cardIds) {
      const managed = cards.value.find(c => c.card.id === cardId)
      if (managed) {
        managed.container = toContainer
      }
    }

    // Get updated container cards
    const containerCards = getCardsInContainer(toContainer)

    // Animate all cards
    const promises = cardIds.map(async (cardId) => {
      const managed = cards.value.find(c => c.card.id === cardId)
      if (!managed) return

      const newIndex = containerCards.findIndex(c => c.card.id === cardId)
      const newPos = calculatePosition(toContainer, newIndex, managed.card.faceUp, containerCards)

      const ref = cardRefs.get(cardId)
      if (ref) {
        await ref.moveTo(newPos, duration)
      }
      managed.position = newPos
    })

    await Promise.all(promises)
    refreshCards()
  }

  // Flip a card
  async function flipCard(cardId: string, faceUp: boolean, duration: number = 200): Promise<void> {
    const managed = cards.value.find(c => c.card.id === cardId)
    if (!managed) return

    managed.card.faceUp = faceUp
    managed.position.flipY = faceUp ? 180 : 0

    const ref = cardRefs.get(cardId)
    if (ref) {
      await ref.moveTo({ flipY: faceUp ? 180 : 0 }, duration)
    }
    refreshCards()
  }

  // Reposition all cards in a container (e.g., after removing a card)
  async function repositionContainer(container: string, duration: number = 200): Promise<void> {
    const containerCards = getCardsInContainer(container)
    
    const promises = containerCards.map(async (managed, index) => {
      const newPos = calculatePosition(container, index, managed.card.faceUp, containerCards)
      const ref = cardRefs.get(managed.card.id)
      if (ref) {
        await ref.moveTo(newPos, duration)
      }
      managed.position = newPos
    })

    await Promise.all(promises)
    refreshCards()
  }

  // Initialize all cards from game state
  function initializeFromState(
    stockCards: KlondikeCard[],
    wasteCards: KlondikeCard[],
    foundationCards: KlondikeCard[][],
    tableauCards: KlondikeCard[][]
  ) {
    if (!layout.value) return

    const newCards: ManagedKlondikeCard[] = []

    // Stock
    stockCards.forEach((card, i) => {
      const pos = calculatePosition('stock', i, false, [])
      newCards.push({ card, position: pos, container: 'stock' })
    })

    // Waste
    wasteCards.forEach((card, i) => {
      const pos = calculatePosition('waste', i, true, [])
      newCards.push({ card, position: pos, container: 'waste' })
    })

    // Foundations
    foundationCards.forEach((pile, foundationIndex) => {
      pile.forEach((card, i) => {
        const container = `foundation-${foundationIndex}`
        const pos = calculatePosition(container, i, true, [])
        newCards.push({ card, position: pos, container })
      })
    })

    // Tableau
    tableauCards.forEach((column, colIndex) => {
      const container = `tableau-${colIndex}`
      // Need to calculate positions with proper offsets
      const columnManaged: ManagedKlondikeCard[] = []
      column.forEach((card, i) => {
        const managed: ManagedKlondikeCard = {
          card,
          position: { x: 0, y: 0, rotation: 0, zIndex: 0, scale: 1, flipY: 0 },
          container,
        }
        columnManaged.push(managed)
      })
      // Now calculate positions with full column context
      columnManaged.forEach((managed, i) => {
        managed.position = calculatePosition(container, i, managed.card.faceUp, columnManaged)
      })
      newCards.push(...columnManaged)
    })

    cards.value = newCards
    refreshCards()
  }

  // Clear all cards
  function reset() {
    cards.value = []
    cardRefs.clear()
    refreshCards()
  }

  return {
    // State
    allCards,
    layout,

    // Setup
    setupLayout,
    initializeFromState,

    // Card management
    setCardRef,
    getCardRef,
    addCard,
    getCardsInContainer,

    // Operations
    moveCard,
    moveCards,
    flipCard,
    repositionContainer,

    // Utilities
    refreshCards,
    reset,
  }
}

export type KlondikeEngine = ReturnType<typeof useKlondikeEngine>
