<script setup lang="ts">
import { watch, onMounted } from 'vue'
import Modal from './Modal.vue'
import confetti from 'canvas-confetti'

export interface TeamScore {
  name: string
  score: number | string
  isWinner?: boolean
}

const props = withDefaults(defineProps<{
  show: boolean
  won: boolean
  title?: string
  teams?: TeamScore[]
  primaryAction?: string
  secondaryAction?: string
  showConfetti?: boolean
  showPrimary?: boolean
}>(), {
  title: '',
  teams: () => [],
  primaryAction: 'Play Again',
  secondaryAction: 'Main Menu',
  showConfetti: true,
  showPrimary: true,
})

const emit = defineEmits<{
  primary: []
  secondary: []
  close: []
}>()

function celebrateWin() {
  if (!props.showConfetti || !props.won) return
  
  const duration = 3000
  const end = Date.now() + duration
  const colors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6']
  
  ;(function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors,
    })
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors,
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  })()
}

watch(() => props.show, (isShowing) => {
  if (isShowing) {
    celebrateWin()
  }
})

onMounted(() => {
  if (props.show) {
    celebrateWin()
  }
})

const displayTitle = computed(() => {
  if (props.title) return props.title
  return props.won ? '🎉 You Win!' : 'Game Over'
})

import { computed } from 'vue'
</script>

<template>
  <Modal :show="show" @close="emit('close')">
    <div class="modal-light game-over-modal" :class="{ won, lost: !won }">
      <div class="modal-header game-over-header">
        <h3>{{ displayTitle }}</h3>
      </div>
      <div class="modal-body">
        <div v-if="teams.length > 0" class="team-scores">
          <div 
            v-for="team in teams" 
            :key="team.name" 
            class="team-row"
            :class="{ winner: team.isWinner }"
          >
            <span class="team-name">{{ team.name }}</span>
            <span class="team-score">{{ team.score }}</span>
          </div>
        </div>
        <slot />
      </div>
      <div class="modal-footer game-over-actions">
        <button class="btn-secondary" @click="emit('secondary')">{{ secondaryAction }}</button>
        <button v-if="showPrimary" class="btn-primary" @click="emit('primary')">{{ primaryAction }}</button>
      </div>
    </div>
  </Modal>
</template>

<style scoped lang="scss">
.game-over-modal {
  min-width: 300px;
  max-width: 400px;
}

.game-over-header {
  text-align: center;
  
  h3 {
    margin: 0;
    font-size: 1.5rem;
  }
}

.won .game-over-header {
  background: linear-gradient(135deg, #f1c40f 0%, #f39c12 100%);
  
  h3 {
    color: #1a1a2e;
  }
}

.lost .game-over-header {
  background: linear-gradient(135deg, #7f8c8d 0%, #95a5a6 100%);
  
  h3 {
    color: #1a1a2e;
  }
}

.team-scores {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.team-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--color-surface-subtle);
  border-radius: var(--radius-md);
  border: 2px solid transparent;
  
  &.winner {
    border-color: #f1c40f;
    background: rgba(241, 196, 15, 0.1);
  }
}

.team-name {
  font-weight: 600;
  color: var(--color-text);
}

.team-score {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--color-text);
  
  .winner & {
    color: #f39c12;
  }
}

.game-over-actions {
  justify-content: center;
  gap: 1rem;
}
</style>
