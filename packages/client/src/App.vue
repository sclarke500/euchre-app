<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useGameStore } from './stores/gameStore'
import { usePresidentGameStore } from './stores/presidentGameStore'
import { useLobbyStore } from './stores/lobbyStore'
import { GamePhase } from '@euchre/shared'
import UnifiedGameBoard from './components/UnifiedGameBoard.vue'
import PresidentGameBoard from './components/president/PresidentGameBoard.vue'
import MainMenu, { type GameType } from './components/MainMenu.vue'
import Lobby from './components/Lobby.vue'

const gameStore = useGameStore()
const presidentStore = usePresidentGameStore()
const lobbyStore = useLobbyStore()

// App view state
type AppView = 'menu' | 'euchreSinglePlayer' | 'presidentSinglePlayer' | 'lobby' | 'multiplayerGame'
const currentView = ref<AppView>('menu')
const currentGame = ref<GameType>('euchre')

const phase = computed(() => gameStore.phase)

// PWA install prompt
const deferredPrompt = ref<Event | null>(null)
const showInstallPrompt = ref(false)
const showOpenInAppPrompt = ref(false)
const isIOS = ref(false)
const isStandalone = ref(false)
const isAppInstalled = ref(false)

// IMPORTANT: Capture beforeinstallprompt immediately - it fires early and only once per page load
// Must be set up before onMounted to avoid missing the event
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e
    console.log('PWA: beforeinstallprompt captured')
  })
}

onMounted(async () => {
  // Check if running as installed PWA
  isStandalone.value = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true

  // If running standalone, mark as installed for future browser visits
  if (isStandalone.value) {
    localStorage.setItem('pwa-installed', 'true')
    console.log('PWA: Running in standalone mode')
    return // Don't show any prompts when running as PWA
  }

  // Detect iOS
  isIOS.value = /iPad|iPhone|iPod/.test(navigator.userAgent)
  console.log('PWA: iOS detected:', isIOS.value)

  // Check if app was previously installed
  const wasInstalled = localStorage.getItem('pwa-installed') === 'true'

  // Also check using getInstalledRelatedApps API (Chrome on Android)
  if ('getInstalledRelatedApps' in navigator) {
    try {
      const relatedApps = await (navigator as any).getInstalledRelatedApps()
      if (relatedApps.length > 0) {
        isAppInstalled.value = true
        console.log('PWA: App detected as installed via getInstalledRelatedApps')
      }
    } catch {
      // API not supported or failed
    }
  }

  // If we know it's installed, show "open in app" prompt
  if (wasInstalled || isAppInstalled.value) {
    const openDismissed = localStorage.getItem('pwa-open-dismissed')
    const openDismissedTime = openDismissed ? parseInt(openDismissed, 10) : 0
    const hoursSinceDismissed = (Date.now() - openDismissedTime) / (1000 * 60 * 60)

    // Show again after 24 hours
    if (hoursSinceDismissed > 24) {
      showOpenInAppPrompt.value = true
    }
    return // Don't show install prompt if already installed
  }

  // For users who haven't installed - check dismissal time
  const dismissed = localStorage.getItem('pwa-install-dismissed')
  const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0
  const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24)

  console.log('PWA: Days since dismissed:', daysSinceDismissed, 'Has deferred prompt:', !!deferredPrompt.value)

  if (daysSinceDismissed > 7) {
    // Show prompt after a brief delay
    setTimeout(() => {
      // For Android/Chrome - show if we have the deferred prompt
      if (deferredPrompt.value) {
        console.log('PWA: Showing install prompt (Android/Chrome)')
        showInstallPrompt.value = true
      }
      // For iOS - always show manual instructions
      else if (isIOS.value) {
        console.log('PWA: Showing install instructions (iOS)')
        showInstallPrompt.value = true
      } else {
        console.log('PWA: No prompt available - Chrome requires 2+ visits with 5min between')
      }
    }, 2000)
  }
})

// Watch for multiplayer game start
watch(() => lobbyStore.gameId, (gameId) => {
  if (gameId) {
    currentView.value = 'multiplayerGame'
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

function dismissOpenInAppPrompt() {
  showOpenInAppPrompt.value = false
  localStorage.setItem('pwa-open-dismissed', Date.now().toString())
}

function startSinglePlayer(game: GameType) {
  currentGame.value = game
  if (game === 'president') {
    currentView.value = 'presidentSinglePlayer'
    presidentStore.startNewGame(4)
  } else {
    currentView.value = 'euchreSinglePlayer'
    gameStore.startNewGame()
  }
}

function enterMultiplayer(game: GameType) {
  currentGame.value = game
  currentView.value = 'lobby'
}

function backToMenu() {
  currentView.value = 'menu'
  lobbyStore.disconnect()
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

    <!-- Open in installed app prompt -->
    <Transition name="slide-up">
      <div v-if="showOpenInAppPrompt" class="install-prompt open-in-app">
        <div class="install-content">
          <div class="install-icon app-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 12h6M12 9v6" />
            </svg>
          </div>
          <div class="install-text">
            <strong>Open in App</strong>
            <span>You have Euchre installed! Open from your home screen for the best experience.</span>
          </div>
          <button class="dismiss-btn" @click="dismissOpenInAppPrompt">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>

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

    <!-- Main Menu -->
    <MainMenu
      v-if="currentView === 'menu'"
      @start-single-player="startSinglePlayer"
      @enter-multiplayer="enterMultiplayer"
    />

    <!-- Euchre Single Player Game -->
    <UnifiedGameBoard
      v-else-if="currentView === 'euchreSinglePlayer'"
      mode="singleplayer"
      @leave-game="currentView = 'menu'"
    />

    <!-- President Single Player Game -->
    <PresidentGameBoard
      v-else-if="currentView === 'presidentSinglePlayer'"
      @leave-game="currentView = 'menu'"
    />

    <!-- Multiplayer Lobby -->
    <Lobby
      v-else-if="currentView === 'lobby'"
      @back="backToMenu"
    />

    <!-- Multiplayer Game -->
    <UnifiedGameBoard
      v-else-if="currentView === 'multiplayerGame'"
      mode="multiplayer"
      @leave-game="lobbyStore.leaveGame(); currentView = 'lobby'"
    />
  </div>
</template>

<style scoped lang="scss">
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;

  // Scale down for very small landscape screens (iPhone SE, etc.)
  // Design target: ~850px width (iPhone 15 landscape)
  // iPhone SE landscape: 667px width = ~78% of target
  @media (max-height: 400px) and (orientation: landscape) {
    transform: scale(0.85);
    transform-origin: top left;
    width: calc(100% / 0.85);
    height: calc(100% / 0.85);
  }
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

.multiplayer-game {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%);
  color: white;
  gap: $spacing-md;

  button {
    padding: $spacing-sm $spacing-lg;
    background: white;
    color: #1e4d2b;
    font-weight: bold;
    border-radius: 8px;
    cursor: pointer;

    &:hover {
      transform: scale(1.05);
    }
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

  &.app-icon svg {
    transform: none;
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
    background: color-mix(in srgb, $secondary-color 90%, white 10%);
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
