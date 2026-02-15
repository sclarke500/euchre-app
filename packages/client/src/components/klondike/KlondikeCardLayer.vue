<script setup lang="ts">
import { ref, watch } from 'vue'
import type { CardPosition } from '@/composables/useKlondikeLayout'
import { Suit, type Selection } from '@euchre/shared'

const props = defineProps<{
  positions: CardPosition[]
  selection: Selection | null
  cardWidth: number
  cardHeight: number
}>()

const emit = defineEmits<{
  cardClick: [cardId: string]
}>()

// Track cards that are currently flipping (for animation)
const flippingCards = ref<Set<string>>(new Set())

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

// Determine if a card is selected (for tableau, all cards from selection index and below)
function isSelected(cardId: string): boolean {
  if (!props.selection) return false
  
  // Find the card in positions to check if it's part of selection
  // This is simplified - actual selection logic depends on position in tableau
  // For now, just check if this specific card matches selection criteria
  return false // Will be enhanced when we wire up selection
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

function handleCardClick(cardId: string) {
  emit('cardClick', cardId)
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
        'selected': isSelected(pos.id),
        'flipping': isFlipping(pos.id)
      }"
      :style="{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        zIndex: pos.z,
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
        '--card-width': `${cardWidth}px`,
        '--card-height': `${cardHeight}px`,
      }"
      @click="handleCardClick(pos.id)"
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
  
  &.face-up {
    background: white;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }
  
  &.face-down {
    background: linear-gradient(135deg, #2c5282 0%, #1a365d 100%);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }
  
  &.selected {
    box-shadow: 0 0 0 3px #f1c40f, 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  &.flipping {
    animation: card-flip 0.3s ease-out;
    z-index: 1000 !important; // Bring to front during flip
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
