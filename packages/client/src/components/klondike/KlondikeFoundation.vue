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
    <!-- Top card -->
    <Card v-else :card="topCard" />
  </div>
</template>

<style scoped lang="scss">
.foundation {
  width: $card-width;
  height: $card-height;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px dashed rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.foundation-placeholder {
  font-size: 2.5rem;
  color: rgba(255, 255, 255, 0.3);

  &.red {
    color: rgba(231, 76, 60, 0.4);
  }
}
</style>
