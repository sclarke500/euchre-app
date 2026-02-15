<script setup lang="ts">
import { computed } from 'vue'
import type { FoundationPile } from '@euchre/shared'
import { Suit } from '@euchre/shared'
import Card from '../Card.vue'

const props = defineProps<{
  foundation: FoundationPile
  index: number
}>()

const emit = defineEmits<{
  tap: [index: number]
}>()

// Suit symbol for empty foundation placeholder
const suitSymbols: Record<number, string> = {
  0: '♠',
  1: '♥',
  2: '♦',
  3: '♣',
}

const placeholderSuit = computed(() => suitSymbols[props.index] || '')

const topCard = computed(() => {
  if (props.foundation.cards.length === 0) return null
  return props.foundation.cards[props.foundation.cards.length - 1]
})

function handleTap() {
  emit('tap', props.index)
}
</script>

<template>
  <div class="foundation" @click="handleTap">
    <!-- Empty foundation placeholder -->
    <div v-if="!topCard" class="foundation-placeholder" :class="{ red: index === 1 || index === 2 }">
      {{ placeholderSuit }}
    </div>
    <!-- Top card with enter transition -->
    <Transition v-else name="card-land" appear>
      <Card :key="topCard.id" :card="topCard" />
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.foundation {
  width: var(--card-width, $card-width);
  height: var(--card-height, $card-height);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px dashed rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

// Vue transition classes for card landing animation
.card-land-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.card-land-leave-active {
  transition: all 0.2s ease-in;
  position: absolute;
}

.card-land-enter-from {
  transform: scale(0.6) translateY(-30px);
  opacity: 0;
}

.card-land-leave-to {
  transform: scale(0.8);
  opacity: 0;
}

.foundation-placeholder {
  font-size: 2rem;
  color: rgba(255, 255, 255, 0.3);

  &.red {
    color: rgba(231, 76, 60, 0.4);
  }
}
</style>
