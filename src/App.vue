<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from './stores/gameStore'
import { GamePhase } from './models/types'
import GameBoard from './components/GameBoard.vue'

const gameStore = useGameStore()

const phase = computed(() => gameStore.phase)
const showStartButton = computed(() => phase.value === GamePhase.Setup)

function startGame() {
  gameStore.startNewGame()
}
</script>

<template>
  <div id="app">
    <!-- Portrait orientation overlay for mobile -->
    <div class="rotate-device-overlay">
      <div class="rotate-content">
        <div class="rotate-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <path d="M12 18h.01" />
          </svg>
          <div class="rotate-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </div>
        </div>
        <p>Please rotate your device to landscape mode</p>
      </div>
    </div>

    <div v-if="showStartButton" class="start-screen">
      <h1>Euchre</h1>
      <p class="subtitle">Play against 3 AI opponents</p>
      <button class="start-btn" @click="startGame">Start Game</button>
    </div>
    <GameBoard v-else />
  </div>
</template>

<style scoped lang="scss">
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

// Portrait orientation overlay - only shows on mobile portrait
.rotate-device-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%);
  z-index: 9999;
  align-items: center;
  justify-content: center;

  // Only show on mobile devices in portrait mode
  @media (max-width: 768px) and (orientation: portrait) {
    display: flex;
  }
}

.rotate-content {
  text-align: center;
  color: white;
  padding: $spacing-xl;

  p {
    font-size: 1.25rem;
    margin-top: $spacing-lg;
    opacity: 0.9;
  }
}

.rotate-icon {
  position: relative;
  width: 80px;
  height: 100px;
  margin: 0 auto;

  svg {
    width: 80px;
    height: 100px;
    color: white;
    opacity: 0.9;
  }

  .rotate-arrow {
    position: absolute;
    top: -10px;
    right: -30px;
    animation: rotateHint 2s ease-in-out infinite;

    svg {
      width: 40px;
      height: 40px;
      color: $secondary-color;
    }
  }
}

@keyframes rotateHint {
  0%, 100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(20deg);
  }
}

.start-screen {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;

  h1 {
    font-size: 4rem;
    margin-bottom: $spacing-md;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);

    @media (max-height: 500px) {
      font-size: 2.5rem;
    }
  }

  .subtitle {
    font-size: 1.5rem;
    margin-bottom: $spacing-xl * 2;
    opacity: 0.9;

    @media (max-height: 500px) {
      font-size: 1rem;
      margin-bottom: $spacing-lg;
    }
  }
}

.start-btn {
  padding: $spacing-lg $spacing-xl * 2;
  font-size: 1.5rem;
  font-weight: bold;
  background: white;
  color: #667eea;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);

  @media (max-height: 500px) {
    padding: $spacing-md $spacing-xl;
    font-size: 1.25rem;
  }

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }

  &:active {
    transform: scale(0.95);
  }
}
</style>
