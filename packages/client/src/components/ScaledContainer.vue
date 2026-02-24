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

// Track last known dimensions for stability detection
let lastViewportW = 0
let lastViewportH = 0
let stabilityPollId: number | null = null

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
 * Get viewport dimensions using visualViewport API when available
 * (more reliable on iOS than offsetWidth/offsetHeight during orientation change)
 */
function getViewportDimensions(): { width: number, height: number } {
  // Try visualViewport first (more reliable on mobile)
  if (window.visualViewport) {
    return {
      width: Math.round(window.visualViewport.width),
      height: Math.round(window.visualViewport.height),
    }
  }
  // Fall back to wrapper element dimensions
  if (wrapperRef.value) {
    return {
      width: wrapperRef.value.offsetWidth,
      height: wrapperRef.value.offsetHeight,
    }
  }
  // Last resort: window inner dimensions
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

function calculateScale() {
  const { width: viewportW, height: viewportH } = getViewportDimensions()
  
  if (viewportW === 0 || viewportH === 0) {
    console.log('[ScaledContainer] Zero dimensions, skipping')
    return
  }
  
  // Detect orientation (for mobile)
  isPortrait.value = viewportH > viewportW
  
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

/**
 * Poll until viewport dimensions stabilize
 * iOS Safari takes 100-500ms to update dimensions after orientation change
 */
function pollUntilStable(maxAttempts = 10, intervalMs = 50) {
  let attempts = 0
  
  // Clear any existing poll
  if (stabilityPollId !== null) {
    clearInterval(stabilityPollId)
  }
  
  stabilityPollId = window.setInterval(() => {
    attempts++
    const { width, height } = getViewportDimensions()
    
    // Check if dimensions have changed from last calculation
    const changed = width !== lastViewportW || height !== lastViewportH
    
    if (changed) {
      console.log(`[ScaledContainer] Dimensions changed: ${lastViewportW}×${lastViewportH} → ${width}×${height}`)
      calculateScale()
    }
    
    // Stop polling after max attempts or if stable for 2 consecutive checks
    if (attempts >= maxAttempts || !changed) {
      if (stabilityPollId !== null) {
        clearInterval(stabilityPollId)
        stabilityPollId = null
      }
      if (attempts >= maxAttempts) {
        console.log(`[ScaledContainer] Max poll attempts reached`)
      }
    }
  }, intervalMs)
}

function handleResize() {
  // Calculate immediately
  calculateScale()
  
  // On mobile, poll for stability (iOS orientation change fix)
  if (isMobile()) {
    pollUntilStable()
  }
}

function handleOrientationChange() {
  console.log('[ScaledContainer] Orientation change detected')
  
  // iOS takes a while to update viewport dimensions after orientation change
  // Use multiple delayed recalculations to catch it
  const delays = [50, 150, 300, 500, 800]
  delays.forEach(delay => {
    setTimeout(() => {
      const { width, height } = getViewportDimensions()
      const wasPortrait = isPortrait.value
      const nowPortrait = height > width
      
      console.log(`[ScaledContainer] After ${delay}ms: ${width}×${height}, portrait=${nowPortrait}`)
      
      // If orientation detection changed, recalculate
      if (wasPortrait !== nowPortrait || width !== lastViewportW || height !== lastViewportH) {
        calculateScale()
      }
    }, delay)
  })
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
  
  if (stabilityPollId !== null) {
    clearInterval(stabilityPollId)
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
  // Dark background shows in letterbox/safe areas
  background: #0a0a0f;
}

.scaled-container {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  overflow: hidden;
  // Game area background - will be covered by game content
  background: #0f0f18;
}
</style>
