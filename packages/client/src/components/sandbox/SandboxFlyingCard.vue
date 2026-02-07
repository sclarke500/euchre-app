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
  cardsInHand: number // Total cards in this player's hand (for fan calculation)
  deckPosition?: { x: number; y: number }  // Where the deck is
  onComplete: () => void
  onFormingComplete?: () => void
}>()

const stage = ref<'start' | 'flying' | 'landed' | 'forming'>('start')

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

// Hand positions - where fanned hands are displayed  
const handCoords: Record<TablePosition, { x: number; y: number; rotate: number; fanDir: 'x' | 'y' }> = {
  'bottom': { x: 50, y: 85, rotate: 0, fanDir: 'x' },
  'top': { x: 50, y: 15, rotate: 180, fanDir: 'x' },
  'left': { x: 15, y: 50, rotate: 90, fanDir: 'y' },
  'right': { x: 85, y: 50, rotate: -90, fanDir: 'y' },
  'top-left': { x: 25, y: 15, rotate: 180, fanDir: 'x' },
  'top-right': { x: 75, y: 15, rotate: 180, fanDir: 'x' },
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
    const stackOffset = props.stackIndex * 0.5  // Slight vertical stacking
    // Keep high z-index while flying (above remaining deck), lower when landed
    const flyingZIndex = stage.value === 'flying' 
      ? 3000 + (props.totalCards - props.dealOrder)  // Stay above deck while flying
      : 1000 + props.stackIndex  // Stack order at destination
    return {
      left: `calc(${target.x}% + ${randomOffset.x}px)`,
      top: `calc(${target.y}% + ${randomOffset.y - stackOffset}px)`,
      transform: `translate(-50%, -50%) rotate(${target.rotate + randomOffset.rotate}deg)`,
      opacity: 1,
      transition: 'all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      zIndex: flyingZIndex,
    }
  }
  
  if (stage.value === 'forming') {
    // Animate to fanned hand position
    const hand = handCoords[props.targetPosition]
    const overlap = 20  // pixels between cards in fan
    const fanOffset = props.stackIndex * overlap
    // Center the fan around the hand position
    const totalWidth = (props.cardsInHand - 1) * overlap
    const centerOffset = -totalWidth / 2
    
    const fanX = hand.fanDir === 'x' ? fanOffset + centerOffset : 0
    const fanY = hand.fanDir === 'y' ? fanOffset + centerOffset : 0
    
    return {
      left: `calc(${hand.x}% + ${fanX}px)`,
      top: `calc(${hand.y}% + ${fanY}px)`,
      transform: `translate(-50%, -50%) rotate(${hand.rotate}deg)`,
      opacity: 1,
      transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      zIndex: 500 + props.stackIndex,
    }
  }
  
  return { opacity: 0 }
})

// Expose function to trigger forming animation
function startForming() {
  stage.value = 'forming'
  setTimeout(() => {
    props.onFormingComplete?.()
  }, 450)
}

defineExpose({ startForming })

onMounted(() => {
  // Start animation after delay
  setTimeout(() => {
    stage.value = 'flying'
    setTimeout(() => {
      stage.value = 'landed'
      props.onComplete()
    }, 400)
  }, props.delay)
})
</script>

<style scoped>
.flying-card {
  position: absolute;
  pointer-events: none;
}
</style>
