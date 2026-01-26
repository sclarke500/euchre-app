<template>
  <div class="trump-indicator">
    <div class="label">Trump:</div>
    <div :class="['suit', suitColorClass]">{{ suitSymbol }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Suit } from '@euchre/shared'

interface Props {
  suit: Suit
}

const props = defineProps<Props>()

const suitSymbol = computed(() => {
  switch (props.suit) {
    case Suit.Hearts:
      return '♥'
    case Suit.Diamonds:
      return '♦'
    case Suit.Clubs:
      return '♣'
    case Suit.Spades:
      return '♠'
    default:
      return ''
  }
})

const suitColorClass = computed(() => {
  return props.suit === Suit.Hearts || props.suit === Suit.Diamonds ? 'red' : 'black'
})
</script>

<style scoped lang="scss">
.trump-indicator {
  position: absolute;
  top: $spacing-lg;
  left: $spacing-lg;
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  background: rgba(255, 255, 255, 0.95);
  padding: $spacing-sm $spacing-md;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  font-weight: bold;

  .label {
    font-size: 1rem;
    color: #2c3e50;
  }

  .suit {
    font-size: 1.5rem;

    &.red {
      color: #e74c3c;
    }

    &.black {
      color: #2c3e50;
    }
  }
}
</style>
