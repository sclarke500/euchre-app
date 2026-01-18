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
  width: 100vw;
  height: 100vh;
  overflow: hidden;
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
  }

  .subtitle {
    font-size: 1.5rem;
    margin-bottom: $spacing-xl * 2;
    opacity: 0.9;
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

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }

  &:active {
    transform: scale(0.95);
  }
}
</style>
