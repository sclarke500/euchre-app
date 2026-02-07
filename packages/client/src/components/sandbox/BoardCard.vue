<template>
  <div 
    class="board-card"
    :style="cardStyle"
  >
    <div class="card-inner" :class="{ 'face-down': !showFaceUp }">
      <template v-if="showFaceUp">
        <div class="corner top-left" :class="colorClass">
          <span class="rank">{{ displayRank }}</span>
          <span class="suit">{{ suitSymbol }}</span>
        </div>
        <div class="center" :class="colorClass">
          <span class="suit-large">{{ card.rank === 'Joker' ? '🃏' : suitSymbol }}</span>
        </div>
        <div class="corner bottom-right" :class="colorClass">
          <span class="rank">{{ displayRank }}</span>
          <span class="suit">{{ suitSymbol }}</span>
        </div>
      </template>
      <template v-else>
        <div class="card-back">
          <div class="pattern"></div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

export interface CardPosition {
  x: number      // pixels from left
  y: number      // pixels from top
  rotation: number  // degrees
  zIndex: number
  scale?: number    // 1.0 = normal size
  flipY?: number    // 0-180 degrees for flip animation
}

interface SandboxCard {
  id: string
  suit: string
  rank: string
}

const props = defineProps<{
  card: SandboxCard
  faceUp: boolean
  initialPosition?: CardPosition
}>()

// Current position state
const position = ref<CardPosition>(props.initialPosition ?? {
  x: 0,
  y: 0,
  rotation: 0,
  zIndex: 1,
  scale: 1,
  flipY: 0,
})

// Animation state
const isAnimating = ref(false)
const animationDuration = ref(350)

// Computed card style
const cardStyle = computed(() => {
  const scale = position.value.scale ?? 1.0
  const flipY = position.value.flipY ?? 0
  // flipY controls scaleX: 0=full, 90=flat, 180=full (flipped content shown via showFaceUp)
  const flipProgress = Math.abs(Math.cos(flipY * Math.PI / 180))
  return {
    left: `${position.value.x}px`,
    top: `${position.value.y}px`,
    transform: `translate(-50%, -50%) rotate(${position.value.rotation}deg) scale(${scale * flipProgress}, ${scale})`,
    zIndex: position.value.zIndex,
    transition: isAnimating.value 
      ? `all ${animationDuration.value}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`
      : 'none',
  }
})

// When flipY is between 90-270, show the opposite face
const showFaceUp = computed(() => {
  const flipY = position.value.flipY ?? 0
  const normalizedFlip = ((flipY % 360) + 360) % 360
  const isFlipped = normalizedFlip > 90 && normalizedFlip < 270
  return isFlipped ? !props.faceUp : props.faceUp
})

// Card display helpers
const suitSymbol = computed(() => {
  const symbols: Record<string, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  }
  return symbols[props.card.suit] || ''
})

const colorClass = computed(() => {
  if (props.card.rank === 'Joker') return 'joker'
  return props.card.suit === 'hearts' || props.card.suit === 'diamonds' ? 'red' : 'black'
})

const displayRank = computed(() => {
  if (props.card.rank === 'Joker') return '★'
  return props.card.rank
})

// Move to a new position with animation
function moveTo(target: CardPosition, duration: number = 350): Promise<void> {
  return new Promise((resolve) => {
    animationDuration.value = duration
    isAnimating.value = true
    
    // Trigger animation on next tick
    requestAnimationFrame(() => {
      position.value = { ...target }
      
      // Resolve after animation completes
      setTimeout(() => {
        isAnimating.value = false
        resolve()
      }, duration + 50)
    })
  })
}

// Set position immediately (no animation)
function setPosition(pos: CardPosition) {
  isAnimating.value = false
  position.value = { ...pos }
}

// Get current position
function getPosition(): CardPosition {
  return { ...position.value }
}

onMounted(() => {
  console.log(`BoardCard MOUNTED: ${props.card.id}`)
})

onUnmounted(() => {
  console.log(`BoardCard UNMOUNTED: ${props.card.id}`)
})

// Expose methods
defineExpose({
  moveTo,
  setPosition,
  getPosition,
})
</script>

<style scoped lang="scss">
.board-card {
  position: absolute;
  pointer-events: auto;
  cursor: default;
}

.card-inner {
  width: 70px;
  height: 100px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  position: relative;
  user-select: none;

  &.face-down {
    background: linear-gradient(135deg, #1a3a7c 0%, #0d1f4d 100%);
  }
}

.corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-weight: bold;
  line-height: 1;

  &.top-left {
    top: 4px;
    left: 5px;
  }

  &.bottom-right {
    bottom: 4px;
    right: 5px;
    transform: rotate(180deg);
  }

  .rank {
    font-size: 18px;
  }

  .suit {
    font-size: 14px;
  }

  &.red { color: #e74c3c; }
  &.black { color: #2c3e50; }
  &.joker { color: #9b59b6; }
}

.center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  .suit-large {
    font-size: 32px;
  }

  &.red { color: #e74c3c; }
  &.black { color: #2c3e50; }
  &.joker { color: #9b59b6; }
}

.card-back {
  width: 100%;
  height: 100%;
  padding: 6px;
  box-sizing: border-box;

  .pattern {
    width: 100%;
    height: 100%;
    background: 
      repeating-linear-gradient(
        45deg,
        #2a4a9c 0px,
        #2a4a9c 2px,
        transparent 2px,
        transparent 8px
      ),
      repeating-linear-gradient(
        -45deg,
        #2a4a9c 0px,
        #2a4a9c 2px,
        transparent 2px,
        transparent 8px
      );
    border-radius: 3px;
    border: 2px solid #3a5aac;
  }
}
</style>
