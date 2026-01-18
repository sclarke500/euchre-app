<template>
  <div :class="['opponent-hand', `position-${position}`]">
    <div class="player-info">
      <PlayerPlaque
        :player-name="player?.name || ''"
        :tricks-won="tricksWon"
        :is-dealer="isDealer"
        :trump-symbol="showTrumpIndicator ? trumpSymbol : undefined"
        :trump-color="showTrumpIndicator ? trumpColor : undefined"
      />
      <span v-if="isCurrentPlayer && !bidActionMessage" class="current-turn">Turn</span>
      <span v-if="bidActionMessage" class="bid-action">{{ bidActionMessage }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { Player } from '@/models/types'
import { Suit } from '@/models/types'
import { countTricksWonByPlayer } from '@/services/trick'
import PlayerPlaque from './PlayerPlaque.vue'

interface Props {
  player: Player | undefined
  position: 'top' | 'left' | 'right'
}

const props = defineProps<Props>()
const gameStore = useGameStore()

const currentPlayer = computed(() => gameStore.currentPlayer)
const trump = computed(() => gameStore.trump)
const currentRound = computed(() => gameStore.currentRound)
const lastAIBidAction = computed(() => gameStore.lastAIBidAction)

const isCurrentPlayer = computed(() => {
  return props.player?.id === currentPlayer.value
})

const bidActionMessage = computed(() => {
  if (!lastAIBidAction.value) return null
  if (lastAIBidAction.value.playerId === props.player?.id) {
    return lastAIBidAction.value.message
  }
  return null
})

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
</script>

<style scoped lang="scss">
.opponent-hand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-md;
}

.player-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
  position: relative;
  min-height: 60px; // Reserve space to prevent shifting

  .current-turn {
    position: absolute;
    top: 100%;
    margin-top: $spacing-xs;
    font-size: 0.75rem;
    color: $secondary-color;
    font-weight: bold;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .bid-action {
    position: absolute;
    top: 100%;
    margin-top: $spacing-xs;
    font-size: 0.875rem;
    color: white;
    font-weight: bold;
    background: rgba(255, 255, 255, 0.2);
    padding: $spacing-xs $spacing-sm;
    border-radius: 4px;
    animation: fadeInOut 1s ease-in-out;
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

@keyframes fadeInOut {
  0% {
    opacity: 0;
    transform: translateY(-5px);
  }
  20% {
    opacity: 1;
    transform: translateY(0);
  }
  80% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-5px);
  }
}
</style>
