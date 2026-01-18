<template>
  <div class="player-hand">
    <div class="player-info">
      <PlayerPlaque
        :player-name="player?.name || ''"
        :tricks-won="tricksWon"
        :is-dealer="isDealer"
        :trump-symbol="showTrumpIndicator ? trumpSymbol : undefined"
        :trump-color="showTrumpIndicator ? trumpColor : undefined"
        :going-alone="showTrumpIndicator ? trump?.goingAlone : undefined"
      />
      <span v-if="isCurrentPlayer" class="current-turn">Your Turn</span>
    </div>
    <div class="cards">
      <Card
        v-for="(card, index) in sortedHand"
        :key="card.id"
        :card="card"
        :selectable="isCardPlayable(card)"
        :style="getCardStyle(index, sortedHand.length)"
        :class="{ 'card-playable': isCardPlayable(card) }"
        @click="handleCardClick(card)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { Player, Card as CardType } from '@/models/types'
import { GamePhase, Suit } from '@/models/types'
import { getLegalPlays, countTricksWonByPlayer } from '@/services/trick'
import { sortCards } from '@/utils/cardSort'
import Card from './Card.vue'
import PlayerPlaque from './PlayerPlaque.vue'

interface Props {
  player: Player | undefined
}

const props = defineProps<Props>()
const gameStore = useGameStore()

const currentPlayer = computed(() => gameStore.currentPlayer)
const phase = computed(() => gameStore.phase)
const currentTrick = computed(() => gameStore.currentTrick)
const trump = computed(() => gameStore.trump)
const currentRound = computed(() => gameStore.currentRound)

const isDealer = computed(() => {
  return props.player?.id === currentRound.value?.dealer
})

const tricksWon = computed(() => {
  if (!currentRound.value || !props.player) return 0
  return countTricksWonByPlayer(currentRound.value.tricks, props.player.id)
})

const showTrumpIndicator = computed(() => {
  return trump.value && trump.value.calledBy === props.player?.id
})

const trumpSymbol = computed(() => {
  if (!trump.value) return ''
  switch (trump.value.suit) {
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
  if (!trump.value) return 'white'
  return trump.value.suit === Suit.Hearts || trump.value.suit === Suit.Diamonds
    ? '#e74c3c'
    : 'white'
})

const isCurrentPlayer = computed(() => {
  return props.player?.id === currentPlayer.value
})

const canPlay = computed(() => {
  return phase.value === GamePhase.Playing && isCurrentPlayer.value
})

const sortedHand = computed(() => {
  if (!props.player?.hand) return []
  const trumpSuit = trump.value?.suit ?? null
  return sortCards(props.player.hand, trumpSuit)
})

const legalPlays = computed(() => {
  if (!canPlay.value || !props.player || !trump.value) return []
  return getLegalPlays(props.player.hand, currentTrick.value, trump.value.suit)
})

function isCardPlayable(card: CardType): boolean {
  if (!canPlay.value) return false
  return legalPlays.value.some((c) => c.id === card.id)
}

function isMobileViewport() {
  return window.innerHeight < 500
}

function getCardStyle(index: number, totalCards: number) {
  // Responsive values for mobile
  const isMobile = isMobileViewport()
  const cardOffset = isMobile ? 24 : 36 // Spread cards wider apart
  const maxRotation = isMobile ? 8 : 12 // Fan rotation angle
  const arcDepth = isMobile ? 12 : 20 // Arc depth

  // Calculate position along the fan (0 to 1)
  const position = totalCards > 1 ? index / (totalCards - 1) : 0.5

  // Rotation: subtle fan effect
  const rotation = (position - 0.5) * maxRotation * 2

  // X position: cards overlap from left to right
  const x = (index - (totalCards - 1) / 2) * cardOffset

  // Y position: gentle arc - middle cards slightly lower
  const y = Math.pow(position - 0.5, 2) * arcDepth

  return {
    transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`,
    zIndex: index, // Left cards on top
  }
}

function handleCardClick(card: CardType) {
  if (!isCardPlayable(card) || !props.player) return
  gameStore.playCard(card, props.player.id)
}
</script>

<style scoped lang="scss">
.player-hand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-md;

  @media (max-height: 500px) {
    gap: $spacing-xs;
  }
}

.player-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
  position: relative;
  min-height: 60px; // Reserve space to prevent shifting

  @media (max-height: 500px) {
    min-height: 40px;
  }

  .current-turn {
    position: absolute;
    top: 100%;
    margin-top: $spacing-xs;
    font-size: 0.875rem;
    color: $secondary-color;
    font-weight: bold;
    animation: pulse 1.5s ease-in-out infinite;

    @media (max-height: 500px) {
      font-size: 0.75rem;
    }
  }
}

.cards {
  position: relative;
  height: $card-height + 30px; // Space for arc
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;

  @media (max-height: 500px) {
    height: $card-height-mobile + 15px;
  }

  :deep(.card) {
    position: absolute;
    left: 50%;
    bottom: 0;
    margin-left: calc(-1 * $card-width / 2); // Center the card
    transition: all 0.15s ease;
    transform-origin: bottom center;

    @media (max-height: 500px) {
      margin-left: calc(-1 * $card-width-mobile / 2);
    }
  }

  :deep(.card-playable.card) {
    // Raise playable cards slightly
    bottom: 10px;

    @media (max-height: 500px) {
      bottom: 6px;
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
