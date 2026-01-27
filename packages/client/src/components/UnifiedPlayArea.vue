<template>
  <div class="play-area-container">
    <!-- Turn-up card during bidding -->
    <div v-if="showTurnUpCard" class="turn-up-card">
      <Card :card="turnUpCard!" :selectable="false" />
      <span class="turn-up-label">Turn Up</span>
    </div>
    <!-- Played cards during trick -->
    <div v-else-if="currentTrickCards.length > 0" class="played-cards">
      <div
        v-for="playedCard in currentTrickCards"
        :key="`${playedCard.playerId}-${playedCard.card.id}`"
        :class="['played-card', `position-${getCardPosition(playedCard.playerId)}`]"
      >
        <Card :card="playedCard.card" :selectable="false" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import type { GameAdapter } from '@/composables/useGameAdapter'
import { GamePhase } from '@euchre/shared'
import Card from './Card.vue'

const game = inject<GameAdapter>('game')!

const phase = computed(() => game.phase.value)
const turnUpCard = computed(() => game.turnUpCard.value)
const currentTrick = computed(() => game.currentTrick.value)
const myPlayerId = computed(() => game.myPlayerId.value)

const showTurnUpCard = computed(() => {
  return (phase.value === GamePhase.BiddingRound1 || phase.value === GamePhase.BiddingRound2) && turnUpCard.value
})

const currentTrickCards = computed(() => {
  return currentTrick.value?.cards ?? []
})

// Get visual position of a card based on player ID relative to human player
function getCardPosition(playerId: number): number {
  const myId = myPlayerId.value
  if (myId === -1) return playerId

  return (playerId - myId + 4) % 4
}
</script>

<style scoped lang="scss">
.play-area-container {
  position: relative;
  width: 240px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-height: 500px) {
    width: 180px;
    height: 130px;
  }
}

.played-cards {
  position: relative;
  width: 100%;
  height: 100%;
}

.played-card {
  position: absolute;

  &.position-0 {
    bottom: -25px;
    left: 50%;
    transform: translateX(-50%);
    animation: play-card-bottom 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  &.position-1 {
    left: -25px;
    top: 50%;
    transform: translateY(-50%);
    animation: play-card-left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  &.position-2 {
    top: -25px;
    left: 50%;
    transform: translateX(-50%);
    animation: play-card-top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  &.position-3 {
    right: -25px;
    top: 50%;
    transform: translateY(-50%);
    animation: play-card-right 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @media (max-height: 500px) {

    &.position-1 {
      left: -20px;
    }

    &.position-3 {
      right: -20px;
    }
  }
}

.turn-up-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-xs;

  .turn-up-label {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: bold;

    @media (max-height: 500px) {
      font-size: 0.625rem;
    }
  }
}

@keyframes play-card-bottom {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(100px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@keyframes play-card-left {
  from {
    opacity: 0;
    transform: translateY(-50%) translateX(-100px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) translateX(0) scale(1);
  }
}

@keyframes play-card-top {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-100px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@keyframes play-card-right {
  from {
    opacity: 0;
    transform: translateY(-50%) translateX(100px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) translateX(0) scale(1);
  }
}
</style>
