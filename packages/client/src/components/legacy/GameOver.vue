<template>
  <Modal :show="true">
    <div class="game-over">
      <h1>Game Over!</h1>
      <h2>{{ winnerText }}</h2>

      <!-- Single player or multiplayer host -->
      <div v-if="mode === 'singlePlayer' || isHost" class="button-row">
        <button class="action-btn primary" @click="startNewGame">
          Play Again
        </button>
        <button class="action-btn secondary" @click="exitGame">
          Exit
        </button>
      </div>

      <!-- Multiplayer non-host -->
      <div v-else class="waiting-section">
        <p class="waiting-message">Waiting for host to start new game...</p>
        <button class="action-btn secondary" @click="exitGame">
          Exit
        </button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useLobbyStore } from '@/stores/lobbyStore'
import Modal from '../Modal.vue'

interface Props {
  winner: number | null
  mode: 'singlePlayer' | 'multiplayer'
  isHost?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isHost: false,
})

const gameStore = useGameStore()
const lobbyStore = useLobbyStore()

const emit = defineEmits<{
  exit: []
}>()

const winnerText = computed(() => {
  if (props.winner === 0) {
    return 'Your Team Wins!'
  } else if (props.winner === 1) {
    return 'Opponents Win!'
  }
  return 'Game Over'
})

function startNewGame() {
  if (props.mode === 'singlePlayer') {
    gameStore.startNewGame()
  } else {
    lobbyStore.restartGame()
  }
}

function exitGame() {
  emit('exit')
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

.button-row {
  display: flex;
  gap: $spacing-sm;
  justify-content: center;
}

.waiting-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-md;
}

.waiting-message {
  color: #666;
  font-size: 0.95rem;
  margin: 0;
}

.action-btn {
  padding: $spacing-sm $spacing-lg;
  font-size: 1rem;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  min-width: 100px;

  &.primary {
    background: #2d5f3f;
    color: white;
  }

  &.secondary {
    background: #e0e0e0;
    color: #333;
  }

  &:active {
    transform: scale(0.97);
  }
}
</style>
