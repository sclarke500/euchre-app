<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppToast from './components/AppToast.vue'
import ScaledContainer from './components/ScaledContainer.vue'
import LegalModal from './components/legal/LegalModal.vue'
import { isNativeApp } from './utils/native'
import { lockLandscape, unlockOrientation } from './utils/orientation'
import { useAppRenderMode, LANDSCAPE_ROUTE_PREFIXES } from './composables/useAppRenderMode'
import {
  usePWAInstall,
  initPWAInstall,
  shouldShowInstallPrompt,
  shouldShowOpenInAppPrompt,
  triggerInstall,
  dismissInstallPrompt as dismissInstall,
  dismissOpenInAppPrompt as dismissOpenInApp,
} from './composables/usePWAInstall'

const route = useRoute()
const { isStandalone, isIOS, canInstallNatively } = usePWAInstall()
const { useScaledContainer, isScrollable, requiresLandscape } = useAppRenderMode()

watch(isScrollable, (scrollable) => {
  if (scrollable) {
    document.documentElement.classList.add('scrollable')
  } else {
    document.documentElement.classList.remove('scrollable')
  }
}, { immediate: true })

const isLandscape = ref(true)

function checkLandscape(): boolean {
  const byDimensions = window.innerWidth > window.innerHeight
  const byMediaQuery = window.matchMedia('(orientation: landscape)').matches
  return byDimensions || byMediaQuery
}

function updateOrientation() {
  isLandscape.value = checkLandscape()
}

const hasInitializedInLandscape = ref(false)

const showLandscapeBlocker = computed(() => {
  return requiresLandscape.value && !isLandscape.value && !isNativeApp()
})

const canRenderView = computed(() => {
  if (!requiresLandscape.value) return true
  if (isNativeApp()) return true
  if (hasInitializedInLandscape.value) return true
  return isLandscape.value
})

watch(requiresLandscape, (needsLandscape) => {
  if (needsLandscape) {
    lockLandscape()
  } else {
    unlockOrientation()
  }
}, { immediate: true })

watch([isLandscape, () => route.path], ([landscape, path]) => {
  if (landscape && LANDSCAPE_ROUTE_PREFIXES.some((r) => path.startsWith(r))) {
    hasInitializedInLandscape.value = true
  }
}, { immediate: true })

watch(() => route.path, (newPath, oldPath) => {
  const wasLandscapeRoute = LANDSCAPE_ROUTE_PREFIXES.some((r) => oldPath?.startsWith(r))
  const isLandscapeRoute = LANDSCAPE_ROUTE_PREFIXES.some((r) => newPath.startsWith(r))
  if (wasLandscapeRoute && !isLandscapeRoute) {
    hasInitializedInLandscape.value = false
  }
})

const showInstallPrompt = ref(false)
const showOpenInAppPrompt = ref(false)

onMounted(async () => {
  updateOrientation()
  window.addEventListener('resize', updateOrientation)

  await initPWAInstall()

  if (isStandalone.value) return

  if (shouldShowOpenInAppPrompt()) {
    showOpenInAppPrompt.value = true
    return
  }

  if (shouldShowInstallPrompt()) {
    setTimeout(() => {
      if (shouldShowInstallPrompt()) {
        if (canInstallNatively.value || isIOS.value) {
          console.log('PWA: Showing install prompt')
          showInstallPrompt.value = true
        } else {
          console.log('PWA: No prompt available - Chrome requires 2+ visits with 5min between')
        }
      }
    }, 2000)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateOrientation)
  unlockOrientation()
})

async function installPWA() {
  const result = await triggerInstall()
  if (result === 'accepted') {
    showInstallPrompt.value = false
  }
}

function dismissInstallPrompt() {
  showInstallPrompt.value = false
  dismissInstall()
}

function dismissOpenInAppPrompt() {
  showOpenInAppPrompt.value = false
  dismissOpenInApp()
}
</script>

<template>
  <div id="app" :class="{ scrollable: isScrollable }">
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

    <!-- Open in installed app prompt (not on landing page) -->
    <Transition name="slide-up">
      <div v-if="showOpenInAppPrompt && !isScrollable" class="install-prompt open-in-app">
        <div class="install-content">
          <div class="install-icon app-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 12h6M12 9v6" />
            </svg>
          </div>
          <div class="install-text">
            <strong>Open in App</strong>
            <span>You have 67 Cards installed! Open from your home screen for the best experience.</span>
          </div>
          <button class="dismiss-btn" @click="dismissOpenInAppPrompt">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Add to Home Screen prompt (not on landing page) -->
    <Transition name="slide-up">
      <div v-if="showInstallPrompt && !isScrollable" class="install-prompt">
        <div class="install-content">
          <div class="install-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </div>
          <div class="install-text">
            <span class="install-subtitle">For fullscreen experience</span>
            <strong>Install 67 Card Games</strong>
            <span v-if="isIOS">
              Tap <svg class="inline-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5l-1.42 1.42-1.59-1.59V16h-2V4.83L9.41 6.41 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V10c0-1.1.9-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .9 2 2z"/></svg> then "Add to Home Screen"
            </span>
            <span v-else>Add to home screen</span>
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

    <ScaledContainer v-if="canRenderView && useScaledContainer">
      <router-view />
    </ScaledContainer>

    <router-view v-else-if="canRenderView" />

    <LegalModal />
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

  .install-subtitle {
    display: block;
    font-size: 0.7rem;
    opacity: 0.7;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }

  strong {
    display: block;
    font-size: 1rem;
    margin-bottom: 2px;
  }

  span:not(.install-subtitle) {
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