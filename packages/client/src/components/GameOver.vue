<template>
  <Modal :show="true">
    <div class="game-over">
      <h1>Game Over!</h1>
      <h2>{{ winnerText }}</h2>
      <button class="action-btn" @click="startNewGame">
        Play Again
      </button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import Modal from './Modal.vue'

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
  // Content styles only - Modal handles positioning
  text-align: center;
  min-width: 220px;

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
  min-width: 120px;

  &:active {
    transform: scale(0.97);
  }
}

</style>
