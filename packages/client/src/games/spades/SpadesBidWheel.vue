<template>
  <Transition name="wheel-slide">
    <div v-if="visible" class="bid-wheel-container">
      <!-- Shiny overlay -->
      <div class="shiny-overlay"></div>
      
      <div class="bid-wheel">
        <!-- Scrollable viewport with snap -->
        <div 
          class="wheel-viewport" 
          ref="viewportRef"
          @scroll="handleScroll"
        >
          <!-- Spacer top -->
          <div class="wheel-spacer"></div>
          
          <div 
            v-for="val in allValues" 
            :key="val"
            class="wheel-item"
            :class="{ selected: val === modelValue }"
            @click="selectValue(val)"
          >
            {{ val === 0 ? 'Nil' : val }}
          </div>
          
          <!-- Spacer bottom -->
          <div class="wheel-spacer"></div>
        </div>
        
        <!-- Gradient overlays -->
        <div class="wheel-gradient top"></div>
        <div class="wheel-gradient bottom"></div>
        
        <!-- Selection highlight -->
        <div class="wheel-highlight"></div>
      </div>
      
      <!-- Bid button -->
      <button class="bid-button" @click="$emit('bid')">
        {{ modelValue === 0 ? 'Bid Nil' : `Bid ${modelValue}` }}
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'

const props = defineProps<{
  modelValue: number
  visible: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
  'bid': []
}>()

const viewportRef = ref<HTMLElement | null>(null)

// All possible bid values: 0 (Nil), 1-13
const allValues = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

const itemHeight = 44 // px per item

let isScrolling = false

function handleScroll() {
  if (!viewportRef.value || isScrolling) return
  
  const scrollTop = viewportRef.value.scrollTop
  const index = Math.round(scrollTop / itemHeight)
  const clampedIndex = Math.max(0, Math.min(13, index))
  
  if (clampedIndex !== props.modelValue) {
    emit('update:modelValue', clampedIndex)
  }
}

function scrollToValue(val: number, smooth = true) {
  if (!viewportRef.value) return
  isScrolling = true
  viewportRef.value.scrollTo({
    top: val * itemHeight,
    behavior: smooth ? 'smooth' : 'instant'
  })
  setTimeout(() => { isScrolling = false }, 150)
}

function selectValue(val: number) {
  emit('update:modelValue', val)
  scrollToValue(val)
}

// Scroll to initial value when visible
watch(() => props.visible, (visible) => {
  if (visible) {
    nextTick(() => scrollToValue(props.modelValue, false))
  }
})

// Sync scroll position when modelValue changes externally
watch(() => props.modelValue, (val) => {
  if (!isScrolling) {
    scrollToValue(val)
  }
})

onMounted(() => {
  if (props.visible) {
    nextTick(() => scrollToValue(props.modelValue, false))
  }
})
</script>

<style scoped lang="scss">
.bid-wheel-container {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px 16px;
  padding-right: max(16px, env(safe-area-inset-right));
  background-color: rgba(20, 20, 30, 0.4) !important;
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  border-radius: 20px 0 0 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-right: none;
  box-shadow: -4px 0 30px rgba(0, 0, 0, 0.4);
}

// Shiny overlay effect - sits on top
.shiny-overlay {
  position: absolute;
  inset: 0;
  border-radius: 20px 0 0 20px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.35) 0%,
    rgba(255, 255, 255, 0.15) 25%,
    rgba(255, 255, 255, 0.05) 50%,
    transparent 70%
  );
  pointer-events: none;
  z-index: 10;
}

.bid-wheel {
  position: relative;
  background: rgba(245, 245, 248, 0.95);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.wheel-viewport {
  width: 72px;
  height: calc(44px * 5); // Show 5 items
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  
  &::-webkit-scrollbar {
    display: none;
  }
}

.wheel-spacer {
  height: calc(44px * 2); // Two item heights for centering
  scroll-snap-align: none;
}

.wheel-item {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.35);
  scroll-snap-align: center;
  transition: color 0.15s ease, font-size 0.15s ease;
  cursor: pointer;
  
  &:hover:not(.selected) {
    color: rgba(0, 0, 0, 0.5);
  }
  
  &.selected {
    font-size: 26px;
    font-weight: 700;
    color: #1a1a2e;
  }
}

// Gradient overlays for depth
.wheel-gradient {
  position: absolute;
  left: 0;
  right: 0;
  height: 50px;
  pointer-events: none;
  z-index: 2;
  
  &.top {
    top: 0;
    background: linear-gradient(
      to bottom,
      rgba(245, 245, 248, 0.95) 0%,
      rgba(245, 245, 248, 0.7) 50%,
      transparent 100%
    );
  }
  
  &.bottom {
    bottom: 0;
    background: linear-gradient(
      to top,
      rgba(245, 245, 248, 0.95) 0%,
      rgba(245, 245, 248, 0.7) 50%,
      transparent 100%
    );
  }
}

// Selection highlight bar
.wheel-highlight {
  position: absolute;
  top: 50%;
  left: 4px;
  right: 4px;
  height: 40px;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  pointer-events: none;
  z-index: 1;
}

.bid-button {
  padding: 12px 24px;
  background: rgba(42, 138, 106, 0.95);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 3px 12px rgba(42, 138, 106, 0.4);
  min-width: 100px;
  
  &:hover {
    background: rgba(52, 158, 126, 1);
    transform: scale(1.02);
  }
  
  &:active {
    transform: scale(0.98);
  }
}

// Slide in from right transition
.wheel-slide-enter-active {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
}

.wheel-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease;
}

.wheel-slide-enter-from,
.wheel-slide-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(100%);
}
</style>
