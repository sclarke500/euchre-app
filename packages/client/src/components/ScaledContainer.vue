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

// Aurora glow positioned behind container (slightly larger, same transform)
const auroraStyle = computed(() => {
  const scaledW = canonicalWidth.value * scale.value
  const scaledH = canonicalHeight.value * scale.value
  
  let offsetX = Math.max(0, (wrapperWidth.value - scaledW) / 2)
  let offsetY = Math.max(0, (wrapperHeight.value - scaledH) / 2)
  
  if (isMobile()) {
    offsetX += safeInsets.value.left
    offsetY += safeInsets.value.top
  }
  
  // Glow extends 50px beyond container on each side
  const glowPad = 50
  return {
    width: `${canonicalWidth.value + glowPad * 2}px`,
    height: `${canonicalHeight.value + glowPad * 2}px`,
    transform: `translate(${offsetX - glowPad * scale.value}px, ${offsetY - glowPad * scale.value}px) scale(${scale.value})`,
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
    <!-- Star field background -->
    <div class="star-field">
      <div class="stars stars-small"></div>
      <div class="stars stars-medium"></div>
      <div class="stars stars-large"></div>
    </div>
    
    <!-- Aurora glow orbs that drift around the container edges -->
    <div class="aurora-orb orb-1" :style="auroraStyle"></div>
    <div class="aurora-orb orb-2" :style="auroraStyle"></div>
    <div class="aurora-orb orb-3" :style="auroraStyle"></div>
    
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
  background: radial-gradient(ellipse at center, #12121a 0%, #08080c 50%, #050508 100%);
}

// Star field - layers of different star sizes
.star-field {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.stars {
  position: absolute;
  width: 100%;
  height: 100%;
  background-repeat: repeat;
}

// Small stars - dense, dim, subtle twinkle
.stars-small {
  background-image: 
    radial-gradient(1px 1px at 20px 30px, rgba(255,255,255,0.8), transparent),
    radial-gradient(1px 1px at 40px 70px, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 50px 160px, rgba(255,255,255,0.7), transparent),
    radial-gradient(1px 1px at 90px 40px, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.7), transparent),
    radial-gradient(1px 1px at 160px 120px, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 200px 50px, rgba(255,255,255,0.8), transparent),
    radial-gradient(1px 1px at 220px 150px, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 250px 90px, rgba(255,255,255,0.7), transparent),
    radial-gradient(1px 1px at 280px 180px, rgba(255,255,255,0.6), transparent);
  background-size: 300px 200px;
  animation: twinkle 4s ease-in-out infinite;
}

// Medium stars - scattered, brighter
.stars-medium {
  background-image:
    radial-gradient(1.5px 1.5px at 70px 55px, rgba(255,255,255,0.9), transparent),
    radial-gradient(1.5px 1.5px at 150px 140px, rgba(200,220,255,0.85), transparent),
    radial-gradient(1.5px 1.5px at 230px 25px, rgba(255,255,255,0.8), transparent),
    radial-gradient(1.5px 1.5px at 310px 110px, rgba(255,230,200,0.85), transparent),
    radial-gradient(1.5px 1.5px at 380px 75px, rgba(255,255,255,0.9), transparent);
  background-size: 450px 180px;
  animation: twinkle 6s ease-in-out infinite reverse;
}

// Large stars - few, bright, slow twinkle
.stars-large {
  background-image:
    radial-gradient(2px 2px at 100px 80px, rgba(255,255,255,1), transparent),
    radial-gradient(2.5px 2.5px at 320px 150px, rgba(200,220,255,0.95), transparent),
    radial-gradient(2px 2px at 500px 60px, rgba(255,240,220,0.9), transparent),
    radial-gradient(3px 3px at 700px 120px, rgba(255,255,255,1), transparent);
  background-size: 800px 200px;
  animation: twinkle 8s ease-in-out infinite;
}

@keyframes twinkle {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

// Glowing orbs that move around the container
.aurora-orb {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  pointer-events: none;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.35;
}

.orb-1 {
  background: rgba(100, 255, 150, 0.6); // Green
  animation: drift1 20s ease-in-out infinite, color1 20s ease-in-out infinite;
}

.orb-2 {
  background: rgba(100, 180, 255, 0.6); // Blue
  animation: drift2 25s ease-in-out infinite, color2 25s ease-in-out infinite;
}

.orb-3 {
  background: rgba(180, 150, 255, 0.6); // Purple
  animation: drift3 30s ease-in-out infinite, color3 30s ease-in-out infinite;
}

.scaled-container {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  overflow: hidden;
  border-radius: 16px;
  // Beveled edge effect - light top-left, dark bottom-right
  border: 2px solid transparent;
  border-top-color: rgba(255, 255, 255, 0.15);
  border-left-color: rgba(255, 255, 255, 0.1);
  border-bottom-color: rgba(0, 0, 0, 0.3);
  border-right-color: rgba(0, 0, 0, 0.25);
  // Layered inset shadows for depth
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.1),      // top highlight
    inset 0 -1px 0 rgba(0, 0, 0, 0.2),           // bottom shadow
    inset 2px 2px 8px rgba(255, 255, 255, 0.05), // inner top-left glow
    inset -2px -2px 8px rgba(0, 0, 0, 0.15),     // inner bottom-right shadow
    inset 0 0 30px rgba(0, 0, 0, 0.25);          // overall depth
}

// Each orb drifts around different parts of the perimeter
// Container is 1120x630, orbs are 300px, margins position their top-left corner
@keyframes drift1 {
  0%, 100% { margin: -80px 0 0 -80px; opacity: 0.35; }   // top-left
  25% { margin: -80px 0 0 500px; opacity: 0.25; }        // top-center
  50% { margin: 400px 0 0 850px; opacity: 0.35; }        // bottom-right
  75% { margin: 200px 0 0 -50px; opacity: 0.2; }         // left-middle
}

@keyframes drift2 {
  0%, 100% { margin: 150px 0 0 900px; opacity: 0.3; }    // right-middle
  33% { margin: 450px 0 0 400px; opacity: 0.35; }        // bottom-center
  66% { margin: -80px 0 0 -50px; opacity: 0.25; }        // top-left
}

@keyframes drift3 {
  0%, 100% { margin: 400px 0 0 100px; opacity: 0.3; }    // bottom-left
  30% { margin: -80px 0 0 800px; opacity: 0.2; }         // top-right
  60% { margin: 200px 0 0 400px; opacity: 0.35; }        // center
  85% { margin: -60px 0 0 -60px; opacity: 0.25; }        // top-left
}

// Color shifts include fading to dark
@keyframes color1 {
  0%, 100% { background: rgba(100, 255, 150, 0.5); }
  30% { background: rgba(50, 80, 60, 0.1); } // dark
  50% { background: rgba(50, 255, 220, 0.5); } // teal
  80% { background: rgba(100, 255, 150, 0.5); }
}

@keyframes color2 {
  0%, 100% { background: rgba(100, 180, 255, 0.5); }
  25% { background: rgba(40, 60, 80, 0.1); } // dark
  50% { background: rgba(180, 150, 255, 0.5); } // purple
  75% { background: rgba(100, 180, 255, 0.5); }
}

@keyframes color3 {
  0%, 100% { background: rgba(180, 150, 255, 0.5); }
  35% { background: rgba(100, 255, 150, 0.5); } // green
  55% { background: rgba(50, 50, 60, 0.1); } // dark
  80% { background: rgba(50, 255, 220, 0.5); } // teal
}
</style>
