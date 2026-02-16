<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore, type AIDifficulty } from '@/stores/settingsStore'
import EuchreOptions from '@/games/euchre/EuchreOptions.vue'
import PresidentOptions from '@/games/president/PresidentOptions.vue'
import SpadesOptions from '@/games/spades/SpadesOptions.vue'
import Modal from '@/components/Modal.vue'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const settings = useSettingsStore()

// Format build time for display
const buildInfo = computed(() => {
  const date = new Date(__BUILD_TIME__)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
})

function selectDifficulty(difficulty: AIDifficulty) {
  settings.setAIDifficulty(difficulty)
}

function checkForUpdates() {
  window.location.reload()
}
</script>

<template>
  <Modal :show="show" aria-label="Settings" @close="emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Settings</h2>
        <button class="close-btn" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="settings-section">
        <h3>AI Difficulty</h3>
        <p class="section-desc">Choose how challenging the computer opponents are</p>
        <div class="option-buttons">
          <button
            :class="['option-btn', { active: settings.aiDifficulty === 'easy' }]"
            @click="selectDifficulty('easy')"
          >
            <span class="option-title">Easy</span>
            <span class="option-desc">Basic strategy, no card counting</span>
          </button>
          <button
            :class="['option-btn', { active: settings.aiDifficulty === 'hard' }]"
            @click="selectDifficulty('hard')"
          >
            <span class="option-title">Hard</span>
            <span class="option-desc">Tracks cards, smarter plays</span>
          </button>
        </div>
      </div>

      <div class="game-section">
        <div class="game-header">Euchre</div>
        <div class="settings-section">
          <EuchreOptions />
        </div>
      </div>

      <div class="game-section">
        <div class="game-header">President</div>
        <div class="settings-section">
          <PresidentOptions />
        </div>
      </div>

      <div class="game-section">
        <div class="game-header">Spades</div>
        <div class="settings-section">
          <SpadesOptions />
        </div>
      </div>

      <div class="modal-footer">
        <div class="version-info">
          <span class="version-label">Build: {{ buildInfo }}</span>
          <button class="update-btn" @click="checkForUpdates">Check for Updates</button>
        </div>
        <button class="done-btn" @click="emit('close')">Done</button>
      </div>
    </div>
  </Modal>
</template>

<style scoped lang="scss">
.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 480px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  text-align: left;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-lg;
  border-bottom: 1px solid #eee;

  h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #1e4d2b;
  }
}

.close-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
  border-radius: 50%;
  color: #666;

  svg {
    width: 20px;
    height: 20px;
  }

  &:hover {
    background: #e0e0e0;
  }
}

.game-section {
  border-bottom: 1px solid #eee;

  &:last-of-type {
    border-bottom: none;
  }
}

.game-header {
  padding: $spacing-sm $spacing-lg;
  background: #f5f5f5;
  font-size: 0.75rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #888;
}

.settings-section {
  padding: $spacing-md $spacing-lg;

  h3 {
    margin: 0 0 $spacing-xs 0;
    font-size: 1.1rem;
    color: #333;
  }

  .section-desc {
    margin: 0 0 $spacing-md 0;
    font-size: 0.875rem;
    color: #666;
  }
}

.option-buttons {
  display: flex;
  gap: $spacing-sm;
}

.option-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: $spacing-sm $spacing-md;
  background: #f0f0f0;
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #e8e8e8;
  }

  &.active {
    background: rgba(30, 77, 43, 0.15);
  }

  .option-title {
    font-weight: 600;
    font-size: 0.9rem;
    color: #333;
  }

  .option-desc {
    font-size: 0.75rem;
    color: #666;
    margin-top: 2px;
  }
}

.modal-footer {
  padding: $spacing-lg;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #eee;
}

.version-info {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  .version-label {
    font-size: 0.75rem;
    color: #999;
  }

  .update-btn {
    font-size: 0.75rem;
    color: #1e4d2b;
    background: none;
    padding: 0;
    text-decoration: underline;
    cursor: pointer;

    &:hover {
      color: #2a6b3d;
    }
  }
}

.done-btn {
  padding: $spacing-sm $spacing-xl;
  background: #1e4d2b;
  color: white;
  font-weight: bold;
  font-size: 1rem;
  border-radius: 8px;

  &:hover {
    background: #2a6b3d;
  }
}
</style>
