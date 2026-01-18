<template>
  <div class="game-over-overlay">
    <div class="game-over">
      <h1>🎉 Game Over! 🎉</h1>
      <h2>{{ winnerText }}</h2>
      <button class="new-game-btn" @click="startNewGame">
        Play Again
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

interface Props {
  winner: number | null
}

const props = defineProps<Props>()
const gameStore = useGameStore()

const winnerText = computed(() => {
  if (props.winner === 0) {
    return 'Your Team Wins!'
  } else if (props.winner === 1) {
    return 'Opponents Win!'
  }
  return 'Game Over'
})

function startNewGame() {
  gameStore.startNewGame()
}
</script>

<style scoped lang="scss">
.game-over-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.5s ease-out;
}

.game-over {
  background: linear-gradient(135deg, #2d5f3f 0%, #1a3d28 100%);
  border: 3px solid rgba(255, 255, 255, 0.3);
  padding: $spacing-xl;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  text-align: center;
  color: white;
  backdrop-filter: blur(10px);
  animation: scaleIn 0.5s ease-out;

  h1 {
    font-size: 2.5rem;
    margin-bottom: $spacing-md;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  }

  h2 {
    font-size: 1.75rem;
    margin-bottom: $spacing-lg;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  }
}

.new-game-btn {
  padding: $spacing-md $spacing-xl;
  font-size: 1.25rem;
  font-weight: bold;
  background: white;
  color: #f5576c;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  &:active {
    transform: scale(0.95);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0.8);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
