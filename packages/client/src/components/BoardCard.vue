<template>
  <div 
    class="board-card"
    :class="{ 'arc-fan': useArcFan, 'dimmed': dimmed, 'selected': selected, 'highlighted': highlighted }"
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
        <div class="card-back-pattern">
          <div class="pattern"></div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CardPosition, EngineCard } from './cardContainers'

const props = defineProps<{
  card: EngineCard
  faceUp: boolean
  initialPosition?: CardPosition
  dimmed?: boolean
  selected?: boolean
  highlighted?: boolean
}>()

const position = ref<CardPosition>(props.initialPosition ?? {
  x: 0,
  y: 0,
  rotation: 0,
  zIndex: 1,
  scale: 1,
  flipY: 0,
})

const isAnimating = ref(false)
const animationDuration = ref(350)

const cardStyle = computed(() => {
  const scale = position.value.scale ?? 1.0
  const flipY = position.value.flipY ?? 0
  // flipY controls scaleX: 0=full, 90=flat, 180=full (flipped content shown via showFaceUp)
  const flipProgress = Math.abs(Math.cos(flipY * Math.PI / 180))
  const dur = `${animationDuration.value}ms`
  const ease = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  return {
    left: `${position.value.x}px`,
    top: `${position.value.y}px`,
    transform: `translate(-50%, -50%) rotate(${position.value.rotation}deg) scale(${scale * flipProgress}, ${scale})`,
    zIndex: position.value.zIndex,
    // Transition left/top/transform only — z-index must apply instantly
    // so cards moving to the pile render above existing pile cards immediately
    transition: isAnimating.value
      ? `left ${dur} ${ease}, top ${dur} ${ease}, transform ${dur} ${ease}`
      : 'none',
  }
})

// When flipY is between 90-270, show the opposite face
// Cards with no suit/rank (e.g. kitty dummies) are always face-down
const showFaceUp = computed(() => {
  if (!props.card.suit && !props.card.rank) return false
  const flipY = position.value.flipY ?? 0
  const normalizedFlip = ((flipY % 360) + 360) % 360
  const isFlipped = normalizedFlip > 90 && normalizedFlip < 270
  return isFlipped ? !props.faceUp : props.faceUp
})

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

function setPosition(pos: CardPosition) {
  isAnimating.value = false
  position.value = { ...pos }
}

function getPosition(): CardPosition {
  return { ...position.value }
}

const useArcFan = ref(false)
function setArcFan(enabled: boolean) {
  useArcFan.value = enabled
}

defineExpose({
  moveTo,
  setPosition,
  getPosition,
  setArcFan,
})
</script>

<style scoped lang="scss">
.board-card {
  position: absolute;
  pointer-events: auto;
  cursor: default;
  
  // Fan arc origin - only applied when card has .arc-fan class
  // Pivot point far below card creates arc spread when rotated
  &.arc-fan {
    transform-origin: center 500%;
  }

  &.dimmed {
    filter: brightness(0.5) saturate(0.4);
  }

  &.selected {
    margin-top: -12px;
    filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.6));
    transition: margin-top var(--anim-fast) ease, filter var(--anim-fast) ease;
  }

  &.highlighted {
    filter: drop-shadow(0 0 8px rgba(0, 200, 150, 0.7)) drop-shadow(0 0 16px rgba(0, 200, 150, 0.3));
    transition: filter var(--anim-medium) ease;
  }

  &:not(.selected):not(.highlighted) {
    transition: margin-top var(--anim-fast) ease;
  }
}

.card-inner {
  // Dynamic card size based on viewport (base size, scaled via transform)
  width: min(49px, 5.6vw);
  height: min(70px, 8vw);
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  position: relative;
  user-select: none;

  &.face-down {
    background: #e8e4df;
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
    font-size: 15px;
  }

  .suit {
    font-size: 13px;
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
    font-size: 26px;
  }

  &.red { color: #e74c3c; }
  &.black { color: #2c3e50; }
  &.joker { color: #9b59b6; }
}

.card-back-pattern {
  width: 100%;
  height: 100%;
  padding: 3px;
  box-sizing: border-box;

  .pattern {
    width: 100%;
    height: 100%;
    background:
      repeating-linear-gradient(
        45deg,
        rgba(255, 255, 255, 0.15) 0px,
        rgba(255, 255, 255, 0.15) 1px,
        transparent 1px,
        transparent 5px
      ),
      repeating-linear-gradient(
        -45deg,
        rgba(255, 255, 255, 0.15) 0px,
        rgba(255, 255, 255, 0.15) 1px,
        transparent 1px,
        transparent 5px
      ),
      linear-gradient(135deg, #8b3a4a 0%, #6b2838 100%);
    border-radius: 2px;
  }
}
</style>
