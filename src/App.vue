<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useGameStore } from './stores/gameStore'
import { GamePhase } from './models/types'
import GameBoard from './components/GameBoard.vue'

const gameStore = useGameStore()

const phase = computed(() => gameStore.phase)
const showStartButton = computed(() => phase.value === GamePhase.Setup)

// PWA install prompt
const deferredPrompt = ref<Event | null>(null)
const showInstallPrompt = ref(false)
const isIOS = ref(false)
const isStandalone = ref(false)

onMounted(() => {
  // Check if already installed as PWA
  isStandalone.value = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true

  // Detect iOS
  isIOS.value = /iPad|iPhone|iPod/.test(navigator.userAgent)

  // Don't show if already installed or dismissed recently
  const dismissed = localStorage.getItem('pwa-install-dismissed')
  const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0
  const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24)

  if (!isStandalone.value && daysSinceDismissed > 7) {
    // For Android/Chrome - capture the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredPrompt.value = e
      showInstallPrompt.value = true
    })

    // For iOS - show manual instructions after a delay
    if (isIOS.value) {
      setTimeout(() => {
        showInstallPrompt.value = true
      }, 2000)
    }
  }
})

async function installPWA() {
  if (deferredPrompt.value) {
    const prompt = deferredPrompt.value as any
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      showInstallPrompt.value = false
    }
    deferredPrompt.value = null
  }
}

function dismissInstallPrompt() {
  showInstallPrompt.value = false
  localStorage.setItem('pwa-install-dismissed', Date.now().toString())
}

function startGame() {
  gameStore.startNewGame()
}
</script>

<template>
  <div id="app">
    <!-- Portrait orientation overlay for mobile -->
    <div class="rotate-device-overlay">
      <div class="rotate-content">
        <div class="rotate-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <path d="M12 18h.01" />
          </svg>
          <div class="rotate-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </div>
        </div>
        <p>Please rotate your device to landscape mode</p>
      </div>
    </div>

    <!-- Add to Home Screen prompt -->
    <Transition name="slide-up">
      <div v-if="showInstallPrompt" class="install-prompt">
        <div class="install-content">
          <div class="install-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </div>
          <div class="install-text">
            <strong>Install Euchre</strong>
            <span v-if="isIOS">
              Tap <svg class="inline-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5l-1.42 1.42-1.59-1.59V16h-2V4.83L9.41 6.41 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V10c0-1.1.9-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .9 2 2z"/></svg> then "Add to Home Screen"
            </span>
            <span v-else>Add to home screen for the best experience</span>
          </div>
          <button v-if="!isIOS" class="install-btn" @click="installPWA">Install</button>
          <button class="dismiss-btn" @click="dismissInstallPrompt">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>

    <div v-if="showStartButton" class="start-screen">
      <h1>Euchre</h1>
      <p class="subtitle">Play against 3 AI opponents</p>
      <button class="start-btn" @click="startGame">Start Game</button>
    </div>
    <GameBoard v-else />
  </div>
</template>

<style scoped lang="scss">
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

// Portrait orientation overlay - only shows on mobile portrait
.rotate-device-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%);
  z-index: 9999;
  align-items: center;
  justify-content: center;

  // Only show on mobile devices in portrait mode
  @media (max-width: 768px) and (orientation: portrait) {
    display: flex;
  }
}

.rotate-content {
  text-align: center;
  color: white;
  padding: $spacing-xl;

  p {
    font-size: 1.25rem;
    margin-top: $spacing-lg;
    opacity: 0.9;
  }
}

.rotate-icon {
  position: relative;
  width: 80px;
  height: 100px;
  margin: 0 auto;

  svg {
    width: 80px;
    height: 100px;
    color: white;
    opacity: 0.9;
  }

  .rotate-arrow {
    position: absolute;
    top: -10px;
    right: -30px;
    animation: rotateHint 2s ease-in-out infinite;

    svg {
      width: 40px;
      height: 40px;
      color: $secondary-color;
    }
  }
}

@keyframes rotateHint {
  0%, 100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(20deg);
  }
}

.start-screen {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%);
  color: white;

  h1 {
    font-size: 4rem;
    margin-bottom: $spacing-md;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);

    @media (max-height: 500px) {
      font-size: 2.5rem;
    }
  }

  .subtitle {
    font-size: 1.5rem;
    margin-bottom: $spacing-xl * 2;
    opacity: 0.9;

    @media (max-height: 500px) {
      font-size: 1rem;
      margin-bottom: $spacing-lg;
    }
  }
}

.start-btn {
  padding: $spacing-lg $spacing-xl * 2;
  font-size: 1.5rem;
  font-weight: bold;
  background: white;
  color: #1e4d2b;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);

  @media (max-height: 500px) {
    padding: $spacing-md $spacing-xl;
    font-size: 1.25rem;
  }

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }

  &:active {
    transform: scale(0.95);
  }
}

// Install prompt styles
.install-prompt {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 9998;
  padding: $spacing-sm;

  // Hide on desktop
  @media (min-width: 769px) {
    display: none;
  }
}

.install-content {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  background: rgba(30, 77, 43, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: $spacing-sm $spacing-md;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
}

.install-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  background: $secondary-color;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 20px;
    height: 20px;
    color: white;
    transform: rotate(180deg);
  }
}

.install-text {
  flex: 1;
  color: white;
  font-size: 0.875rem;
  line-height: 1.3;

  strong {
    display: block;
    font-size: 1rem;
    margin-bottom: 2px;
  }

  span {
    opacity: 0.85;
    font-size: 0.8rem;
  }

  .inline-icon {
    width: 16px;
    height: 16px;
    vertical-align: middle;
    margin: 0 2px;
  }
}

.install-btn {
  flex-shrink: 0;
  background: $secondary-color;
  color: white;
  font-weight: bold;
  padding: $spacing-xs $spacing-md;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s ease;

  &:hover {
    background: lighten($secondary-color, 10%);
  }
}

.dismiss-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  opacity: 0.7;
  transition: opacity 0.2s ease;

  svg {
    width: 20px;
    height: 20px;
  }

  &:hover {
    opacity: 1;
  }
}

// Slide up animation
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
