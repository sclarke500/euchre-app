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
@use '@/assets/styles/modal-light' as *;

.modal-content {
  @include modal-panel;
  max-width: 480px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  text-align: left;
}

.modal-header {
  @include modal-header;

  h2 {
    @include modal-title;
    margin: 0;
    color: $modal-primary;
  }
}

.close-btn {
  @include modal-close-btn;
}

.game-section {
  border-bottom: 1px solid $modal-border;

  &:last-of-type {
    border-bottom: none;
  }
}

.game-header {
  @include modal-section-title;
  padding: $spacing-sm $spacing-lg;
  background: $modal-bg-subtle;
  margin: 0;
}

.settings-section {
  padding: $spacing-md $spacing-lg;

  h3 {
    @include modal-label;
    font-size: 1rem;
    margin-bottom: $spacing-xs;
  }

  .section-desc {
    @include modal-help-text;
    margin: 0 0 $spacing-md 0;
  }
}

.option-buttons {
  display: flex;
  gap: $spacing-sm;
}

.option-btn {
  @include modal-option-card;
  flex: 1;

  .option-title {
    @include modal-option-title;
  }

  .option-desc {
    @include modal-option-desc;
  }
}

.modal-footer {
  @include modal-footer;
  justify-content: space-between;
}

.version-info {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  .version-label {
    font-size: 0.75rem;
    color: $modal-text-muted;
  }

  .update-btn {
    @include modal-btn-link;
    font-size: 0.75rem;
  }
}

.done-btn {
  @include modal-btn-primary;
}
</style>
