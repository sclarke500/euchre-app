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

// Tail points TOWARD the avatar
// position = where the avatar is relative to center
const tailClass = computed(() => {
  switch (props.position) {
    case 'top': return 'tail-top'       // Avatar above → tail points up
    case 'bottom': return 'tail-bottom' // Avatar below → tail points down
    case 'left': return 'tail-left'     // Avatar on left → tail points left
    case 'right': return 'tail-right'   // Avatar on right → tail points right
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
  max-width: 240px;
  padding: 6px 10px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.98) 0%,
    rgba(248, 248, 248, 0.98) 100%
  );
  border-radius: 12px;
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.2),
    0 1px 3px rgba(0, 0, 0, 0.1);
  z-index: 450;
  pointer-events: none;
  transition: opacity 0.3s ease;
  
  &.fading {
    opacity: 0;
  }
}

.bubble-text {
  color: #1a1a1a;
  font-size: 14px;
  line-height: 1.2;
  word-wrap: break-word;
}

// Speech bubble tails - bigger triangles, flush with bubble
.chat-bubble::after {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border: 10px solid transparent;
}

// Tail pointing DOWN (avatar below bubble)
.tail-bottom::after {
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  border-top-color: rgba(248, 248, 248, 0.98);
  border-bottom: none;
}

// Tail pointing UP (avatar above bubble)
.tail-top::after {
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  border-bottom-color: rgba(255, 255, 255, 0.98);
  border-top: none;
}

// Tail pointing LEFT (avatar to the left)
.tail-left::after {
  left: -10px;
  top: 50%;
  transform: translateY(-50%);
  border-right-color: rgba(252, 252, 252, 0.98);
  border-left: none;
}

// Tail pointing RIGHT (avatar to the right)
.tail-right::after {
  right: -10px;
  top: 50%;
  transform: translateY(-50%);
  border-left-color: rgba(252, 252, 252, 0.98);
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
