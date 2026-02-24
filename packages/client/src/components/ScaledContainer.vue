<script setup lang="ts">
/**
 * ScaledContainer - Unified scaling for all devices
 * 
 * In FULL mode (tablet/desktop):
 * - Canonical size: 1120×630 (16:9)
 * - Scales to fit viewport
 * 
 * In MOBILE mode:
 * - Canonical size: 750×370 (~2:1)
 * - Applies device-specific safe area insets
 * - Scales to fit usable box
 * 
 * Both modes use transform: scale() for consistent rendering
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { isFullMode, isMobile } from '@/utils/deviceMode'
import { getDeviceSafeAreas, type SafeAreaInsets } from '@/utils/deviceSafeAreas'

// Canonical dimensions - design at these sizes
const DESKTOP_WIDTH = 1120
const DESKTOP_HEIGHT = 630
const MOBILE_WIDTH = 750
const MOBILE_HEIGHT = 370

const wrapperRef = ref<HTMLElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const scale = ref(1)
const wrapperWidth = ref(0)
const wrapperHeight = ref(0)
const safeInsets = ref<SafeAreaInsets>({ top: 0, right: 0, bottom: 0, left: 0 })
const deviceName = ref('Unknown')

// Get canonical dimensions based on mode
const canonicalWidth = computed(() => isFullMode() ? DESKTOP_WIDTH : MOBILE_WIDTH)
const canonicalHeight = computed(() => isFullMode() ? DESKTOP_HEIGHT : MOBILE_HEIGHT)

// Always scale now (both mobile and desktop)
const shouldScale = computed(() => true)

function calculateScale() {
  if (!wrapperRef.value) {
    scale.value = 1
    return
  }
  
  // Get viewport size
  const viewportW = wrapperRef.value.offsetWidth
  const viewportH = wrapperRef.value.offsetHeight
  
  // Apply safe area insets to get usable box
  let usableW = viewportW
  let usableH = viewportH
  
  if (isMobile()) {
    // Get device-specific safe areas
    const deviceInfo = getDeviceSafeAreas()
    safeInsets.value = deviceInfo.insets
    deviceName.value = deviceInfo.name
    
    usableW = viewportW - safeInsets.value.left - safeInsets.value.right
    usableH = viewportH - safeInsets.value.top - safeInsets.value.bottom
    
    console.log(`[ScaledContainer] Device: ${deviceInfo.name}, Viewport: ${viewportW}×${viewportH}, Usable: ${usableW}×${usableH}`)
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
}

function handleResize() {
  calculateScale()
}

onMounted(() => {
  requestAnimationFrame(() => {
    calculateScale()
  })
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
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
