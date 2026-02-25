<template>
  <Transition name="panel-slide">
    <div v-if="visible" class="bid-picker-container">
      <!-- Shiny overlay -->
      <div class="shiny-overlay"></div>
      
      <div class="bid-picker">
        <!-- Up arrow -->
        <button 
          class="arrow-btn up" 
          @click="increment"
          :disabled="modelValue >= 13"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </button>
        
        <!-- Number display with scroll animation -->
        <div class="bid-display">
          <div 
            class="bid-value"
            :class="animationClass"
            :key="modelValue"
          >
            {{ modelValue === 0 ? 'Nil' : modelValue }}
          </div>
        </div>
        
        <!-- Down arrow -->
        <button 
          class="arrow-btn down" 
          @click="decrement"
          :disabled="modelValue <= 0"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>
      
      <!-- Bid button -->
      <button class="bid-button" @click="$emit('bid')">
        {{ modelValue === 0 ? 'Bid Nil' : `Bid ${modelValue}` }}
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: number
  visible: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
  'bid': []
}>()

// Track animation direction
const animationClass = ref('')
let animationTimeout: number | null = null

function triggerAnimation(direction: 'up' | 'down') {
  // Clear any pending animation
  if (animationTimeout) {
    clearTimeout(animationTimeout)
  }
  
  // Set the animation class
  animationClass.value = direction === 'up' ? 'slide-up' : 'slide-down'
  
  // Clear animation class after animation completes
  animationTimeout = window.setTimeout(() => {
    animationClass.value = ''
  }, 300)
}

function increment() {
  if (props.modelValue < 13) {
    triggerAnimation('up')
    emit('update:modelValue', props.modelValue + 1)
  }
}

function decrement() {
  if (props.modelValue > 0) {
    triggerAnimation('down')
    emit('update:modelValue', props.modelValue - 1)
  }
}

// Reset animation when panel becomes visible
watch(() => props.visible, (visible) => {
  if (visible) {
    animationClass.value = ''
  }
})
</script>

<style scoped lang="scss">
.bid-picker-container {
  position: fixed;
  right: 0;
  top: 55%;
  transform: translateY(-50%);
  z-index: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  background: var(--panel-bg);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  border-radius: 20px 0 0 20px;
  border: 1px solid var(--panel-border);
  border-right: none;
  box-shadow: 
    -4px 0 24px rgba(0, 0, 0, 0.4),
    0 0 var(--panel-glow-size) var(--panel-glow-color),
    inset 1px 1px 0 rgba(255, 255, 255, 0.1);
  animation: panel-glow 2s ease-in-out infinite;
}

@keyframes panel-glow {
  0%, 100% {
    box-shadow: 
      -4px 0 24px rgba(0, 0, 0, 0.4),
      0 0 var(--panel-glow-size) var(--panel-glow-color),
      inset 1px 1px 0 rgba(255, 255, 255, 0.1);
  }
  50% {
    box-shadow: 
      -4px 0 24px rgba(0, 0, 0, 0.4),
      0 0 var(--panel-glow-size-pulse) var(--panel-glow-color),
      inset 1px 1px 0 rgba(255, 255, 255, 0.15);
  }
}

// Subtle shiny highlight at top
.shiny-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 40%;
  border-radius: 20px 0 0 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.08) 0%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 10;
}

.bid-picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.arrow-btn {
  width: 48px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  
  svg {
    width: 24px;
    height: 24px;
    color: rgba(255, 255, 255, 0.8);
    transition: color 0.15s ease;
  }
  
  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.35);
    
    svg {
      color: #fff;
    }
  }
  
  &:active:not(:disabled) {
    transform: scale(0.95);
  }
  
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.bid-display {
  width: 60px;
  height: 50px;
  background: rgba(245, 245, 248, 0.95);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.bid-value {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  
  // Slide up animation (number increasing)
  &.slide-up {
    animation: slideFromBottom 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  
  // Slide down animation (number decreasing)
  &.slide-down {
    animation: slideFromTop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

@keyframes slideFromBottom {
  0% {
    transform: translateY(100%);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideFromTop {
  0% {
    transform: translateY(-100%);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.bid-button {
  padding: 10px 20px;
  background: rgba(42, 138, 106, 0.95);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 3px 12px rgba(42, 138, 106, 0.4);
  min-width: 80px;
  
  &:hover {
    background: rgba(52, 158, 126, 1);
    transform: scale(1.02);
  }
  
  &:active {
    transform: scale(0.98);
  }
}

// Slide in from right transition
.panel-slide-enter-active {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
}

.panel-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease;
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(100%);
}
</style>
