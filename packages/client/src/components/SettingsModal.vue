<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore, type AIDifficulty, type DealerPassRule } from '@/stores/settingsStore'

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

function selectDealerRule(rule: DealerPassRule) {
  settings.setDealerPassRule(rule)
}

function checkForUpdates() {
  window.location.reload()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="modal-backdrop" @click.self="emit('close')">
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
              <h3>Dealer Rules</h3>
              <p class="section-desc">What happens if no one calls trump in round 2</p>
              <div class="option-buttons">
                <button
                  :class="['option-btn', { active: settings.dealerPassRule === 'canPass' }]"
                  @click="selectDealerRule('canPass')"
                >
                  <span class="option-title">Dealer Can Pass</span>
                  <span class="option-desc">Hand is thrown in, cards redealt</span>
                </button>
                <button
                  :class="['option-btn', { active: settings.dealerPassRule === 'stickTheDealer' }]"
                  @click="selectDealerRule('stickTheDealer')"
                >
                  <span class="option-title">Stick the Dealer</span>
                  <span class="option-desc">Dealer must call a suit</span>
                </button>
              </div>
            </div>
          </div>

          <div class="game-section">
            <div class="game-header">President</div>

            <div class="settings-section">
              <h3>Special Cards</h3>
              <p class="section-desc">Optional rules for 2s and Jokers</p>
              <div class="option-buttons">
                <button
                  :class="['option-btn', { active: !settings.superTwosAndJokers }]"
                  @click="settings.setSuperTwosAndJokers(false)"
                >
                  <span class="option-title">Standard Rules</span>
                  <span class="option-desc">2s are highest, no jokers (2 twos beat 2 aces)</span>
                </button>
                <button
                  :class="['option-btn', { active: settings.superTwosAndJokers }]"
                  @click="settings.setSuperTwosAndJokers(true)"
                >
                  <span class="option-title">Super 2s &amp; Jokers</span>
                  <span class="option-desc">Jokers beat all, 2 twos beat 3 aces</span>
                </button>
              </div>
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
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: $spacing-md;
}

.modal-content {
  background: white;
  border-radius: 16px;
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
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
  flex-direction: column;
  gap: $spacing-sm;
}

.option-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: $spacing-md;
  background: #f8f8f8;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  text-align: left;
  cursor: pointer;
  transition: all var(--anim-fast) ease;

  &:hover {
    background: #f0f0f0;
    border-color: #ccc;
  }

  &.active {
    background: rgba(30, 77, 43, 0.1);
    border-color: #1e4d2b;
  }

  .option-title {
    font-weight: bold;
    font-size: 1rem;
    color: #333;
  }

  .option-desc {
    font-size: 0.8rem;
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

// Fade transition
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--anim-fast) ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
