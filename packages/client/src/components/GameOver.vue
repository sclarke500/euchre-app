<template>
  <div class="game-over">
    <h1>Game Over!</h1>
    <h2>{{ winnerText }}</h2>
    <button class="action-btn" @click="startNewGame">
      Play Again
    </button>
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
.game-over {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #f5f5f5;
  border: 1px solid #ddd;
  padding: $spacing-lg $spacing-xl;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  text-align: center;
  z-index: 10000;
  animation: scaleIn 0.3s ease-out;
  min-width: 220px;
  // Ensure it's positioned relative to viewport, not parent
  margin: 0;

  h1 {
    font-size: 1.5rem;
    margin-bottom: $spacing-sm;
    color: #333;
  }

  h2 {
    font-size: 1.1rem;
    margin-bottom: $spacing-md;
    color: #555;
  }
}

.action-btn {
  padding: $spacing-sm $spacing-lg;
  font-size: 1rem;
  font-weight: bold;
  background: #2d5f3f;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-width: 120px;

  &:hover {
    background: #3d7f52;
  }

  &:active {
    transform: scale(0.97);
  }
}

@keyframes scaleIn {
  from {
    transform: translate(-50%, -50%) scale(0.9);
    opacity: 0;
  }
  to {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}
</style>
