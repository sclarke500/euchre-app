<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useSettingsStore, type AIDifficulty } from '@/stores/settingsStore'
import EuchreOptions from '@/games/euchre/EuchreOptions.vue'
import PresidentOptions from '@/games/president/PresidentOptions.vue'
import SpadesOptions from '@/games/spades/SpadesOptions.vue'
import BugReportModal from '@/components/BugReportModal.vue'
import { usePWAInstall, triggerInstall } from '@/composables/usePWAInstall'

const route = useRoute()

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const settings = useSettingsStore()
const { isStandalone, isIOS, canInstallNatively, deviceType } = usePWAInstall()

// Show install option if not running as PWA
const showInstallOption = computed(() => !isStandalone.value)

// Show install instructions modal
const showInstallInstructions = ref(false)

// Bug report modal
const showBugReport = ref(false)

function buildBugPayload() {
  return {
    context: 'settings',
    route: route.fullPath,
    deviceType: deviceType.value,
  }
}

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

async function handleInstallClick() {
  if (canInstallNatively.value) {
    // Android/Chrome - trigger native prompt
    const result = await triggerInstall()
    if (result === 'accepted') {
      // App installed, option will hide automatically via isStandalone
    }
  } else {
    // iOS or desktop - show instructions
    showInstallInstructions.value = true
  }
}

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

              <!-- Install App (only if not running as PWA) -->
              <div v-if="showInstallOption" class="section">
                <h2>App</h2>
                <button class="install-app-btn" @click="handleInstallClick">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Install App
                </button>
                <p class="install-hint">Add to home screen for the best experience</p>
              </div>

              <div class="section about-section">
                <h2>About</h2>
                <div class="about-row">
                  <span class="about-label">Build</span>
                  <span class="about-value">{{ buildInfo }}</span>
                </div>
                <div class="about-buttons">
                  <button class="about-btn" @click="checkForUpdates">
                    Check for Updates
                  </button>
                  <button class="about-btn bug-btn" @click="showBugReport = true">
                    🐛 Report Bug
                  </button>
                </div>
              </div>
            </div>
          </div>
      </div>
      
      <!-- Install Instructions Modal -->
      <Transition name="fade">
        <div v-if="showInstallInstructions" class="instructions-overlay" @click.self="showInstallInstructions = false">
          <div class="instructions-modal">
            <button class="close-btn" @click="showInstallInstructions = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            
            <h2>Install 6|7 Card Games</h2>
            
            <!-- iOS Instructions -->
            <div v-if="isIOS" class="instructions-content">
              <div class="step">
                <span class="step-num">1</span>
                <span>Tap the <strong>Share</strong> button</span>
                <svg class="share-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 5l-1.42 1.42-1.59-1.59V16h-2V4.83L9.41 6.41 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V10c0-1.1.9-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .9 2 2z"/>
                </svg>
              </div>
              <div class="step">
                <span class="step-num">2</span>
                <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
              </div>
              <div class="step">
                <span class="step-num">3</span>
                <span>Tap <strong>"Add"</strong> to confirm</span>
              </div>
            </div>
            
            <!-- Desktop/Other Instructions -->
            <div v-else class="instructions-content">
              <div class="step">
                <span class="step-num">1</span>
                <span>Look for the <strong>install icon</strong> in your browser's address bar</span>
              </div>
              <div class="step">
                <span class="step-num">2</span>
                <span>Or open the browser menu (⋮) and select <strong>"Install app"</strong></span>
              </div>
              <div class="step">
                <span class="step-num">3</span>
                <span>Click <strong>"Install"</strong> when prompted</span>
              </div>
              <p class="note">Note: Some browsers may require visiting the site a few times before the install option appears.</p>
            </div>
          </div>
        </div>
      </Transition>
      
      <!-- Bug Report Modal -->
      <BugReportModal
        :show="showBugReport"
        game-type="general"
        mode="singleplayer"
        :build-payload="buildBugPayload"
        @close="showBugReport = false"
      />
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

.about-buttons {
  display: flex;
  gap: $spacing-sm;
  margin-top: $spacing-md;
}

.about-btn {
  flex: 1;
  padding: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
  font-weight: 500;
  font-size: 0.85rem;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  &.bug-btn {
    background: rgba(255, 100, 100, 0.15);
    
    &:hover {
      background: rgba(255, 100, 100, 0.25);
    }
  }
}

.install-app-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  width: 100%;
  padding: $spacing-sm $spacing-md;
  background: $brand-green;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  font-size: 0.95rem;
  
  svg {
    width: 20px;
    height: 20px;
  }
  
  &:hover {
    background: $brand-green-light;
  }
}

.install-hint {
  margin-top: $spacing-xs;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
}

// Install Instructions Modal
.instructions-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-lg;
}

.instructions-modal {
  position: relative;
  background: linear-gradient(135deg, $home-gradient-top 0%, $home-gradient-bottom 100%);
  border-radius: 16px;
  padding: $spacing-xl;
  max-width: 400px;
  width: 100%;
  color: white;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  
  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: $spacing-lg;
    text-align: center;
  }
  
  .close-btn {
    position: absolute;
    top: $spacing-md;
    right: $spacing-md;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    color: white;
    
    svg {
      width: 18px;
      height: 18px;
    }
    
    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }
}

.instructions-content {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.step {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  font-size: 0.95rem;
  
  .step-num {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    background: $brand-green;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.85rem;
  }
  
  .share-icon {
    width: 20px;
    height: 20px;
    margin-left: $spacing-xs;
    color: $secondary-color;
  }
}

.note {
  margin-top: $spacing-md;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  font-style: italic;
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

// Fade transition for modal
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
