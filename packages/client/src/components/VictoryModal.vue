<script setup lang="ts">
import { watch, onMounted } from 'vue'
import Modal from './Modal.vue'
import confetti from 'canvas-confetti'

export interface VictoryStat {
  value: string | number
  label: string
}

const props = withDefaults(defineProps<{
  show: boolean
  title?: string
  subtitle?: string
  stats?: VictoryStat[]
  primaryAction?: string
  secondaryAction?: string
  showConfetti?: boolean
}>(), {
  title: '🎉 You Win!',
  subtitle: '',
  stats: () => [],
  primaryAction: 'Play Again',
  secondaryAction: 'Main Menu',
  showConfetti: true,
})

const emit = defineEmits<{
  primary: []
  secondary: []
  close: []
}>()

function celebrateWin() {
  if (!props.showConfetti) return
  
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

// Also trigger on mount if already showing
onMounted(() => {
  if (props.show) {
    celebrateWin()
  }
})
</script>

<template>
  <Modal :show="show" @close="emit('close')">
    <div class="modal-light victory-modal">
      <div class="modal-header victory-header">
        <h3>{{ title }}</h3>
      </div>
      <div class="modal-body">
        <p v-if="subtitle" class="victory-subtitle">{{ subtitle }}</p>
        <div v-if="stats.length > 0" class="victory-stats">
          <div v-for="stat in stats" :key="stat.label" class="victory-stat">
            <span class="stat-value">{{ stat.value }}</span>
            <span class="stat-label">{{ stat.label }}</span>
          </div>
        </div>
        <slot />
      </div>
      <div class="modal-footer victory-actions">
        <button class="btn-secondary" @click="emit('secondary')">{{ secondaryAction }}</button>
        <button class="btn-primary" @click="emit('primary')">{{ primaryAction }}</button>
      </div>
    </div>
  </Modal>
</template>

<style scoped lang="scss">
.victory-modal {
  min-width: 300px;
  max-width: 400px;
}

.victory-header {
  background: linear-gradient(135deg, #f1c40f 0%, #f39c12 100%);
  text-align: center;
  
  h3 {
    color: #1a1a2e;
    margin: 0;
    font-size: 1.5rem;
  }
}

.victory-subtitle {
  text-align: center;
  color: var(--color-text-secondary);
  margin-bottom: 1rem;
}

.victory-stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.victory-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: bold;
  color: var(--color-text);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.victory-actions {
  justify-content: center;
  gap: 1rem;
}
</style>
