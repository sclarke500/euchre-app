<template>
  <Transition name="wheel-fade">
    <div v-if="visible" class="bid-wheel-container">
      <div class="bid-wheel" @wheel.prevent="handleWheel">
        <!-- Visible values -->
        <div class="wheel-viewport" ref="viewportRef">
          <div class="wheel-track" :style="trackStyle">
            <div 
              v-for="val in allValues" 
              :key="val"
              class="wheel-item"
              :class="{ selected: val === modelValue }"
            >
              {{ val === 0 ? 'Nil' : val }}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Bid button -->
      <button class="bid-button" @click="$emit('bid')">
        {{ modelValue === 0 ? 'Bid Nil' : `Bid ${modelValue}` }}
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

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

const trackStyle = computed(() => ({
  transform: `translateY(${-props.modelValue * itemHeight}px)`
}))

function handleWheel(e: WheelEvent) {
  // Scroll down = increase value, scroll up = decrease
  if (e.deltaY > 0 && props.modelValue < 13) {
    emit('update:modelValue', props.modelValue + 1)
  } else if (e.deltaY < 0 && props.modelValue > 0) {
    emit('update:modelValue', props.modelValue - 1)
  }
}
</script>

<style scoped lang="scss">
.bid-wheel-container {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  top: 50%;
  transform: translateY(-50%);
  z-index: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.bid-wheel {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(245, 245, 248, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 20px;
  padding: 8px 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(0, 0, 0, 0.08);
  cursor: ns-resize;
}

.wheel-viewport {
  width: 56px;
  height: calc(44px * 3); // Show 3 items
  overflow: hidden;
  position: relative;
  
  // Fade edges
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 25%,
    black 75%,
    transparent 100%
  );
}

.wheel-track {
  transition: transform 0.15s ease-out;
  padding-top: 44px; // Offset so selected item is centered
}

.wheel-item {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.25);
  transition: all 0.15s ease;
  
  &.selected {
    font-size: 26px;
    font-weight: 700;
    color: #1a1a2e;
  }
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

// Transition
.wheel-fade-enter-active,
.wheel-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.wheel-fade-enter-from,
.wheel-fade-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(20px);
}
</style>
