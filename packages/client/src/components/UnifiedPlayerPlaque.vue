<template>
  <div class="user-plaque-wrapper">
    <PlayerPlaque
      :player-name="myPlayer?.name || 'You'"
      :tricks-won="tricksWon"
      :is-dealer="isDealer"
      :is-current-turn="isMyTurn"
      :trump-symbol="showTrumpIndicator ? trumpSymbol : undefined"
      :trump-color="showTrumpIndicator ? trumpColor : undefined"
      :going-alone="showTrumpIndicator ? trump?.goingAlone : undefined"
      :is-human="true"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import type { GameAdapter } from '@/composables/useGameAdapter'
import { Suit } from '@euchre/shared'
import PlayerPlaque from './PlayerPlaque.vue'

const game = inject<GameAdapter>('game')!

const myPlayer = computed(() => {
  const myId = game.myPlayerId.value
  return game.players.value.find(p => p.id === myId) ?? null
})

const isMyTurn = computed(() => game.isMyTurn.value)
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
    : '#2c3e50' // Black for clubs and spades
})
</script>

<style scoped lang="scss">
.user-plaque-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
