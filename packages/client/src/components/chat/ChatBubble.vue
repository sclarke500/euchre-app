<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import type { ChatMessage } from '@67cards/shared'

const props = withDefaults(defineProps<{
  message: ChatMessage
  position: 'top' | 'left' | 'right' | 'bottom'
  /** If true, bubble stays visible (for testing/positioning) */
  persistent?: boolean
}>(), {
  persistent: false,
})

const emit = defineEmits<{
  dismiss: []
}>()

const isVisible = ref(true)
const isFading = ref(false)

// Calculate duration: 3s base + 1s per 50 chars, max 8s
const duration = computed(() => {
  const baseMs = 3000
  const perCharMs = 1000 / 50
  return Math.min(8000, baseMs + props.message.text.length * perCharMs)
})

let fadeTimer: ReturnType<typeof setTimeout> | null = null
let dismissTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  // Skip timers if persistent
  if (props.persistent) return
  
  // Start fade-out animation before full dismiss
  fadeTimer = setTimeout(() => {
    isFading.value = true
  }, duration.value - 300) // Start fade 300ms before dismiss
  
  // Fully dismiss after duration
  dismissTimer = setTimeout(() => {
    isVisible.value = false
    emit('dismiss')
  }, duration.value)
})

onUnmounted(() => {
  if (fadeTimer) clearTimeout(fadeTimer)
  if (dismissTimer) clearTimeout(dismissTimer)
})

// Tail position based on avatar position
const tailClass = computed(() => {
  switch (props.position) {
    case 'top': return 'tail-bottom'
    case 'bottom': return 'tail-top'
    case 'left': return 'tail-right'
    case 'right': return 'tail-left'
    default: return 'tail-bottom'
  }
})
</script>

<template>
  <Transition name="bubble">
    <div
      v-if="isVisible"
      class="chat-bubble"
      :class="[tailClass, { fading: isFading }]"
    >
      <span class="bubble-text">{{ message.text }}</span>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.chat-bubble {
  position: absolute;
  max-width: 180px;
  padding: 8px 12px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(245, 245, 245, 0.98) 100%
  );
  border-radius: 16px;
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.15),
    0 1px 3px rgba(0, 0, 0, 0.1);
  z-index: 450;
  pointer-events: none;
  transition: opacity 0.3s ease;
  
  &.fading {
    opacity: 0;
  }
}

.bubble-text {
  color: #1f2937;
  font-size: 13px;
  line-height: 1.4;
  word-wrap: break-word;
}

// Speech bubble tails
.chat-bubble::after {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border: 8px solid transparent;
}

.tail-bottom::after {
  bottom: -14px;
  left: 50%;
  transform: translateX(-50%);
  border-top-color: rgba(245, 245, 245, 0.98);
  border-bottom: none;
}

.tail-top::after {
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  border-bottom-color: rgba(255, 255, 255, 0.95);
  border-top: none;
}

.tail-left::after {
  left: -14px;
  top: 50%;
  transform: translateY(-50%);
  border-right-color: rgba(250, 250, 250, 0.96);
  border-left: none;
}

.tail-right::after {
  right: -14px;
  top: 50%;
  transform: translateY(-50%);
  border-left-color: rgba(250, 250, 250, 0.96);
  border-right: none;
}

// Entry/exit animation
.bubble-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.bubble-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.bubble-enter-from {
  opacity: 0;
  transform: scale(0.8) translateY(10px);
}

.bubble-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(-5px);
}
</style>
