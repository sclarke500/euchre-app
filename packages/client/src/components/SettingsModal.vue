<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore, type AIDifficulty } from '@/stores/settingsStore'
import EuchreOptions from '@/games/euchre/EuchreOptions.vue'
import PresidentOptions from '@/games/president/PresidentOptions.vue'
import SpadesOptions from '@/games/spades/SpadesOptions.vue'

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

// Bot remarks: off / mild / spicy (maps to botChatEnabled + aiChatMode)
type BotRemarksLevel = 'off' | 'mild' | 'spicy'
const botRemarks = computed<BotRemarksLevel>({
  get: () => {
    if (!settings.botChatEnabled) return 'off'
    return settings.aiChatMode === 'unhinged' ? 'spicy' : 'mild'
  },
  set: (val) => {
    if (val === 'off') {
      settings.setBotChatEnabled(false)
    } else {
      settings.setBotChatEnabled(true)
      settings.setAIChatMode(val === 'spicy' ? 'unhinged' : 'clean')
    }
  }
})

function checkForUpdates() {
  window.location.reload()
}
</script>

<template>
  <Transition name="slide">
    <div v-if="show" class="settings-overlay">
      <div class="settings-content">
          <header class="header">
            <h1>Settings</h1>
            <button class="close-btn" @click="emit('close')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div class="two-column">
            <!-- Left Column: Game Options -->
            <div class="column">
              <div class="section">
                <h2>Euchre</h2>
                <div class="game-options">
                  <EuchreOptions />
                </div>
              </div>

              <div class="section">
                <h2>President</h2>
                <div class="game-options">
                  <PresidentOptions />
                </div>
              </div>

              <div class="section">
                <h2>Spades</h2>
                <div class="game-options">
                  <SpadesOptions />
                </div>
              </div>
            </div>

            <!-- Right Column: Bots + About -->
            <div class="column">
              <div class="section">
                <h2>Bots</h2>
                <div class="option-row">
                  <span class="option-label">Difficulty</span>
                  <div class="option-pills">
                    <button
                      :class="['pill', { active: settings.aiDifficulty === 'easy' }]"
                      @click="settings.setAIDifficulty('easy')"
                    >
                      Easy
                    </button>
                    <button
                      :class="['pill', { active: settings.aiDifficulty === 'hard' }]"
                      @click="settings.setAIDifficulty('hard')"
                    >
                      Hard
                    </button>
                  </div>
                </div>
                <div class="option-row">
                  <span class="option-label">Remarks</span>
                  <div class="option-pills">
                    <button
                      :class="['pill', { active: botRemarks === 'off' }]"
                      @click="botRemarks = 'off'"
                    >
                      Off
                    </button>
                    <button
                      :class="['pill', { active: botRemarks === 'mild' }]"
                      @click="botRemarks = 'mild'"
                    >
                      Mild
                    </button>
                    <button
                      :class="['pill', { active: botRemarks === 'spicy' }]"
                      @click="botRemarks = 'spicy'"
                    >
                      Spicy
                    </button>
                  </div>
                </div>
              </div>

              <div class="section about-section">
                <h2>About</h2>
                <div class="about-row">
                  <span class="about-label">Build</span>
                  <span class="about-value">{{ buildInfo }}</span>
                </div>
                <button class="update-btn" @click="checkForUpdates">
                  Check for Updates
                </button>
              </div>
            </div>
          </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.settings-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: linear-gradient(135deg, $home-gradient-top 0%, $home-gradient-bottom 100%);
  color: white;
  overflow-y: auto;
}

.settings-content {
  width: 100%;
  height: 100%;
  padding: $spacing-lg;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-lg;
  flex-shrink: 0;

  h1 {
    font-size: 1.25rem;
    font-weight: 600;
  }
}

.close-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  color: white;

  svg {
    width: 24px;
    height: 24px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

.two-column {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-xl;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
}

.column {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.section {
  h2 {
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
    margin-bottom: $spacing-sm;
  }
}

.option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  padding: $spacing-xs 0;
}

.option-label {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.option-pills {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 2px;
}

.pill {
  padding: $spacing-xs $spacing-sm;
  background: transparent;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.15s ease;

  &:hover {
    color: white;
  }

  &.active {
    background: $brand-green;
    color: white;
  }
}

// Game options - same dark styling
.game-options {
  :deep(.compact-options) {
    gap: $spacing-md;
  }
  
  :deep(.option-row) {
    padding: $spacing-xs 0;
  }
  
  :deep(.option-label) {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.9);
  }
  
  :deep(.toggle-group),
  :deep(.count-group) {
    display: flex;
    gap: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 2px;
  }
  
  :deep(.toggle-btn),
  :deep(.count-pill) {
    padding: $spacing-xs $spacing-sm;
    background: transparent;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.85rem;
    font-weight: 500;
    width: auto;
    height: auto;
    
    &:hover {
      color: white;
    }
    
    &.active {
      background: $brand-green;
      color: white;
      box-shadow: none;
    }
  }
}

.about-section {
  margin-top: auto;
}

.about-row {
  display: flex;
  justify-content: space-between;
  padding: $spacing-xs 0;
  
  .about-label {
    color: rgba(255, 255, 255, 0.6);
  }
  
  .about-value {
    color: rgba(255, 255, 255, 0.9);
  }
}

.update-btn {
  margin-top: $spacing-md;
  padding: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
  font-weight: 500;
  width: 100%;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

// Slide transition
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
