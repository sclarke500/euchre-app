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
import { ref, computed, watch } from 'vue'

export interface CardPosition {
  x: number      // pixels from left
  y: number      // pixels from top
  rotation: number  // degrees
  zIndex: number
  scale?: number    // 1.0 = normal size
  flipY?: number    // 0-180 degrees for flip animation
  originX?: number  // transform-origin X offset in pixels (from center)
  originY?: number  // transform-origin Y offset in pixels (from center)
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
  const originX = position.value.originX ?? 0
  const originY = position.value.originY ?? 0
  // flipY controls scaleX: 0=full, 90=flat, 180=full (flipped content shown via showFaceUp)
  const flipProgress = Math.abs(Math.cos(flipY * Math.PI / 180))
  // transform-origin: offset from card center (card is 70x100)
  const originStyle = `calc(50% + ${originX}px) calc(50% + ${originY}px)`
  return {
    left: `${position.value.x}px`,
    top: `${position.value.y}px`,
    transform: `translate(-50%, -50%) rotate(${position.value.rotation}deg) scale(${scale * flipProgress}, ${scale})`,
    transformOrigin: originStyle,
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
    const start = { ...position.value }
    const startTime = performance.now()
    
    // If flipY is being animated, use JS animation for smooth flip
    const animateFlip = target.flipY !== undefined && target.flipY !== start.flipY
    
    if (animateFlip) {
      // JS animation for flip (so cos calculation updates each frame)
      const animate = (now: number) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        
        position.value = {
          x: start.x + (target.x - start.x) * eased,
          y: start.y + (target.y - start.y) * eased,
          rotation: start.rotation + (target.rotation - start.rotation) * eased,
          zIndex: target.zIndex,
          scale: (start.scale ?? 1) + ((target.scale ?? 1) - (start.scale ?? 1)) * eased,
          flipY: (start.flipY ?? 0) + ((target.flipY ?? 0) - (start.flipY ?? 0)) * eased,
        }
        
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          resolve()
        }
      }
      requestAnimationFrame(animate)
    } else {
      // CSS transition for non-flip animations
      animationDuration.value = duration
      isAnimating.value = true
      
      requestAnimationFrame(() => {
        // Preserve flipY if not specified in target
        position.value = { 
          ...target,
          flipY: target.flipY ?? position.value.flipY ?? 0,
        }
        
        setTimeout(() => {
          isAnimating.value = false
          resolve()
        }, duration + 50)
      })
    }
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
  // Dynamic card size based on viewport (base size, scaled via transform)
  width: min(49px, 5.6vw);
  height: min(70px, 8vw);
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
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
    top: 3px;
    left: 3px;
  }

  &.bottom-right {
    bottom: 3px;
    right: 3px;
    transform: rotate(180deg);
  }

  .rank {
    font-size: 12px;
  }

  .suit {
    font-size: 10px;
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
    font-size: 22px;
  }

  &.red { color: #e74c3c; }
  &.black { color: #2c3e50; }
  &.joker { color: #9b59b6; }
}

.card-back {
  width: 100%;
  height: 100%;
  padding: 4px;
  box-sizing: border-box;

  .pattern {
    width: 100%;
    height: 100%;
    background: 
      repeating-linear-gradient(
        45deg,
        #2a4a9c 0px,
        #2a4a9c 1px,
        transparent 1px,
        transparent 6px
      ),
      repeating-linear-gradient(
        -45deg,
        #2a4a9c 0px,
        #2a4a9c 1px,
        transparent 1px,
        transparent 6px
      );
    border-radius: 2px;
    border: 1px solid #3a5aac;
  }
}
</style>
