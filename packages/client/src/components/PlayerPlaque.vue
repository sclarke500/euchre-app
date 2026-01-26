<template>
  <div class="player-plaque-container">
    <!-- Trump caller badge above the plaque -->
    <div v-if="trumpSymbol" class="trump-caller-badge" :class="{ 'going-alone': goingAlone }">
      <span class="trump-symbol" :style="{ color: trumpColor }">{{ trumpSymbol }}</span>
      <span class="trump-label">Trump</span>
      <span v-if="goingAlone" class="alone-badge">ALONE</span>
    </div>

    <div class="player-plaque">
      <div class="tricks-won">{{ tricksWon }}</div>
      <div class="player-name-container">
        <span class="player-name">{{ playerName }}</span>
      </div>
      <div v-if="isDealer" class="dealer-indicator">
        <span>D</span>
      </div>
      <div v-else class="indicator-spacer"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  playerName: string
  tricksWon: number
  isDealer: boolean
  trumpSymbol?: string
  trumpColor?: string
  goingAlone?: boolean
}

defineProps<Props>()
</script>

<style scoped lang="scss">
.player-plaque-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-xs;
}

.trump-caller-badge {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 16px;
  padding: 2px $spacing-sm;
  backdrop-filter: blur(10px);

  @media (max-height: 500px) {
    padding: 1px $spacing-xs;
    border-radius: 12px;
  }

  .trump-symbol {
    font-size: 1.25rem;
    font-weight: bold;
    line-height: 1;

    @media (max-height: 500px) {
      font-size: 1rem;
    }
  }

  .trump-label {
    font-size: 0.75rem;
    font-weight: bold;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    @media (max-height: 500px) {
      font-size: 0.625rem;
    }
  }

  .alone-badge {
    font-size: 0.625rem;
    font-weight: bold;
    color: #ffd700;
    background: rgba(255, 215, 0, 0.2);
    border: 1px solid rgba(255, 215, 0, 0.5);
    border-radius: 4px;
    padding: 1px 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    @media (max-height: 500px) {
      font-size: 0.5rem;
      padding: 0 3px;
    }
  }

  &.going-alone {
    border-color: rgba(255, 215, 0, 0.6);
    background: rgba(255, 215, 0, 0.1);
  }
}

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

.indicator-spacer {
  width: 24px;

  @media (max-height: 500px) {
    width: 18px;
  }
}
</style>
