<template>
  <div :class="['opponent-hand', `position-${position}`]">
    <div class="player-info">
      <PlayerPlaque
        :player-name="player?.name || 'Empty'"
        :tricks-won="tricksWon"
        :is-dealer="isDealer"
        :is-current-turn="isCurrent"
        :trump-symbol="showTrumpIndicator ? trumpSymbol : undefined"
        :trump-color="showTrumpIndicator ? trumpColor : undefined"
        :going-alone="showTrumpIndicator ? game.trump.value?.goingAlone : undefined"
        :is-human="player?.isHuman ?? false"
      />
      <span v-if="bidActionMessage" class="bid-action">{{ bidActionMessage }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import type { GameAdapter, UnifiedPlayer } from '@/composables/useGameAdapter'
import { Suit } from '@euchre/shared'
import PlayerPlaque from './PlayerPlaque.vue'

interface Props {
  player: UnifiedPlayer | null
  isCurrent: boolean
  position: 'top' | 'left' | 'right'
}

const props = defineProps<Props>()

const game = inject<GameAdapter>('game')!

const isDealer = computed(() => {
  return props.player?.id === game.dealer.value
})

const tricksWon = computed(() => {
  if (!props.player) return 0
  return game.tricksWonByPlayer.value[props.player.id] ?? 0
})

const bidActionMessage = computed(() => {
  const lastBid = game.lastBidAction.value
  if (!lastBid) return null
  if (lastBid.playerId === props.player?.id) {
    return lastBid.message
  }
  return null
})

const showTrumpIndicator = computed(() => {
  return game.trump.value && game.trump.value.calledBy === props.player?.id
})

const trumpSymbol = computed(() => {
  const suit = game.trump.value?.suit
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
  const suit = game.trump.value?.suit
  if (!suit) return 'white'
  return suit === Suit.Hearts || suit === Suit.Diamonds
    ? '#e74c3c'
    : '#2c3e50' // Black for clubs and spades
})
</script>

<style scoped lang="scss">
.opponent-hand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-xs;
}

.player-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
  position: relative;
  min-height: 35px;

  .bid-action {
    position: absolute;
    top: 100%;
    margin-top: $spacing-xs;
    font-size: 0.75rem;
    color: white;
    font-weight: bold;
    background: rgba(255, 255, 255, 0.2);
    padding: 2px $spacing-xs;
    border-radius: 4px;
    animation: fadeInOut 1s ease-in-out;
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
