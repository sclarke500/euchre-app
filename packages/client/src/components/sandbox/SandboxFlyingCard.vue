<template>
  <div 
    class="flying-card"
    :class="{ 'face-down': !showFaceUp }"
    :style="cardStyle"
  >
    <SandboxCard :card="displayCard" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Card, TablePosition } from '@/engine'
import SandboxCard from './SandboxCard.vue'

const props = defineProps<{
  card: Card
  targetPosition: TablePosition
  delay: number
  stackIndex: number  // Which card in the stack (for offset)
  dealOrder: number   // Order this card is dealt (0 = first, used for z-index)
  totalCards: number  // Total cards being dealt (for z-index calculation)
  deckPosition?: { x: number; y: number }  // Where the deck is
  onComplete: () => void
}>()

const stage = ref<'start' | 'flying' | 'landed'>('start')

// Random offset for this card (consistent per card)
const randomOffset = {
  x: (Math.random() - 0.5) * 12,  // ±6px
  y: (Math.random() - 0.5) * 8,   // ±4px
  rotate: (Math.random() - 0.5) * 8,  // ±4 degrees
}

// Stack positions - where dealt cards pile up (slightly closer to center than hands)
const stackCoords: Record<TablePosition, { x: number; y: number; rotate: number }> = {
  'bottom': { x: 50, y: 75, rotate: 0 },
  'top': { x: 50, y: 25, rotate: 180 },
  'left': { x: 25, y: 50, rotate: 90 },
  'right': { x: 75, y: 50, rotate: -90 },
  'top-left': { x: 30, y: 25, rotate: 160 },
  'top-right': { x: 70, y: 25, rotate: -160 },
}

// Deck is at center
const deckPos = computed(() => props.deckPosition ?? { x: 50, y: 50 })

// Show card face-up only for bottom player after landing
const showFaceUp = computed(() => 
  props.targetPosition === 'bottom' && stage.value === 'landed'
)

// Display card with faceUp based on animation stage
const displayCard = computed(() => ({
  ...props.card,
  faceUp: showFaceUp.value,
}))

const cardStyle = computed(() => {
  const target = stackCoords[props.targetPosition]
  
  if (stage.value === 'start') {
    // Start at deck position - FIRST card dealt should be on TOP (highest z-index)
    const startingZIndex = 2000 + (props.totalCards - props.dealOrder)
    // Stack offset: first card (dealOrder=0) at top (offset=0), later cards pushed down
    const stackOffset = props.dealOrder * 0.5
    return {
      left: `${deckPos.value.x}%`,
      top: `calc(${deckPos.value.y}% + ${stackOffset}px)`,
      transform: 'translate(-50%, -50%) rotate(0deg)',
      opacity: 1,
      transition: 'none',
      zIndex: startingZIndex,
    }
  }
  
  if (stage.value === 'flying' || stage.value === 'landed') {
    // Stack position with random offset for natural look
    // At destination, later cards in stack go on top
    const stackOffset = props.stackIndex * 0.5  // Slight vertical stacking
    return {
      left: `calc(${target.x}% + ${randomOffset.x}px)`,
      top: `calc(${target.y}% + ${randomOffset.y - stackOffset}px)`,
      transform: `translate(-50%, -50%) rotate(${target.rotate + randomOffset.rotate}deg)`,
      opacity: 1,
      transition: 'all 2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',  // 2s flight
      zIndex: 1000 + props.stackIndex,
    }
  }
  
  return { opacity: 0 }
})

onMounted(() => {
  // Start animation after delay
  setTimeout(() => {
    stage.value = 'flying'
    setTimeout(() => {
      stage.value = 'landed'
      props.onComplete()
    }, 2100)
  }, props.delay)
})
</script>

<style scoped>
.flying-card {
  position: absolute;
  pointer-events: none;
}
</style>
