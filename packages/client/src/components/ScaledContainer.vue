<script setup lang="ts">
/**
 * ScaledContainer - Unified scaling for all devices
 * 
 * In FULL mode (tablet/desktop):
 * - Canonical size: 1120×630 (16:9)
 * - Scales to fit viewport
 * 
 * In MOBILE mode:
 * - Landscape: 750×370 (~2:1)
 * - Portrait: 370×700 (~1:1.9)
 * - Applies device-specific safe area insets
 * - Scales to fit usable box
 * 
 * Both modes use transform: scale() for consistent rendering
 * 
 * iOS Safari Orientation Fix:
 * - iOS doesn't update viewport dimensions immediately on orientation change
 * - We poll until dimensions stabilize (typically 100-500ms)
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { isFullMode, isMobile } from '@/utils/deviceMode'
import { getDeviceSafeAreas, type SafeAreaInsets } from '@/utils/deviceSafeAreas'

// Canonical dimensions - design at these sizes
const DESKTOP_WIDTH = 1120
const DESKTOP_HEIGHT = 630
const MOBILE_LANDSCAPE_WIDTH = 820
const MOBILE_LANDSCAPE_HEIGHT = 370
const MOBILE_PORTRAIT_WIDTH = 370
const MOBILE_PORTRAIT_HEIGHT = 700

const wrapperRef = ref<HTMLElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const scale = ref(1)
const wrapperWidth = ref(0)
const wrapperHeight = ref(0)
const safeInsets = ref<SafeAreaInsets>({ top: 0, right: 0, bottom: 0, left: 0 })
const deviceName = ref('Unknown')
const isPortrait = ref(false)

// Track last known dimensions
let lastViewportW = 0
let lastViewportH = 0

// Get canonical dimensions based on mode and orientation
const canonicalWidth = computed(() => {
  if (isFullMode()) return DESKTOP_WIDTH
  return isPortrait.value ? MOBILE_PORTRAIT_WIDTH : MOBILE_LANDSCAPE_WIDTH
})
const canonicalHeight = computed(() => {
  if (isFullMode()) return DESKTOP_HEIGHT
  return isPortrait.value ? MOBILE_PORTRAIT_HEIGHT : MOBILE_LANDSCAPE_HEIGHT
})

// Always scale now (both mobile and desktop)
const shouldScale = computed(() => true)

/**
 * Get device orientation using screen.orientation API
 * More reliable than comparing viewport dimensions during iOS transitions
 */
function getDeviceOrientation(): 'portrait' | 'landscape' {
  // Try screen.orientation API first (most reliable)
  if (screen.orientation?.type) {
    return screen.orientation.type.startsWith('portrait') ? 'portrait' : 'landscape'
  }
  // Fallback: deprecated window.orientation (still works on iOS)
  if (typeof window.orientation === 'number') {
    return (window.orientation === 0 || window.orientation === 180) ? 'portrait' : 'landscape'
  }
  // Last resort: compare dimensions
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
}

/**
 * Detect if running on iOS
 */
function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

/**
 * Get viewport dimensions
 * - iOS PWA: derive from screen size + orientation (visualViewport is broken)
 * - Android/Desktop: use window.innerWidth/Height (works reliably)
 */
function getViewportDimensions(): { width: number, height: number } {
  // iOS PWA has broken visualViewport during orientation transitions
  // Derive dimensions from physical screen size + orientation
  if (isMobile() && isIOS()) {
    const orientation = getDeviceOrientation()
    const screenW = window.screen.width
    const screenH = window.screen.height
    
    // iOS screen.width/height are physical (don't swap on rotation)
    const isScreenPortrait = screenH > screenW
    
    let width: number, height: number
    if (orientation === 'portrait') {
      width = isScreenPortrait ? screenW : screenH
      height = isScreenPortrait ? screenH : screenW
    } else {
      width = isScreenPortrait ? screenH : screenW
      height = isScreenPortrait ? screenW : screenH
    }
    
    console.log(`[ScaledContainer] iOS: screen=${screenW}×${screenH}, orientation=${orientation} → ${width}×${height}`)
    return { width, height }
  }
  
  // Android and desktop: window.innerWidth/Height work reliably
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

/**
 * Check if viewport dimensions look valid for the given orientation
 */
function dimensionsLookValid(width: number, height: number, orientation: 'portrait' | 'landscape'): boolean {
  // Reject zero/tiny dimensions
  if (width < 200 || height < 200) return false
  
  // Reject square-ish dimensions (mid-transition garbage)
  const ratio = width / height
  if (ratio > 0.9 && ratio < 1.1) return false
  
  // Check if dimensions match expected orientation
  const looksPortrait = height > width
  const looksLandscape = width > height
  
  if (orientation === 'portrait' && !looksPortrait) return false
  if (orientation === 'landscape' && !looksLandscape) return false
  
  return true
}

function calculateScale() {
  const deviceOrientation = getDeviceOrientation()
  const { width: viewportW, height: viewportH } = getViewportDimensions()
  
  if (viewportW === 0 || viewportH === 0) {
    console.log('[ScaledContainer] Zero dimensions, skipping')
    return
  }
  
  // Use device orientation (derived from screen.orientation API)
  isPortrait.value = deviceOrientation === 'portrait'
  
  // Apply safe area insets to get usable box
  let usableW = viewportW
  let usableH = viewportH
  
  if (isMobile()) {
    // Get device-specific safe areas
    const deviceInfo = getDeviceSafeAreas()
    deviceName.value = deviceInfo.name
    
    // Safe areas are different in portrait vs landscape
    // In portrait: top has notch/island, bottom has home indicator
    // In landscape: left/right have notch, bottom has home indicator
    if (isPortrait.value) {
      // Portrait: use top/bottom insets
      // Note: deviceSafeAreas returns landscape values, so we need to swap
      safeInsets.value = {
        top: deviceInfo.insets.left, // Notch moves to top in portrait
        right: 0,
        bottom: deviceInfo.insets.bottom,
        left: 0,
      }
    } else {
      // Landscape: use left/right insets as-is
      safeInsets.value = deviceInfo.insets
    }
    
    usableW = viewportW - safeInsets.value.left - safeInsets.value.right
    usableH = viewportH - safeInsets.value.top - safeInsets.value.bottom
    
    const orient = isPortrait.value ? 'portrait' : 'landscape'
    console.log(`[ScaledContainer] ${deviceInfo.name} (${orient}), Viewport: ${viewportW}×${viewportH}, Usable: ${usableW}×${usableH}`)
  } else {
    console.log(`[ScaledContainer] Desktop: ${viewportW}×${viewportH}`)
  }
  
  wrapperWidth.value = usableW
  wrapperHeight.value = usableH
  
  // Scale to fit usable box
  const scaleX = usableW / canonicalWidth.value
  const scaleY = usableH / canonicalHeight.value
  
  // Use smaller scale to maintain aspect ratio and fit
  scale.value = Math.min(scaleX, scaleY)
  console.log(`[ScaledContainer] Canonical: ${canonicalWidth.value}×${canonicalHeight.value}, Scale: ${scale.value.toFixed(3)}`)
  
  // Update last known dimensions
  lastViewportW = viewportW
  lastViewportH = viewportH
}

function handleResize() {
  // Calculate immediately - dimensions are derived from screen size on mobile
  calculateScale()
}

function handleOrientationChange() {
  const targetOrientation = getDeviceOrientation()
  console.log(`[ScaledContainer] Orientation change → ${targetOrientation}`)
  
  // Recalculate immediately - we derive dimensions from screen size + orientation
  // so we don't need to wait for viewport to settle
  calculateScale()
  
  // But also do a couple follow-ups in case screen.orientation was slow
  setTimeout(() => calculateScale(), 100)
  setTimeout(() => calculateScale(), 300)
}

onMounted(() => {
  // Initial calculation with small delay to let DOM settle
  requestAnimationFrame(() => {
    calculateScale()
    
    // On mobile, do a few more checks in case dimensions are still settling
    if (isMobile()) {
      setTimeout(() => calculateScale(), 100)
      setTimeout(() => calculateScale(), 300)
    }
  })
  
  // Listen to resize events
  window.addEventListener('resize', handleResize)
  
  // Listen to orientation change specifically (iOS)
  window.addEventListener('orientationchange', handleOrientationChange)
  
  // Also listen to visualViewport resize if available (more reliable on mobile)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleResize)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('orientationchange', handleOrientationChange)
  
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', handleResize)
  }
})

// Calculate style with centering offset
const scaledStyle = computed(() => {
  const scaledW = canonicalWidth.value * scale.value
  const scaledH = canonicalHeight.value * scale.value
  
  // Calculate offset to center within usable box
  // For mobile, also add safe area offset
  let offsetX = Math.max(0, (wrapperWidth.value - scaledW) / 2)
  let offsetY = Math.max(0, (wrapperHeight.value - scaledH) / 2)
  
  if (isMobile()) {
    offsetX += safeInsets.value.left
    offsetY += safeInsets.value.top
  }
  
  return {
    width: `${canonicalWidth.value}px`,
    height: `${canonicalHeight.value}px`,
    transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale.value})`,
  }
})

// Expose dimensions for child components
const containerWidth = computed(() => canonicalWidth.value)
const containerHeight = computed(() => canonicalHeight.value)

defineExpose({
  width: containerWidth,
  height: containerHeight,
  scale,
  deviceName,
  safeInsets,
  isPortrait,
})
</script>

<template>
  <div ref="wrapperRef" class="scaled-container-wrapper">
    <div
      ref="containerRef"
      class="scaled-container"
      :style="scaledStyle"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.scaled-container-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background: #08080c;
}

.scaled-container {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  overflow: hidden;
  border-radius: 16px;
  // Tighter glow - fades before edges
  box-shadow: 
    // Inner white-green glow
    0 0 40px 8px rgba(200, 230, 210, 0.12),
    // Mid green glow - tighter
    0 0 60px 15px rgba(30, 96, 69, 0.10),
    // Inner depth
    inset 0 0 30px rgba(0, 0, 0, 0.25);
}
</style>
