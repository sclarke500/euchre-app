<script setup lang="ts">
/**
 * ScaledContainer - 16:9 aspect ratio container with transform scaling
 * 
 * In FULL mode (tablet/desktop):
 * - Creates a fixed-size container at canonical dimensions (1120x630)
 * - Uses CSS transform: scale() to fit the viewport
 * - Everything inside scales proportionally
 * 
 * In MOBILE mode:
 * - Passes through without constraint
 * - Uses full screen space
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { isFullMode } from '@/utils/deviceMode'

// Canonical dimensions for 16:9 aspect ratio
// This is the "design size" - everything is laid out at this size then scaled
const CANONICAL_WIDTH = 1120
const CANONICAL_HEIGHT = 630

// No padding - container runs edge-to-edge
const VIEWPORT_PADDING = 0

const wrapperRef = ref<HTMLElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const scale = ref(1)
const wrapperWidth = ref(0)
const wrapperHeight = ref(0)

const shouldScale = computed(() => {
  const result = isFullMode()
  console.log('[ScaledContainer] shouldScale:', result)
  return result
})

function calculateScale() {
  if (!shouldScale.value || !wrapperRef.value) {
    scale.value = 1
    return
  }
  
  // Measure wrapper size
  wrapperWidth.value = wrapperRef.value.offsetWidth
  wrapperHeight.value = wrapperRef.value.offsetHeight
  
  console.log(`[ScaledContainer] wrapper: ${wrapperWidth.value}×${wrapperHeight.value}`)
  
  // Scale to fit (use smaller scale to maintain aspect ratio)
  const scaleX = wrapperWidth.value / CANONICAL_WIDTH
  const scaleY = wrapperHeight.value / CANONICAL_HEIGHT
  
  // Use smaller scale to ensure it fits - no cap, can scale up
  scale.value = Math.min(scaleX, scaleY)
  console.log(`[ScaledContainer] scale: ${scale.value.toFixed(3)} (scaleX=${scaleX.toFixed(3)}, scaleY=${scaleY.toFixed(3)})`)
}

function handleResize() {
  calculateScale()
}

onMounted(() => {
  // Wait a tick for layout to settle
  requestAnimationFrame(() => {
    calculateScale()
  })
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// Recalculate when mode changes (shouldn't happen, but safety)
watch(shouldScale, () => {
  calculateScale()
})

// Calculate style with centering offset
const scaledStyle = computed(() => {
  const scaledW = CANONICAL_WIDTH * scale.value
  const scaledH = CANONICAL_HEIGHT * scale.value
  
  // Center the scaled content within wrapper
  const offsetX = Math.max(0, (wrapperWidth.value - scaledW) / 2)
  const offsetY = Math.max(0, (wrapperHeight.value - scaledH) / 2)
  
  return {
    width: `${CANONICAL_WIDTH}px`,
    height: `${CANONICAL_HEIGHT}px`,
    transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale.value})`,
  }
})

// Expose dimensions for child components that need to know the "virtual" viewport
const containerWidth = computed(() => shouldScale.value ? CANONICAL_WIDTH : (wrapperRef.value?.offsetWidth ?? window.innerWidth))
const containerHeight = computed(() => shouldScale.value ? CANONICAL_HEIGHT : (wrapperRef.value?.offsetHeight ?? window.innerHeight))

defineExpose({
  width: containerWidth,
  height: containerHeight,
  scale,
})
</script>

<template>
  <div ref="wrapperRef" class="scaled-container-wrapper" :class="{ 'is-scaling': shouldScale }">
    <div
      v-if="shouldScale"
      ref="containerRef"
      class="scaled-container"
      :style="scaledStyle"
    >
      <slot />
    </div>
    
    <!-- Mobile: no scaling, full viewport -->
    <div v-else class="passthrough-container">
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
  
  &.is-scaling {
    background: #0a0a0f; // Dark background if container doesn't fill (letterboxing)
  }
}

.scaled-container {
  // Transform from top-left corner, positioned at top-left
  // This avoids flexbox layout issues with transformed elements
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  overflow: hidden;
  background: #0f0f18; // Game area background
}

.passthrough-container {
  width: 100%;
  height: 100%;
  // Safe area padding for mobile (content stays inside notch/home indicator areas)
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
  // Transparent - #app's dark background shows in safe areas
}
</style>
