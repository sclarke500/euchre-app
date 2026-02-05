<template>
  <div class="card" :class="{ 'face-down': !card.faceUp }">
    <template v-if="card.faceUp">
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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '@/engine'

const props = defineProps<{
  card: Card
}>()

const suitSymbol = computed(() => {
  const symbols = {
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
</script>

<style scoped lang="scss">
.card {
  width: 70px;
  height: 100px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
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
    top: 4px;
    left: 5px;
  }

  &.bottom-right {
    bottom: 4px;
    right: 5px;
    transform: rotate(180deg);
  }

  .rank {
    font-size: 18px;
  }

  .suit {
    font-size: 14px;
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
    font-size: 32px;
  }

  &.red { color: #e74c3c; }
  &.black { color: #2c3e50; }
  &.joker { color: #9b59b6; }
}

.card-back {
  width: 100%;
  height: 100%;
  padding: 6px;
  box-sizing: border-box;

  .pattern {
    width: 100%;
    height: 100%;
    background: 
      repeating-linear-gradient(
        45deg,
        #2a4a9c 0px,
        #2a4a9c 2px,
        transparent 2px,
        transparent 8px
      ),
      repeating-linear-gradient(
        -45deg,
        #2a4a9c 0px,
        #2a4a9c 2px,
        transparent 2px,
        transparent 8px
      );
    border-radius: 3px;
    border: 2px solid #3a5aac;
  }
}
</style>
