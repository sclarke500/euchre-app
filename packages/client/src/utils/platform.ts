// Platform detection utilities

export interface PlatformInfo {
  isIOS: boolean
  isSafari: boolean
  isChrome: boolean
  isStandalone: boolean // Running as installed PWA
  canInstallPWA: boolean // Shows install prompt (Android/desktop)
}

export function getPlatformInfo(): PlatformInfo {
  const ua = navigator.userAgent

  // iOS detection (iPhone, iPad, iPod, or iPad in desktop mode)
  const isIOS = /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  // On iOS, detect if it's Safari (not Chrome/Firefox/Edge)
  // Chrome on iOS has "CriOS", Firefox has "FxiOS", Edge has "EdgiOS"
  const isIOSChrome = /CriOS/.test(ua)
  const isIOSFirefox = /FxiOS/.test(ua)
  const isIOSEdge = /EdgiOS/.test(ua)
  const isSafari = isIOS && !isIOSChrome && !isIOSFirefox && !isIOSEdge

  // Chrome detection (desktop or iOS)
  const isChrome = /Chrome/.test(ua) || isIOSChrome

  // Check if running as installed PWA (standalone mode)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true

  // Can show install prompt (Android/desktop Chrome, not iOS)
  const canInstallPWA = !isIOS && 'BeforeInstallPromptEvent' in window

  return {
    isIOS,
    isSafari,
    isChrome,
    isStandalone,
    canInstallPWA,
  }
}

export function shouldShowIOSInstallHint(): boolean {
  const { isIOS, isSafari, isStandalone } = getPlatformInfo()
  // Show hint if on iOS Safari and not already installed as PWA
  return isIOS && isSafari && !isStandalone
}

export function shouldShowIOSSafariWarning(): boolean {
  const { isIOS, isSafari, isStandalone } = getPlatformInfo()
  // Show warning if on iOS but NOT in Safari (and not already a PWA)
  return isIOS && !isSafari && !isStandalone
}
