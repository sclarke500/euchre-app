<template>
  <div class="hand-container">
    <!-- Picked-up card shown separately during discard phase -->
    <div v-if="isDiscardPhase && pickedUpCard" class="picked-up-section">
      <Card
        :card="pickedUpCard"
        :selectable="true"
        @click="handleCardClick(pickedUpCard)"
      />
      <span class="picked-up-label">Picked Up</span>
    </div>

    <div class="player-hand" :style="handContainerStyle">
      <Card
        v-for="(card, index) in displayHand"
        :key="card.id"
        :card="card"
        :selectable="isCardSelectable(card)"
        :dimmed="isCardDimmed(card)"
        :style="getCardStyle(index, displayHand.length)"
        @click="handleCardClick(card)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import type { GameAdapter } from '@/composables/useGameAdapter'
import { GamePhase } from '@euchre/shared'
import type { Card as CardType } from '@euchre/shared'
import { sortCards } from '@/utils/cardSort'
import Card from './Card.vue'

const game = inject<GameAdapter>('game')!

const myHand = computed(() => game.myHand.value)
const isMyTurn = computed(() => game.isMyTurn.value)
const validCards = computed(() => game.validCards.value)
const phase = computed(() => game.phase.value)
const trump = computed(() => game.trump.value)
const dealer = computed(() => game.dealer.value)
const myPlayerId = computed(() => game.myPlayerId.value)
const turnUpCard = computed(() => game.turnUpCard.value)

const isDealer = computed(() => {
  return myPlayerId.value === dealer.value
})

const isDiscardPhase = computed(() => {
  return phase.value === GamePhase.DealerDiscard && isDealer.value
})

// Find the picked-up card in hand (matches turn-up card)
const pickedUpCard = computed(() => {
  if (!isDiscardPhase.value || !turnUpCard.value) return null
  return myHand.value.find(c => c.id === turnUpCard.value!.id) ?? null
})

// Hand excluding the picked-up card during discard phase
const handWithoutPickedUp = computed(() => {
  if (!isDiscardPhase.value || !pickedUpCard.value) return myHand.value
  return myHand.value.filter(c => c.id !== pickedUpCard.value!.id)
})

const sortedHand = computed(() => {
  const trumpSuit = trump.value?.suit ?? null
  return sortCards(handWithoutPickedUp.value, trumpSuit)
})

// Display hand: during discard phase, exclude the picked-up card
const displayHand = computed(() => {
  return sortedHand.value
})

// No dynamic container styling needed
const handContainerStyle = computed(() => ({}))

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

function isCardDimmed(card: CardType): boolean {
  // Only dim cards during playing phase when it's my turn and the card isn't valid
  if (phase.value !== GamePhase.Playing) return false
  if (!isMyTurn.value) return false
  return !validCards.value.includes(card.id)
}

function getCardStyle(index: number, totalCards: number) {
  const cardOffset = 45
  const maxRotation = 12
  const arcRadius = 400 // Cards arranged on arc of this radius

  const position = totalCards > 1 ? index / (totalCards - 1) : 0.5
  const angleOffset = (position - 0.5) * maxRotation * 2 // degrees from center
  const rotation = angleOffset

  // Calculate position on arc - middle cards higher, edge cards lower
  const angleRad = (angleOffset * Math.PI) / 180
  const x = (index - (totalCards - 1) / 2) * cardOffset
  const y = arcRadius * (1 - Math.cos(angleRad)) // 0 at center, positive at edges

  return {
    transform: `translateX(${x}px) translateY(${y}px) rotate(${rotation}deg)`,
    transformOrigin: 'center 300px', // Pivot point below card for natural fan
    zIndex: index,
  }
}

function handleCardClick(card: CardType) {
  if (isDiscardPhase.value) {
    game.discardCard(card)
    return
  }

  if (!isCardPlayable(card)) return
  game.playCard(card)
}
</script>

<style scoped lang="scss">
.hand-container {
  display: flex;
  align-items: flex-end;
  gap: $spacing-lg;
  width: 100%;
  justify-content: center;
}

.picked-up-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-xs;

  .picked-up-label {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: bold;
  }

  :deep(.card) {
    transition: transform 0.15s ease;
  }

  :deep(.card.selectable) {
    cursor: pointer;
  }

  :deep(.card.selectable:hover) {
    transform: translateY(-8px);
  }
}

.player-hand {
  position: relative;
  display: flex;
  justify-content: center;
  flex: 1;
  min-width: 300px;
  height: 95px; // Show ~75% of 126px card height
  overflow: hidden;
}

:deep(.player-hand .card) {
  position: absolute;
  top: 0;
  transition: transform 0.15s ease;
}

:deep(.player-hand .card.selectable) {
  cursor: pointer;
}

:deep(.player-hand .card.selectable:hover) {
  transform: translateY(-8px);
}
</style>
