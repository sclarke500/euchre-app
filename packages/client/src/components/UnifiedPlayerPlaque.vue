<template>
  <div class="user-plaque-wrapper">
    <PlayerPlaque
      :player-name="myPlayer?.name || 'You'"
      :tricks-won="tricksWon"
      :is-dealer="isDealer"
      :trump-symbol="showTrumpIndicator ? trumpSymbol : undefined"
      :trump-color="showTrumpIndicator ? trumpColor : undefined"
      :going-alone="showTrumpIndicator ? trump?.goingAlone : undefined"
    />
    <span v-if="isDiscardPhase" class="status-message discard-prompt">Select a card to discard</span>
    <span v-else-if="isMyTurn" class="status-message">Your Turn</span>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import type { GameAdapter } from '@/composables/useGameAdapter'
import { GamePhase, Suit } from '@euchre/shared'
import PlayerPlaque from './PlayerPlaque.vue'

const game = inject<GameAdapter>('game')!

const myPlayer = computed(() => {
  const myId = game.myPlayerId.value
  return game.players.value.find(p => p.id === myId) ?? null
})

const isMyTurn = computed(() => game.isMyTurn.value)
const phase = computed(() => game.phase.value)
const trump = computed(() => game.trump.value)
const dealer = computed(() => game.dealer.value)
const myPlayerId = computed(() => game.myPlayerId.value)

const isDealer = computed(() => {
  return myPlayerId.value === dealer.value
})

const tricksWon = computed(() => {
  const playerId = myPlayerId.value
  return game.tricksWonByPlayer.value[playerId] ?? 0
})

const isDiscardPhase = computed(() => {
  return phase.value === GamePhase.DealerDiscard && isDealer.value
})

const showTrumpIndicator = computed(() => {
  return trump.value && trump.value.calledBy === myPlayerId.value
})

const trumpSymbol = computed(() => {
  const suit = trump.value?.suit
  if (!suit) return ''
  switch (suit) {
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

const trumpColor = computed(() => {
  const suit = trump.value?.suit
  if (!suit) return 'white'
  return suit === Suit.Hearts || suit === Suit.Diamonds
    ? '#e74c3c'
    : 'white'
})
</script>

<style scoped lang="scss">
.user-plaque-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-sm;
}

.status-message {
  font-size: 0.75rem;
  color: $secondary-color;
  font-weight: bold;
  animation: pulse 1.5s ease-in-out infinite;

  &.discard-prompt {
    color: #f39c12;
    background: rgba(0, 0, 0, 0.8);
    padding: $spacing-xs $spacing-sm;
    border-radius: 4px;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
