<template>
  <div class="player-hand">
    <div class="player-info">
      <PlayerPlaque
        :player-name="myPlayer?.name || 'You'"
        :tricks-won="tricksWon"
        :is-dealer="isDealer"
        :trump-symbol="showTrumpIndicator ? trumpSymbol : undefined"
        :trump-color="showTrumpIndicator ? trumpColor : undefined"
        :going-alone="showTrumpIndicator ? trump?.goingAlone : undefined"
      />
      <span v-if="isDiscardPhase" class="current-turn discard-prompt">Select a card to discard</span>
      <span v-else-if="isMyTurn" class="current-turn">Your Turn</span>
    </div>
    <div class="cards">
      <Card
        v-for="(card, index) in sortedHand"
        :key="card.id"
        :card="card"
        :selectable="isCardSelectable(card)"
        :style="getCardStyle(index, sortedHand.length)"
        :class="{ 'card-playable': isCardSelectable(card), 'card-selected': selectedCard === card.id }"
        @click="handleCardClick(card)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, inject } from 'vue'
import type { GameAdapter } from '@/composables/useGameAdapter'
import { GamePhase, Suit } from '@euchre/shared'
import type { Card as CardType } from '@euchre/shared'
import { sortCards } from '@/utils/cardSort'
import Card from './Card.vue'
import PlayerPlaque from './PlayerPlaque.vue'

const game = inject<GameAdapter>('game')!

const selectedCard = ref<string | null>(null)

const myPlayer = computed(() => {
  const myId = game.myPlayerId.value
  return game.players.value.find(p => p.id === myId) ?? null
})

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

const tricksWon = computed(() => {
  const teamId = myPlayer.value?.teamId ?? 0
  return game.tricksTaken.value[teamId] ?? 0
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

function isMobileViewport() {
  return window.innerHeight < 500
}

function getCardStyle(index: number, totalCards: number) {
  const isMobile = isMobileViewport()
  const cardOffset = isMobile ? 38 : 40
  const maxRotation = isMobile ? 4 : 12
  const arcDepth = isMobile ? 5 : 20

  const position = totalCards > 1 ? index / (totalCards - 1) : 0.5
  const rotation = (position - 0.5) * maxRotation * 2
  const x = (index - (totalCards - 1) / 2) * cardOffset
  const y = Math.pow(position - 0.5, 2) * arcDepth

  return {
    transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`,
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-md;

  @media (max-height: 500px) {
    flex-direction: row;
    align-items: flex-end;
    justify-content: flex-end;
    gap: $spacing-sm;
    width: 100%;
    padding-right: $spacing-md;
  }
}

.player-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
  position: relative;
  min-height: 60px;

  @media (max-height: 500px) {
    min-height: auto;
    order: 2;
    margin-bottom: $spacing-sm;
  }

  .current-turn {
    position: absolute;
    top: 100%;
    margin-top: $spacing-xs;
    font-size: 0.875rem;
    color: $secondary-color;
    font-weight: bold;
    animation: pulse 1.5s ease-in-out infinite;
    z-index: 100;

    @media (max-height: 500px) {
      font-size: 0.75rem;
    }

    &.discard-prompt {
      color: #f39c12;
      background: rgba(0, 0, 0, 0.8);
      padding: $spacing-xs $spacing-sm;
      border-radius: 4px;
    }
  }
}

.cards {
  position: relative;
  height: $card-height + 30px;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;

  @media (max-height: 500px) {
    height: 55px;
    width: auto;
    order: 1;
    flex: 1;
    justify-content: center;
    overflow: visible;
  }

  :deep(.card) {
    position: absolute;
    left: 50%;
    bottom: 0;
    margin-left: calc(-1 * $card-width / 2);
    transition: all 0.15s ease;
    transform-origin: bottom center;

    @media (max-height: 500px) {
      margin-left: calc(-1 * $card-width / 2);
      bottom: -50px;
    }
  }

  :deep(.card-playable.card) {
    bottom: 10px;

    @media (max-height: 500px) {
      bottom: -40px;
    }
  }

  :deep(.card-selected.card) {
    bottom: 15px;
    box-shadow: 0 0 15px $secondary-color;

    @media (max-height: 500px) {
      bottom: -35px;
    }
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
