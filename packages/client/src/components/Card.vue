<template>
  <div
    :class="['card', { selectable, dimmed }]"
    @click="handleClick"
  >
    <div class="card-corner top-left" :class="suitColorClass">
      <div class="rank">{{ displayRank }}</div>
      <div class="suit">{{ suitSymbol }}</div>
    </div>
    <div class="card-corner bottom-right" :class="suitColorClass">
      <div class="rank">{{ displayRank }}</div>
      <div class="suit">{{ suitSymbol }}</div>
    </div>
    <div class="card-center" :class="suitColorClass">
      <div class="suit-large">{{ suitSymbol }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Suit } from '@euchre/shared'

// Generic card interface that works with Euchre, President, and Klondike cards
interface GenericCard {
  suit: Suit
  rank: string
  id: string
}

interface Props {
  card: GenericCard
  selectable?: boolean
  dimmed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectable: false,
  dimmed: false,
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
  // Use CSS custom property with fallback to SCSS variable
  width: var(--klondike-card-width, $card-width);
  height: var(--klondike-card-height, $card-height);
  background: $card-background;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  position: relative;
  user-select: none;
  flex-shrink: 0;

  &.selectable {
    cursor: pointer;
  }

  &.dimmed {
    filter: brightness(0.85);
  }
}

.card-corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-weight: bold;

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
    // Scale font size with card width
    font-size: min(1.5rem, calc(var(--klondike-card-width, $card-width) * 0.21));
    line-height: 1;
  }

  .suit {
    font-size: min(1.1rem, calc(var(--klondike-card-width, $card-width) * 0.15));
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
    // Scale center suit with card width
    font-size: min(2.5rem, calc(var(--klondike-card-width, $card-width) * 0.36));
  }

  &.red {
    color: #e74c3c;
  }

  &.black {
    color: #2c3e50;
  }
}
</style>
