<template>
  <div class="player-hand">
    <Card
      v-for="(card, index) in sortedHand"
      :key="card.id"
      :card="card"
      :selectable="isCardSelectable(card)"
      :style="getCardStyle(index, sortedHand.length)"
      :class="{ 'card-selected': selectedCard === card.id }"
      @click="handleCardClick(card)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, inject } from 'vue'
import type { GameAdapter } from '@/composables/useGameAdapter'
import { GamePhase } from '@euchre/shared'
import type { Card as CardType } from '@euchre/shared'
import { sortCards } from '@/utils/cardSort'
import Card from './Card.vue'

const game = inject<GameAdapter>('game')!

const selectedCard = ref<string | null>(null)

const myHand = computed(() => game.myHand.value)
const isMyTurn = computed(() => game.isMyTurn.value)
const validCards = computed(() => game.validCards.value)
const phase = computed(() => game.phase.value)
const trump = computed(() => game.trump.value)
const dealer = computed(() => game.dealer.value)
const myPlayerId = computed(() => game.myPlayerId.value)

const isDealer = computed(() => {
  return myPlayerId.value === dealer.value
})

const isDiscardPhase = computed(() => {
  return phase.value === GamePhase.DealerDiscard && isDealer.value
})

const sortedHand = computed(() => {
  const trumpSuit = trump.value?.suit ?? null
  return sortCards(myHand.value, trumpSuit)
})

function isCardPlayable(card: CardType): boolean {
  if (!isMyTurn.value) return false
  if (phase.value === GamePhase.Playing) {
    return validCards.value.includes(card.id)
  }
  return false
}

function isCardSelectable(card: CardType): boolean {
  if (isDiscardPhase.value) return true
  return isCardPlayable(card)
}

function getCardStyle(index: number, totalCards: number) {
  const cardOffset = 55
  const maxRotation = 5
  const arcDepth = 8

  const position = totalCards > 1 ? index / (totalCards - 1) : 0.5
  const rotation = (position - 0.5) * maxRotation * 2
  const x = (index - (totalCards - 1) / 2) * cardOffset
  const y = Math.pow(position - 0.5, 2) * arcDepth

  return {
    transform: `translateX(${x}px) translateY(${y}px) rotate(${rotation}deg)`,
    zIndex: index,
  }
}

function handleCardClick(card: CardType) {
  if (isDiscardPhase.value) {
    if (selectedCard.value === card.id) {
      game.discardCard(card)
      selectedCard.value = null
    } else {
      selectedCard.value = card.id
    }
    return
  }

  if (!isCardPlayable(card)) return
  game.playCard(card)
}
</script>

<style scoped lang="scss">
.player-hand {
  position: relative;
  display: flex;
  justify-content: center;
  width: 100%;
  height: 95px; // Show ~75% of 126px card height
  overflow: hidden;
}

:deep(.card) {
  position: absolute;
  top: 0;
  transition: transform 0.15s ease;
}

:deep(.card.selectable) {
  cursor: pointer;
}

:deep(.card.selectable:hover) {
  transform: translateY(-8px);
}

:deep(.card-selected) {
  box-shadow: 0 0 12px $secondary-color;
}
</style>
