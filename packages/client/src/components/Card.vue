<template>
  <div
    :class="['card', { selectable, dimmed, joker: isJoker }]"
    @click="handleClick"
  >
    <div class="card-corner top-left" :class="suitColorClass">
      <div class="rank">{{ displayRank }}</div>
      <div class="suit" v-if="!isJoker">{{ suitSymbol }}</div>
    </div>
    <div class="card-corner bottom-right" :class="suitColorClass">
      <div class="rank">{{ displayRank }}</div>
      <div class="suit" v-if="!isJoker">{{ suitSymbol }}</div>
    </div>
    <div class="card-center" :class="suitColorClass">
      <div class="suit-large">{{ isJoker ? '🃏' : suitSymbol }}</div>
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

const isJoker = computed(() => {
  return props.card.rank === 'Joker'
})

const suitColorClass = computed(() => {
  if (isJoker.value) return 'joker-color'
  return props.card.suit === Suit.Hearts || props.card.suit === Suit.Diamonds
    ? 'red'
    : 'black'
})

const displayRank = computed(() => {
  if (isJoker.value) return '★'
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
  width: var(--card-width, $card-width);
  height: var(--card-height, $card-height);
  background: $card-background;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  position: relative;
  user-select: none;
  flex-shrink: 0;
  
  // Subtle entrance animation
  animation: card-appear 0.2s ease-out;

  &.selectable {
    cursor: pointer;
  }

  &.dimmed {
    filter: brightness(0.85);
  }
}

@keyframes card-appear {
  from {
    opacity: 0.5;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
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
    // Scale font size proportionally with card width (24px at 83px card = 0.29 ratio)
    font-size: calc(var(--card-width, $card-width) * 0.29);
    line-height: 1;
  }

  .suit {
    // Scale font size proportionally (17.6px at 83px card = 0.21 ratio)
    font-size: calc(var(--card-width, $card-width) * 0.21);
    line-height: 1;
  }

  &.red {
    color: #e74c3c;
  }

  &.black {
    color: #2c3e50;
  }

  &.joker-color {
    color: #9b59b6;
  }
}

.card-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  .suit-large {
    // Scale center suit proportionally (40px at 83px card = 0.48 ratio)
    font-size: calc(var(--card-width, $card-width) * 0.48);
  }

  &.red {
    color: #e74c3c;
  }

  &.black {
    color: #2c3e50;
  }

  &.joker-color {
    color: #9b59b6;
  }
}
</style>
