<template>
  <div class="player-plaque">
    <div class="tricks-won">{{ tricksWon }}</div>
    <div class="player-name-container">
      <span class="player-name">{{ playerName }}</span>
    </div>
    <div v-if="trumpSymbol" class="trump-indicator" :style="{ color: trumpColor }">
      <span>{{ trumpSymbol }}</span>
    </div>
    <div v-else-if="isDealer" class="dealer-indicator">
      <span>D</span>
    </div>
    <div v-else class="indicator-spacer"></div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  playerName: string
  tricksWon: number
  isDealer: boolean
  trumpSymbol?: string
  trumpColor?: string
}

defineProps<Props>()
</script>

<style scoped lang="scss">
.player-plaque {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  padding: $spacing-xs $spacing-sm;
  backdrop-filter: blur(10px);

  @media (max-height: 500px) {
    gap: $spacing-xs;
    padding: 2px $spacing-xs;
    border-radius: 5px;
  }
}

.tricks-won {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-weight: bold;
  font-size: 0.875rem;
  color: white;

  @media (max-height: 500px) {
    width: 18px;
    height: 18px;
    font-size: 0.75rem;
  }
}

.player-name-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;

  @media (max-height: 500px) {
    min-width: 45px;
  }
}

.player-name {
  font-size: 1rem;
  font-weight: bold;
  color: white;
  white-space: nowrap;

  @media (max-height: 500px) {
    font-size: 0.75rem;
  }
}

.dealer-indicator {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  font-weight: bold;
  font-size: 0.875rem;
  color: white;

  @media (max-height: 500px) {
    width: 18px;
    height: 18px;
    font-size: 0.625rem;
    border-width: 1px;
  }
}

.trump-indicator {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  font-weight: bold;
  font-size: 1rem;

  @media (max-height: 500px) {
    width: 18px;
    height: 18px;
    font-size: 0.75rem;
    border-width: 1px;
  }
}

.indicator-spacer {
  width: 24px;

  @media (max-height: 500px) {
    width: 18px;
  }
}
</style>
