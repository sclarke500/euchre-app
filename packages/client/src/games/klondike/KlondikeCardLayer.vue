<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { CardPosition } from './useKlondikeLayout'
import { Suit, type Selection } from '@67cards/shared'
import SuitGlyph from '@/components/SuitGlyph.vue'

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

// Track which face to show for flipping cards (delays face swap to midpoint)
const showFaceUpOverride = ref<Map<string, boolean>>(new Map())

// Track if we're in a drag operation
const isDragging = ref(false)
const dragStartPos = ref<{ x: number; y: number } | null>(null)

const FLIP_DURATION = 300 // ms - must match CSS animation

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
        // Keep showing back face until midpoint of animation
        showFaceUpOverride.value.set(id, false)
        
        // At midpoint, switch to showing front face
        setTimeout(() => {
          showFaceUpOverride.value.set(id, true)
        }, FLIP_DURATION / 2)
        
        // After animation completes, clean up
        setTimeout(() => {
          flippingCards.value.delete(id)
          showFaceUpOverride.value.delete(id)
        }, FLIP_DURATION)
      }
    }
  },
  { deep: true }
)

function isFlipping(cardId: string): boolean {
  return flippingCards.value.has(cardId)
}

// Get what face to show - respects flip animation timing
function shouldShowFaceUp(cardId: string, actualFaceUp: boolean): boolean {
  if (showFaceUpOverride.value.has(cardId)) {
    return showFaceUpOverride.value.get(cardId)!
  }
  return actualFaceUp
}

function isBeingDragged(cardId: string): boolean {
  return props.dragCardIds?.includes(cardId) ?? false
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
  // Face-down cards are clickable but not draggable.
  if (!isDragging.value && pos.faceUp && distance > 5) {
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

// Position cards via left/top rather than transform: translate.
// The whole board lives inside ScaledContainer's transform: scale(), which is
// usually > 1. A transform-animated element gets composited to its own GPU texture
// rasterized at the canonical (pre-scale) size, which the ancestor scale then
// bitmap-upscales → visible pixelation while moving. Animating left/top repaints at
// the final (scaled) resolution every frame, so cards stay crisp in motion.
function getCardLeft(pos: CardPosition): number {
  if (isBeingDragged(pos.id) && props.dragOffsetX !== undefined) {
    return pos.x + props.dragOffsetX
  }
  return pos.x
}
function getCardTop(pos: CardPosition): number {
  if (isBeingDragged(pos.id) && props.dragOffsetY !== undefined) {
    return pos.y + props.dragOffsetY
  }
  return pos.y
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
      v-show="!pos.hidden"
      :key="pos.id"
      class="klondike-card-wrapper"
      :class="{ 
        'dragging': isBeingDragged(pos.id)
      }"
      :style="{
        left: `${getCardLeft(pos)}px`,
        top: `${getCardTop(pos)}px`,
        zIndex: getCardZIndex(pos),
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
      }"
      @pointerdown="handlePointerDown($event, pos.id, pos)"
      @pointermove="handlePointerMove($event, pos.id, pos)"
      @pointerup="handlePointerUp($event, pos.id)"
      @pointercancel="handlePointerCancel"
    >
      <div
        class="klondike-card"
        :class="{ 
          'face-up': shouldShowFaceUp(pos.id, pos.faceUp), 
          'face-down': !shouldShowFaceUp(pos.id, pos.faceUp),
          'flipping': isFlipping(pos.id),
        }"
        :style="{
          width: `${cardWidth}px`,
          height: `${cardHeight}px`,
          '--card-width': `${cardWidth}px`,
          '--card-height': `${cardHeight}px`,
        }"
      >
        <!-- Face up card -->
        <template v-if="shouldShowFaceUp(pos.id, pos.faceUp)">
          <div class="card-corner top-left" :class="{ red: isRedSuit(pos.card.suit) }">
            <div class="rank">{{ pos.card.rank }}</div>
            <SuitGlyph :suit="pos.card.suit" class="suit" />
          </div>
          <div class="card-center" :class="{ red: isRedSuit(pos.card.suit) }">
            <SuitGlyph :suit="pos.card.suit" class="center-glyph" />
          </div>
          <div class="card-corner bottom-right" :class="{ red: isRedSuit(pos.card.suit) }">
            <div class="rank">{{ pos.card.rank }}</div>
            <SuitGlyph :suit="pos.card.suit" class="suit" />
          </div>
        </template>
        <!-- Face down card -->
        <template v-else>
          <div class="card-back-pattern"></div>
        </template>
      </div>
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

.klondike-card-wrapper {
  position: absolute;
  // left, top, width, height, z-index set via inline style
  pointer-events: auto;
  cursor: pointer;
  // Animate left/top (not transform) so cards repaint crisply at the final
  // scaled resolution instead of upscaling a cached GPU texture (pixelation).
  transition-property: left, top;
  transition-duration: 0.3s;
  transition-timing-function: ease-out;
  touch-action: none; // Prevent browser handling of touch for drag
  user-select: none;

  &.dragging {
    transition: none; // Disable transition during drag
    cursor: grabbing;
    
    .klondike-card {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }
  }
}

.klondike-card {
  border-radius: 6px;
  // No backface-visibility/will-change here: forcing a GPU layer makes the card
  // rasterize at canonical size and get upscaled by ScaledContainer → pixelation.

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
    animation: card-flip 0.3s ease-in-out;
  }
}

// Card flip animation - horizontal flip using scaleX
@keyframes card-flip {
  0% {
    transform: scaleX(1);
  }
  50% {
    transform: scaleX(0);
  }
  100% {
    transform: scaleX(1);
  }
}

.card-corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  // Left-align so the suit sits at the card edge under the rank's first digit
  // (consistent across single- and two-digit ranks like "10").
  align-items: flex-start;
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
    font-size: calc(var(--card-width) * 0.32);
    line-height: 1;
  }

  .suit {
    width: calc(var(--card-width) * 0.18);
    height: calc(var(--card-width) * 0.18);
  }
}

.card-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #2c3e50;

  &.red {
    color: #e74c3c;
  }

  .center-glyph {
    width: calc(var(--card-width) * 0.40);
    height: calc(var(--card-width) * 0.40);
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
