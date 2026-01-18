<template>
  <div class="play-area-container">
    <div v-if="currentTrick.cards.length > 0" class="played-cards">
      <div
        v-for="playedCard in currentTrick.cards"
        :key="`${playedCard.playerId}-${playedCard.card.id}`"
        :class="['played-card', `position-${playedCard.playerId}`]"
      >
        <Card :card="playedCard.card" :selectable="false" />
      </div>
    </div>
    <div v-else class="empty-message">
      <p>Waiting for cards...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import Card from './Card.vue'

const gameStore = useGameStore()

const currentTrick = computed(() => gameStore.currentTrick)
</script>

<style scoped lang="scss">
.play-area-container {
  position: relative;
  width: 240px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.played-cards {
  position: relative;
  width: 100%;
  height: 100%;
}

.played-card {
  position: absolute;

  &.position-0 {
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    animation: play-card-bottom 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  &.position-1 {
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    animation: play-card-left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  &.position-2 {
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    animation: play-card-top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  &.position-3 {
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    animation: play-card-right 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

.empty-message {
  color: rgba(255, 255, 255, 0.3);
  font-size: 1.125rem;
  text-align: center;
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
