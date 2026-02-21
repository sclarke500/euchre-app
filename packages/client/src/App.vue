<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppToast from './components/AppToast.vue'

const route = useRoute()

// Routes that require landscape orientation
const landscapeRoutes = ['/play', '/lobby', '/game']

// Track landscape orientation
const isLandscape = ref(true)

function updateOrientation() {
  isLandscape.value = window.innerWidth > window.innerHeight
}

// Track if current view has been initialized in landscape
const hasInitializedInLandscape = ref(false)

// Check if current route requires landscape
const requiresLandscape = computed(() => {
  const path = route.path
  // Klondike doesn't require landscape
  if (path === '/play/klondike') return false
  return landscapeRoutes.some(r => path.startsWith(r))
})

// Show landscape blocker when in portrait on landscape-required routes
const showLandscapeBlocker = computed(() => {
  return requiresLandscape.value && !isLandscape.value
})

// Render landscape-required views once initialized in landscape
const canRenderView = computed(() => {
  if (!requiresLandscape.value) return true
  if (hasInitializedInLandscape.value) return true
  return isLandscape.value
})

// Initialize when in landscape on landscape-required route
watch([isLandscape, () => route.path], ([landscape, path]) => {
  if (landscape && landscapeRoutes.some(r => path.startsWith(r))) {
    hasInitializedInLandscape.value = true
  }
}, { immediate: true })

// Reset initialization when leaving landscape-required routes
watch(() => route.path, (newPath, oldPath) => {
  const wasLandscapeRoute = landscapeRoutes.some(r => oldPath?.startsWith(r))
  const isLandscapeRoute = landscapeRoutes.some(r => newPath.startsWith(r))
  if (wasLandscapeRoute && !isLandscapeRoute) {
    hasInitializedInLandscape.value = false
  }
})

// PWA install prompt
const deferredPrompt = ref<Event | null>(null)
const showInstallPrompt = ref(false)
const showOpenInAppPrompt = ref(false)
const isIOS = ref(false)
const isStandalone = ref(false)
const isAppInstalled = ref(false)

// Capture beforeinstallprompt immediately
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e
    console.log('PWA: beforeinstallprompt captured')
  })
}

onMounted(async () => {
  updateOrientation()
  window.addEventListener('resize', updateOrientation)
  
  // Check if running as installed PWA
  isStandalone.value = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true

  if (isStandalone.value) {
    localStorage.setItem('pwa-installed', 'true')
    console.log('PWA: Running in standalone mode')
    return
  }

  isIOS.value = /iPad|iPhone|iPod/.test(navigator.userAgent)
  console.log('PWA: iOS detected:', isIOS.value)

  const wasInstalled = localStorage.getItem('pwa-installed') === 'true'

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

  if (wasInstalled || isAppInstalled.value) {
    const openDismissed = localStorage.getItem('pwa-open-dismissed')
    const openDismissedTime = openDismissed ? parseInt(openDismissed, 10) : 0
    const hoursSinceDismissed = (Date.now() - openDismissedTime) / (1000 * 60 * 60)

    if (hoursSinceDismissed > 24) {
      showOpenInAppPrompt.value = true
    }
    return
  }

  const dismissed = localStorage.getItem('pwa-install-dismissed')
  const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0
  const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24)

  console.log('PWA: Days since dismissed:', daysSinceDismissed, 'Has deferred prompt:', !!deferredPrompt.value)

  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  
  if (daysSinceDismissed > 7 && isMobile) {
    setTimeout(() => {
      if (deferredPrompt.value) {
        console.log('PWA: Showing install prompt (Android/Chrome)')
        showInstallPrompt.value = true
      } else if (isIOS.value) {
        console.log('PWA: Showing install instructions (iOS)')
        showInstallPrompt.value = true
      } else {
        console.log('PWA: No prompt available - Chrome requires 2+ visits with 5min between')
      }
    }, 2000)
  } else if (!isMobile) {
    console.log('PWA: Skipping install prompt on desktop')
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateOrientation)
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
</script>

<template>
  <div id="app">
    <AppToast />

    <!-- Portrait orientation overlay -->
    <div v-if="showLandscapeBlocker" class="rotate-device-overlay">
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

    <!-- Router View - only render when allowed (landscape check) -->
    <router-view v-if="canRenderView" />
  </div>
</template>

<style scoped lang="scss">
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: linear-gradient(135deg, $home-gradient-top 0%, $home-gradient-bottom 100%);
}

.rotate-device-overlay {
  display: flex;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, $home-gradient-top 0%, $home-gradient-bottom 100%);
  z-index: 9999;
  align-items: center;
  justify-content: center;
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
    animation: rotateHint var(--anim-pulse) ease-in-out infinite;

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

.install-prompt {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 9998;
  padding: $spacing-sm;

  @media (min-width: 769px) {
    display: none;
  }
}

.install-content {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  background: rgba($brand-green, 0.95);
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
}

.dismiss-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  opacity: 0.8;

  svg {
    width: 20px;
    height: 20px;
  }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all var(--anim-medium) ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
