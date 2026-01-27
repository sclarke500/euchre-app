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
  padding: 3px $spacing-sm;
  backdrop-filter: blur(10px);

  .trump-symbol {
    font-size: 1.4rem;
    font-weight: bold;
    line-height: 1;
  }

  .trump-label {
    font-size: 0.85rem;
    font-weight: bold;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .alone-badge {
    font-size: 0.7rem;
    font-weight: bold;
    color: #ffd700;
    background: rgba(255, 215, 0, 0.2);
    border: 1px solid rgba(255, 215, 0, 0.5);
    border-radius: 4px;
    padding: 2px 5px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
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
  border-radius: 10px;
  padding: $spacing-xs $spacing-md;
  backdrop-filter: blur(10px);
}

.tricks-won {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 5px;
  font-weight: bold;
  font-size: 1.1rem;
  color: white;
}

.player-name-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 75px;
}

.player-name {
  font-size: 1.25rem;
  font-weight: bold;
  color: white;
  white-space: nowrap;
}

.dealer-indicator {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  font-weight: bold;
  font-size: 1.1rem;
  color: white;
}

.indicator-spacer {
  width: 30px;
}
</style>
