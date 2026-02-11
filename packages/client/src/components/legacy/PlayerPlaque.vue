<template>
  <div class="player-plaque-container">
    <div class="player-plaque" :class="{ 'current-turn': isCurrentTurn, 'is-ai': !isHuman }">
      <div class="tricks-won">{{ tricksWon }}</div>
      <div class="player-name-container">
        <span class="player-name" :class="{ 'clanker': !isHuman }">{{ playerName }}</span>
      </div>
    </div>

    <!-- Chip indicators below the plaque -->
    <div v-if="showDealerChip || trumpSymbol" class="chip-indicators">
      <div v-if="showDealerChip" class="poker-chip dealer-chip">
        <span>D</span>
      </div>
      <div v-if="trumpSymbol" class="poker-chip trump-chip" :class="{ 'going-alone': goingAlone }">
        <span class="suit-icon" :style="{ color: trumpColor }">{{ trumpSymbol }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  playerName: string
  tricksWon: number
  isDealer: boolean
  isCurrentTurn?: boolean
  trumpSymbol?: string
  trumpColor?: string
  goingAlone?: boolean
  isHuman?: boolean
  hideDealer?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  hideDealer: false
})

const showDealerChip = computed(() => props.isDealer && !props.hideDealer)
</script>

<style scoped lang="scss">
.player-plaque-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
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
  transition: border-color var(--anim-fast) ease, box-shadow var(--anim-fast) ease;

  &.current-turn {
    border-color: #f4d03f;
    box-shadow: 0 0 12px rgba(244, 208, 63, 0.6);
  }

  &.is-ai {
    // Subtle graph paper grid pattern for AI vibe
    background:
      // Vertical lines
      repeating-linear-gradient(
        90deg,
        rgba(100, 200, 255, 0.08) 0px,
        rgba(100, 200, 255, 0.08) 1px,
        transparent 1px,
        transparent 8px
      ),
      // Horizontal lines
      repeating-linear-gradient(
        0deg,
        rgba(100, 200, 255, 0.08) 0px,
        rgba(100, 200, 255, 0.08) 1px,
        transparent 1px,
        transparent 8px
      ),
      // Base background
      rgba(255, 255, 255, 0.1);
    border-color: rgba(100, 200, 255, 0.3);

    // Keep yellow highlight when it's their turn
    &.current-turn {
      border-color: #f4d03f;
    }
  }
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
  font-family: 'Shadows Into Light', cursive;

  &.clanker {
    font-family: 'Audiowide', cursive;
    font-size: 1rem;
    font-weight: 400;
    letter-spacing: 0.05em;
  }
}

.chip-indicators {
  position: absolute;
  top: 100%;
  right: -10px;
  margin-top: -5px;
  display: flex;
  gap: $spacing-xs;
}

.poker-chip {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: bold;
  font-size: 1rem;
  position: relative;
  // 3D chip effect with shadows
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.3),
    0 4px 8px rgba(0, 0, 0, 0.2),
    inset 0 2px 3px rgba(255, 255, 255, 0.6),
    inset 0 -2px 3px rgba(0, 0, 0, 0.2);

  // Inner ring for chip detail
  &::before {
    content: '';
    position: absolute;
    width: 27px;
    height: 27px;
    border: 2px dashed currentColor;
    border-radius: 50%;
    opacity: 0.3;
  }

  span {
    position: relative;
    z-index: 1;
  }
}

.dealer-chip {
  background: linear-gradient(135deg, #ffffff 0%, #e0e0e0 50%, #ffffff 100%);
  color: #2c3e50;

  &::before {
    border-color: #2c3e50;
  }
}

.trump-chip {
  background: linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 50%, #f8f8f8 100%);

  &::before {
    border-color: #4a5568;
  }

  .suit-icon {
    font-size: 1.25rem;
    line-height: 1;
  }

  &.going-alone {
    box-shadow:
      0 3px 6px rgba(0, 0, 0, 0.4),
      0 0 10px rgba(255, 215, 0, 0.6),
      inset 0 2px 3px rgba(255, 255, 255, 0.6),
      inset 0 -2px 3px rgba(0, 0, 0, 0.3);

    &::before {
      border-color: #ffd700;
    }
  }
}
</style>
