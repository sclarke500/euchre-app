<template>
  <div class="hand" :class="[position, { current: isCurrent }]">
    <div class="hand-cards" :class="orientation">
      <div 
        v-for="(card, index) in cards" 
        :key="card.id"
        class="hand-card"
        :class="{ selectable: isCurrent && card.faceUp }"
        :style="getCardStyle(index)"
        @click="handleClick(card.id)"
      >
        <SandboxCard :card="card" />
      </div>
    </div>
    <div class="hand-label">{{ positionLabel }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Card, TablePosition } from '@/engine'
import SandboxCard from './SandboxCard.vue'

const props = defineProps<{
  cards: Card[]
  position: TablePosition
  isCurrent?: boolean
}>()

const emit = defineEmits<{
  cardClick: [cardId: string]
}>()

const orientation = computed(() => {
  if (props.position === 'left' || props.position === 'right') {
    return 'vertical'
  }
  return 'horizontal'
})

const positionLabel = computed(() => {
  const labels: Record<TablePosition, string> = {
    'bottom': 'You',
    'top': 'Opponent',
    'left': 'Left',
    'right': 'Right',
    'top-left': 'Top Left',
    'top-right': 'Top Right'
  }
  return labels[props.position]
})

function getCardStyle(index: number) {
  const overlap = props.isCurrent ? 30 : 20
  
  if (orientation.value === 'vertical') {
    return {
      transform: `translateY(${index * overlap}px)`,
      zIndex: index
    }
  }
  
  return {
    transform: `translateX(${index * overlap}px)`,
    zIndex: index
  }
}

function handleClick(cardId: string) {
  if (props.isCurrent) {
    emit('cardClick', cardId)
  }
}
</script>

<style scoped lang="scss">
.hand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.hand-cards {
  display: flex;
  position: relative;
  
  &.horizontal {
    flex-direction: row;
  }
  
  &.vertical {
    flex-direction: column;
  }
}

.hand-card {
  position: absolute;
  transition: transform 0.3s ease, box-shadow 0.2s ease;
  
  &:first-child {
    position: relative;
  }
  
  &.selectable {
    cursor: pointer;
    
    &:hover {
      transform: translateY(-10px) !important;
      z-index: 100 !important;
    }
  }
}

.hand-label {
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
}

// Position-specific adjustments
.hand.left, .hand.right {
  .hand-cards {
    transform: rotate(0deg); // Could rotate for side players
  }
}

.hand.current {
  .hand-cards {
    // Larger cards for current player
    --card-scale: 1.2;
  }
}
</style>
