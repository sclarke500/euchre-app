<template>
  <div
    :class="['card', { selectable, disabled: !selectable }]"
    @click="handleClick"
  >
    <div class="card-content">
      <div :class="['card-corner', 'top-left', suitColorClass]">
        <div class="rank">{{ displayRank }}</div>
        <div class="suit">{{ suitSymbol }}</div>
      </div>
      <div :class="['card-center', suitColorClass]">
        <div class="suit-large">{{ suitSymbol }}</div>
      </div>
      <div :class="['card-corner', 'bottom-right', suitColorClass]">
        <div class="rank">{{ displayRank }}</div>
        <div class="suit">{{ suitSymbol }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '@/models/types'
import { Suit } from '@/models/types'

interface Props {
  card: Card
  selectable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectable: false,
})

const emit = defineEmits<{
  click: []
}>()

const suitSymbol = computed(() => {
  switch (props.card.suit) {
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
  return props.card.suit === Suit.Hearts || props.card.suit === Suit.Diamonds
    ? 'red'
    : 'black'
})

const displayRank = computed(() => {
  return props.card.rank
})

function handleClick() {
  if (props.selectable) {
    emit('click')
  }
}
</script>

<style scoped lang="scss">
.card {
  width: $card-width;
  height: $card-height;
  background: $card-background;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  position: relative;
  user-select: none;

  &.selectable {
    cursor: pointer;
  }

  &.disabled {
    cursor: not-allowed;
  }
}

.card-content {
  padding: $spacing-xs;
  height: 100%;
  position: relative;
}

.card-corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-weight: bold;

  &.top-left {
    top: $spacing-xs;
    left: $spacing-xs;
  }

  &.bottom-right {
    bottom: $spacing-xs;
    right: $spacing-xs;
    transform: rotate(180deg);
  }

  .rank {
    font-size: 0.75rem;
    line-height: 1;
  }

  .suit {
    font-size: 0.625rem;
    line-height: 1;
  }

  &.red {
    color: #e74c3c;
  }

  &.black {
    color: #2c3e50;
  }
}

.card-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  .suit-large {
    font-size: 1.5rem;
  }

  &.red {
    color: #e74c3c;
  }

  &.black {
    color: #2c3e50;
  }
}
</style>
