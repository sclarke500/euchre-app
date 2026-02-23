<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { isMobile, lockViewport, unlockViewport } from '@/composables/useCardSizing'

const props = withDefaults(defineProps<{
  // Base dimensions the content is designed for
  baseWidth?: number
  baseHeight?: number
  // Max width before we stop scaling up
  maxWidth?: number
  // Padding around the container
  padding?: number
}>(), {
  baseWidth: 1280,
  baseHeight: 720,
  maxWidth: 1600,
  padding: 24,
})

const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 720)

function updateViewport() {
  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
}

// Determine scaling mode IMMEDIATELY (before children render)
// Use actual window dimensions, not the reactive refs
const actualWidth = typeof window !== 'undefined' ? window.innerWidth : 1280
const actualHeight = typeof window !== 'undefined' ? window.innerHeight : 720
const shouldScale = !(actualWidth < 768 || actualHeight < 500) // Same logic as isMobile()

// If scaling, lock viewport BEFORE children mount
// This is synchronous, so children will see locked dimensions when they mount
if (shouldScale) {
  lockViewport(props.baseWidth, props.baseHeight)
}

// Track if we've been initialized (for conditional rendering)
const isReady = ref(shouldScale ? true : false)

onMounted(() => {
  window.addEventListener('resize', updateViewport)
  updateViewport()
  
  // For mobile mode, mark ready after mount
  if (!shouldScale) {
    isReady.value = true
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewport)
  // Unlock viewport when leaving scaled container
  if (shouldScale) {
    unlockViewport()
  }
})

// Calculate the scale factor to fit container in viewport
const scale = computed(() => {
  if (!shouldScale) return 1
  
  const availableWidth = Math.min(viewportWidth.value - props.padding * 2, props.maxWidth)
  const availableHeight = viewportHeight.value - props.padding * 2
  
  const scaleX = availableWidth / props.baseWidth
  const scaleY = availableHeight / props.baseHeight
  
  // Use the smaller scale to ensure it fits
  return Math.min(scaleX, scaleY, 1.25) // Cap at 1.25x to avoid over-scaling
})

// Actual rendered dimensions
const containerWidth = computed(() => props.baseWidth * scale.value)
const containerHeight = computed(() => props.baseHeight * scale.value)
</script>

<template>
  <div class="scaled-wrapper" :class="{ 'mobile-mode': !shouldScale }">
    <!-- Background area (scaled mode only) -->
    <div v-if="shouldScale" class="background-area">
      <div class="background-pattern"></div>
    </div>
    
    <!-- Scaled game container -->
    <div 
      v-if="shouldScale && isReady"
      class="scaled-container"
      :style="{
        width: baseWidth + 'px',
        height: baseHeight + 'px',
        transform: `scale(${scale})`,
      }"
    >
      <slot />
    </div>
    
    <!-- Mobile: no scaling, just render content -->
    <div v-else-if="!shouldScale && isReady" class="mobile-container">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.scaled-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  
  &.mobile-mode {
    // On mobile, just fill the space
    .mobile-container {
      width: 100%;
      height: 100%;
    }
  }
}

.background-area {
  position: absolute;
  inset: 0;
  z-index: 0;
  
  .background-pattern {
    width: 100%;
    height: 100%;
    background: 
      // Subtle vignette
      radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, 0.4) 100%),
      // Robot image very faded
      url('@/assets/menu-background.jpg');
    background-size: cover;
    background-position: center;
    filter: brightness(0.3) saturate(0.5);
  }
}

.scaled-container {
  position: relative;
  z-index: 1;
  transform-origin: center center;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.1);
}

.mobile-container {
  position: relative;
  z-index: 1;
}
</style>
