import { ref, computed, type Ref } from 'vue'
import type { KlondikeState, KlondikeCard } from '@67cards/shared'

export interface ContainerRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CardPosition {
  id: string
  x: number
  y: number
  z: number
  faceUp: boolean
  card: KlondikeCard
}

// Stacking offsets as ratio of card height
const FACE_DOWN_OFFSET = 0.18
const FACE_UP_OFFSET = 0.28
const WASTE_FAN_OFFSET = 0.22 // Horizontal offset for waste fan

export function useKlondikeLayout() {
  // Container positions (set by the board component)
  const containers = ref<{
    stock: ContainerRect | null
    waste: ContainerRect | null
    foundations: (ContainerRect | null)[]
    tableau: (ContainerRect | null)[]
  }>({
    stock: null,
    waste: null,
    foundations: [null, null, null, null],
    tableau: [null, null, null, null, null, null, null],
  })

  // Card dimensions
  const cardWidth = ref(60)
  const cardHeight = ref(84)

  // Update a container's position
  function setContainerRect(
    type: 'stock' | 'waste' | 'foundation' | 'tableau',
    index: number | null,
    rect: ContainerRect | null
  ) {
    if (type === 'stock') {
      containers.value.stock = rect
    } else if (type === 'waste') {
      containers.value.waste = rect
    } else if (type === 'foundation' && index !== null) {
      containers.value.foundations[index] = rect
    } else if (type === 'tableau' && index !== null) {
      containers.value.tableau[index] = rect
    }
  }

  // Set card dimensions
  function setCardSize(width: number, height: number) {
    cardWidth.value = width
    cardHeight.value = height
  }

  // Calculate all card positions from game state
  function calculatePositions(state: KlondikeState, options?: { dealAnimation?: boolean }): CardPosition[] {
    const positions: CardPosition[] = []
    let zIndex = 1

    // Stock cards - NOT rendered in card layer
    // The stock slot shows a card back if there are cards
    // This keeps the card layer clickable

    // Waste cards (fanned horizontally, face up, RIGHT-ALIGNED)
    const wasteRect = containers.value.waste
    if (wasteRect) {
      // Only show up to drawCount cards fanned
      const visibleCount = Math.min(state.drawCount, state.waste.length)
      const startIdx = Math.max(0, state.waste.length - visibleCount)
      
      // Calculate the width of the fanned cards
      const fanOffset = cardWidth.value * WASTE_FAN_OFFSET
      const totalFanWidth = (visibleCount - 1) * fanOffset + cardWidth.value
      
      // Right-align: start from right edge of waste slot minus total width
      const rightEdge = wasteRect.x + wasteRect.width
      const baseX = rightEdge - totalFanWidth
      
      state.waste.forEach((card, i) => {
        const fanIndex = i >= startIdx ? i - startIdx : 0
        const isFanned = i >= startIdx
        
        // Cards not in the visible fan are stacked at the leftmost position (hidden behind)
        const x = isFanned 
          ? baseX + fanIndex * fanOffset
          : baseX
          
        positions.push({
          id: card.id,
          x,
          y: wasteRect.y,
          z: zIndex++,
          faceUp: true,
          card,
        })
      })
    }

    // Foundation cards (stacked, all face up)
    state.foundations.forEach((foundation, foundationIdx) => {
      const rect = containers.value.foundations[foundationIdx]
      if (rect) {
        foundation.cards.forEach((card, i) => {
          positions.push({
            id: card.id,
            x: rect.x,
            y: rect.y,
            z: zIndex++,
            faceUp: true,
            card,
          })
        })
      }
    })

    // Tableau cards (cascaded vertically)
    state.tableau.forEach((column, colIdx) => {
      const rect = containers.value.tableau[colIdx]
      if (rect) {
        let yOffset = 0
        column.cards.forEach((card, i) => {
          positions.push({
            id: card.id,
            x: rect.x,
            y: rect.y + yOffset,
            z: zIndex++,
            faceUp: card.faceUp,
            card,
          })
          // Next card offset depends on whether this card is face up
          yOffset += cardHeight.value * (card.faceUp ? FACE_UP_OFFSET : FACE_DOWN_OFFSET)
        })
      }
    })

    return positions
  }

  return {
    containers,
    cardWidth,
    cardHeight,
    setContainerRect,
    setCardSize,
    calculatePositions,
  }
}
