<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { CardPosition } from './useKlondikeLayout'
import { Suit, type Selection } from '@euchre/shared'

const props = defineProps<{
  positions: CardPosition[]
  selection: Selection | null
  cardWidth: number
  cardHeight: number
  dragCardIds?: string[]
  dragOffsetX?: number
  dragOffsetY?: number
  animatingCardIds?: Set<string>
  highlightedZones?: { type: 'tableau' | 'foundation'; index: number; isValid: boolean }[]
}>()

const emit = defineEmits<{
  cardClick: [cardId: string]
  dragStart: [cardId: string, x: number, y: number, sourceType: 'tableau' | 'waste' | 'foundation', columnIndex?: number, cardIndex?: number]
  dragMove: [x: number, y: number]
  dragEnd: []
}>()

// Track cards that are currently flipping (for animation)
const flippingCards = ref<Set<string>>(new Set())

// Track if we're in a drag operation
const isDragging = ref(false)
const dragStartPos = ref<{ x: number; y: number } | null>(null)

// Watch for face-up changes to trigger flip animation
watch(
  () => props.positions.map(p => ({ id: p.id, faceUp: p.faceUp })),
  (newVals, oldVals) => {
    if (!oldVals) return
    
    const oldMap = new Map(oldVals.map(v => [v.id, v.faceUp]))
    for (const { id, faceUp } of newVals) {
      const wasFaceUp = oldMap.get(id)
      // Detect flip from face-down to face-up
      if (wasFaceUp === false && faceUp === true) {
        flippingCards.value.add(id)
        // Remove after animation completes
        setTimeout(() => {
          flippingCards.value.delete(id)
        }, 300)
      }
    }
  },
  { deep: true }
)

function isFlipping(cardId: string): boolean {
  return flippingCards.value.has(cardId)
}

function isBeingDragged(cardId: string): boolean {
  return props.dragCardIds?.includes(cardId) ?? false
}

// Get suit symbol
function getSuitSymbol(suit: Suit): string {
  switch (suit) {
    case Suit.Spades: return '♠'
    case Suit.Hearts: return '♥'
    case Suit.Diamonds: return '♦'
    case Suit.Clubs: return '♣'
    default: return ''
  }
}

// Check if suit is red
function isRedSuit(suit: Suit): boolean {
  return suit === Suit.Hearts || suit === Suit.Diamonds
}

// Find card source info (for drag start)
function findCardSource(cardId: string): { 
  type: 'tableau' | 'waste' | 'foundation'
  columnIndex?: number
  cardIndex?: number 
} | null {
  const pos = props.positions.find(p => p.id === cardId)
  if (!pos) return null
  
  // Check if it's a valid draggable position based on source
  // The CardPosition should include source info, but we can infer from the position
  // For now, emit and let parent figure it out
  return null
}

// Pointer event handlers
function handlePointerDown(event: PointerEvent, cardId: string, pos: CardPosition) {
  // Only handle left mouse button or touch
  if (event.button !== 0) return
  // Don't drag face-down cards
  if (!pos.faceUp) return
  
  isDragging.value = false
  dragStartPos.value = { x: event.clientX, y: event.clientY }
  
  // Capture pointer for tracking
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent, cardId: string, pos: CardPosition) {
  if (!dragStartPos.value) return
  
  const dx = event.clientX - dragStartPos.value.x
  const dy = event.clientY - dragStartPos.value.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  // Start drag after moving 5px (prevents accidental drags on clicks)
  if (!isDragging.value && distance > 5) {
    isDragging.value = true
    emit('dragStart', cardId, event.clientX, event.clientY, 'tableau')
  }
  
  if (isDragging.value) {
    emit('dragMove', event.clientX, event.clientY)
  }
}

function handlePointerUp(event: PointerEvent, cardId: string) {
  const target = event.currentTarget as HTMLElement
  target.releasePointerCapture(event.pointerId)
  
  if (isDragging.value) {
    emit('dragEnd')
  } else if (dragStartPos.value) {
    // It was a click, not a drag
    emit('cardClick', cardId)
  }
  
  isDragging.value = false
  dragStartPos.value = null
}

function handlePointerCancel(event: PointerEvent) {
  if (isDragging.value) {
    emit('dragEnd')
  }
  isDragging.value = false
  dragStartPos.value = null
}

// Calculate card transform including drag offset
function getCardTransform(pos: CardPosition): string {
  if (isBeingDragged(pos.id) && props.dragOffsetX !== undefined && props.dragOffsetY !== undefined) {
    return `translate(${pos.x + props.dragOffsetX}px, ${pos.y + props.dragOffsetY}px)`
  }
  return `translate(${pos.x}px, ${pos.y}px)`
}

// Get z-index (dragged and animating cards should be on top)
function getCardZIndex(pos: CardPosition): number {
  if (isBeingDragged(pos.id)) {
    return 2000 + pos.z  // Dragged cards highest
  }
  if (props.animatingCardIds?.has(pos.id)) {
    return 1000 + pos.z  // Animating cards elevated
  }
  return pos.z
}
</script>

<template>
  <div class="card-layer">
    <div
      v-for="pos in positions"
      :key="pos.id"
      class="klondike-card"
      :class="{ 
        'face-up': pos.faceUp, 
        'face-down': !pos.faceUp,
        'flipping': isFlipping(pos.id),
        'dragging': isBeingDragged(pos.id)
      }"
      :style="{
        transform: getCardTransform(pos),
        zIndex: getCardZIndex(pos),
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
        '--card-width': `${cardWidth}px`,
        '--card-height': `${cardHeight}px`,
      }"
      @pointerdown="handlePointerDown($event, pos.id, pos)"
      @pointermove="handlePointerMove($event, pos.id, pos)"
      @pointerup="handlePointerUp($event, pos.id)"
      @pointercancel="handlePointerCancel"
    >
      <!-- Face up card -->
      <template v-if="pos.faceUp">
        <div class="card-corner top-left" :class="{ red: isRedSuit(pos.card.suit) }">
          <div class="rank">{{ pos.card.rank }}</div>
          <div class="suit">{{ getSuitSymbol(pos.card.suit) }}</div>
        </div>
        <div class="card-center" :class="{ red: isRedSuit(pos.card.suit) }">
          {{ getSuitSymbol(pos.card.suit) }}
        </div>
        <div class="card-corner bottom-right" :class="{ red: isRedSuit(pos.card.suit) }">
          <div class="rank">{{ pos.card.rank }}</div>
          <div class="suit">{{ getSuitSymbol(pos.card.suit) }}</div>
        </div>
      </template>
      <!-- Face down card -->
      <template v-else>
        <div class="card-back-pattern"></div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.card-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10; // Above containers layer
}

.klondike-card {
  position: absolute;
  left: 0;
  top: 0;
  // transform, width, height, z-index set via inline style
  border-radius: 6px;
  pointer-events: auto;
  cursor: pointer;
  transition-property: transform;
  transition-duration: 0.3s;
  transition-timing-function: ease-out;
  will-change: transform;
  backface-visibility: hidden; // Force GPU layer
  touch-action: none; // Prevent browser handling of touch for drag
  user-select: none;
  
  &.face-up {
    background: white;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }
  
  &.face-down {
    background: linear-gradient(135deg, #2c5282 0%, #1a365d 100%);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    cursor: default;
  }
  
  &.selected {
    box-shadow: 0 0 0 3px #f1c40f, 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  &.flipping {
    animation: card-flip 0.3s ease-out;
    z-index: 1000 !important; // Bring to front during flip
  }
  
  &.dragging {
    transition: none; // Disable transition during drag
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    cursor: grabbing;
  }
}

// Card flip animation - quick "reveal" effect
@keyframes card-flip {
  0% {
    filter: brightness(0.5);
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
  }
  50% {
    filter: brightness(1.2);
    box-shadow: 0 0 30px rgba(255, 255, 255, 0.8);
  }
  100% {
    filter: brightness(1);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }
}

.card-corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-weight: bold;
  color: #2c3e50;

  &.red {
    color: #e74c3c;
  }

  &.top-left {
    top: 2px;
    left: 4px;
  }

  &.bottom-right {
    bottom: 2px;
    right: 4px;
    transform: rotate(180deg);
  }

  .rank {
    font-size: calc(var(--card-width) * 0.29);
    line-height: 1;
  }

  .suit {
    font-size: calc(var(--card-width) * 0.21);
    line-height: 1;
  }
}

.card-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: calc(var(--card-width) * 0.48);
  color: #2c3e50;

  &.red {
    color: #e74c3c;
  }
}

.card-back-pattern {
  position: absolute;
  top: 6px;
  left: 6px;
  right: 6px;
  bottom: 6px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;

  &::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    right: 3px;
    bottom: 3px;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 4px,
      rgba(255, 255, 255, 0.05) 4px,
      rgba(255, 255, 255, 0.05) 8px
    );
  }
}
</style>
