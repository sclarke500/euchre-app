/**
 * PWA Install composable
 * Manages install prompt state and device detection for PWA install UX
 */
import { ref, computed } from 'vue'

// Shared state (singleton)
const deferredPrompt = ref<any>(null)
const isStandalone = ref(false)
const isIOS = ref(false)
const isAppInstalled = ref(false)
const initialized = ref(false)

// Device type detection
export type DeviceType = 'phone' | 'tablet' | 'desktop'

function detectDeviceType(): DeviceType {
  const ua = navigator.userAgent
  const isMobileUA = /Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const isTabletUA = /iPad/i.test(ua) || (isMobileUA && window.innerWidth >= 768)
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  
  // iPad detection (iPadOS 13+ reports as Mac)
  const isIPad = /iPad/i.test(ua) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  
  if (isIPad || isTabletUA) return 'tablet'
  if (isMobileUA) return 'phone'
  if (isTouchDevice && window.innerWidth >= 768 && window.innerWidth <= 1024) return 'tablet'
  
  return 'desktop'
}

const deviceType = ref<DeviceType>('desktop')

// Capture beforeinstallprompt immediately (runs at module load)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e
    console.log('PWA: beforeinstallprompt captured')
  })
}

/**
 * Initialize PWA detection (call once on app mount)
 */
export async function initPWAInstall() {
  if (initialized.value) return
  initialized.value = true
  
  deviceType.value = detectDeviceType()
  console.log('PWA: Device type:', deviceType.value)
  
  // Check if running as installed PWA
  isStandalone.value = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true

  if (isStandalone.value) {
    localStorage.setItem('pwa-installed', 'true')
    console.log('PWA: Running in standalone mode')
    return
  }

  isIOS.value = /iPad|iPhone|iPod/.test(navigator.userAgent)

  // Check if app was previously installed
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

  if (wasInstalled && !isAppInstalled.value) {
    // Previously installed but getInstalledRelatedApps didn't find it
    // Might be uninstalled, or API not supported
    isAppInstalled.value = wasInstalled
  }
}

/**
 * Check if we should show install prompt based on device and timing
 */
export function shouldShowInstallPrompt(): boolean {
  // Never prompt if already standalone
  if (isStandalone.value) return false
  
  // If app is installed, don't show install prompt (maybe show "open in app")
  if (isAppInstalled.value) return false
  
  const dismissed = localStorage.getItem('pwa-install-dismissed')
  const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0
  const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24)
  
  switch (deviceType.value) {
    case 'phone':
      // Phone: Show every session (only respect dismissal for 1 hour to avoid spam on same session)
      const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60)
      return hoursSinceDismissed > 1
      
    case 'tablet':
      // Tablet: Once a week
      return daysSinceDismissed > 7
      
    case 'desktop':
      // Desktop: Never auto-prompt
      return false
  }
}

/**
 * Check if we should show "Open in App" prompt
 */
export function shouldShowOpenInAppPrompt(): boolean {
  if (isStandalone.value) return false
  if (!isAppInstalled.value) return false
  
  const openDismissed = localStorage.getItem('pwa-open-dismissed')
  const openDismissedTime = openDismissed ? parseInt(openDismissed, 10) : 0
  const hoursSinceDismissed = (Date.now() - openDismissedTime) / (1000 * 60 * 60)
  
  return hoursSinceDismissed > 24
}

/**
 * Trigger native install prompt (Android/Chrome) or return false if not available
 */
export async function triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt.value) {
    return 'unavailable'
  }
  
  const prompt = deferredPrompt.value
  prompt.prompt()
  const { outcome } = await prompt.userChoice
  
  if (outcome === 'accepted') {
    deferredPrompt.value = null
    localStorage.setItem('pwa-installed', 'true')
  }
  
  return outcome
}

/**
 * Dismiss install prompt (saves timestamp)
 */
export function dismissInstallPrompt() {
  localStorage.setItem('pwa-install-dismissed', Date.now().toString())
}

/**
 * Dismiss "open in app" prompt (saves timestamp)
 */
export function dismissOpenInAppPrompt() {
  localStorage.setItem('pwa-open-dismissed', Date.now().toString())
}

/**
 * Composable for reactive PWA state
 */
export function usePWAInstall() {
  const canInstallNatively = computed(() => !!deferredPrompt.value)
  const needsManualInstall = computed(() => isIOS.value || (!deferredPrompt.value && deviceType.value !== 'desktop'))
  const showInSettings = computed(() => !isStandalone.value)
  
  return {
    // State
    isStandalone,
    isIOS,
    isAppInstalled,
    deviceType,
    canInstallNatively,
    needsManualInstall,
    showInSettings,
    
    // Actions
    initPWAInstall,
    shouldShowInstallPrompt,
    shouldShowOpenInAppPrompt,
    triggerInstall,
    dismissInstallPrompt,
    dismissOpenInAppPrompt,
  }
}
