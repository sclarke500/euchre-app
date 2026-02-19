<template>
  <Transition name="timer-slide">
    <div v-if="visible" class="timer-panel">
      <div 
        class="turn-timer"
        :class="phase"
        :style="{ '--progress': progress }"
      >
        <div class="timer-pie"></div>
      </div>
      <button 
        v-if="showResetButton" 
        class="timer-reset-btn"
        @click="handleReset"
        title="Reset timer"
      >↻</button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  active: boolean  // True when it's the user's turn
  paused?: boolean // Pause the countdown (e.g., when bug report modal is open)
  gracePeriodMs?: number  // Time before timer appears (default 30s)
  countdownMs?: number    // Time to count down (default 30s)
  yellowAtMs?: number     // Turn yellow at this remaining time (default 15s)
  redAtMs?: number        // Turn red at this remaining time (default 5s)
  showResetButton?: boolean // Show reset button (default true)
}>(), {
  paused: false,
  gracePeriodMs: 30000,
  countdownMs: 30000,
  yellowAtMs: 15000,
  redAtMs: 5000,
  showResetButton: true,
})

const emit = defineEmits<{
  timeout: []
}>()

// Timer state
const visible = ref(false)
const remainingMs = ref(props.countdownMs)
const hasPlayedWhistle = ref(false)
const hasPlayedDing = ref(false)
let shouldEmitTimeout = true // Guard against race conditions

let graceTimer: ReturnType<typeof setTimeout> | null = null
let countdownInterval: ReturnType<typeof setInterval> | null = null
let startTime = 0
let pausedAt = 0 // Track when we paused to resume correctly

// Progress as 0-1 (1 = full, 0 = empty)
const progress = computed(() => remainingMs.value / props.countdownMs)

// Phase for color styling
const phase = computed(() => {
  if (remainingMs.value <= props.redAtMs) return 'red'
  if (remainingMs.value <= props.yellowAtMs) return 'yellow'
  return 'green'
})

// Simple synth notification - two quick rising tones
function playNotification() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const now = ctx.currentTime
    
    // First tone
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now) // A5
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    gain1.gain.setValueAtTime(0.3, now)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
    osc1.start(now)
    osc1.stop(now + 0.15)
    
    // Second tone (higher)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1108, now + 0.12) // C#6
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    gain2.gain.setValueAtTime(0.25, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    osc2.start(now + 0.12)
    osc2.stop(now + 0.3)
  } catch (e) {
    // Audio not available, fail silently
  }
}

// Play notification when timer first appears
function playAttention() {
  if (hasPlayedWhistle.value) return
  hasPlayedWhistle.value = true
  playNotification()
}

// Play notification when entering yellow phase
function playDing() {
  if (hasPlayedDing.value) return
  hasPlayedDing.value = true
  playNotification()
}

// Watch for timer becoming visible to play attention sound
watch(visible, (isVisible) => {
  if (isVisible) {
    playAttention()
  }
})

// Watch for yellow phase to play ding
watch(phase, (newPhase) => {
  if (newPhase === 'yellow') {
    playDing()
  }
})

function startGracePeriod() {
  cleanup()
  visible.value = false
  hasPlayedWhistle.value = false
  hasPlayedDing.value = false
  remainingMs.value = props.countdownMs
  
  graceTimer = setTimeout(() => {
    startCountdown()
  }, props.gracePeriodMs)
}

function startCountdown() {
  visible.value = true
  startTime = Date.now()
  remainingMs.value = props.countdownMs
  shouldEmitTimeout = true
  
  countdownInterval = setInterval(() => {
    const elapsed = Date.now() - startTime
    remainingMs.value = Math.max(0, props.countdownMs - elapsed)
    
    if (remainingMs.value <= 0 && shouldEmitTimeout) {
      cleanup()
      emit('timeout')
    }
  }, 50) // Update frequently for smooth animation
}

function cleanup() {
  if (graceTimer) {
    clearTimeout(graceTimer)
    graceTimer = null
  }
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

function reset() {
  shouldEmitTimeout = false // Prevent any pending timeout from firing
  cleanup()
  visible.value = false
  hasPlayedWhistle.value = false
  hasPlayedDing.value = false
  remainingMs.value = props.countdownMs
  // Restart grace period
  if (props.active) {
    startGracePeriod()
  }
}

function handleReset() {
  reset()
}

// Watch active prop to start/stop timer
watch(() => props.active, (isActive) => {
  if (isActive) {
    startGracePeriod()
  } else {
    shouldEmitTimeout = false // Prevent timeout when turn ends normally
    cleanup()
    visible.value = false
    hasPlayedWhistle.value = false
    hasPlayedDing.value = false
    remainingMs.value = props.countdownMs
  }
}, { immediate: true })

// Watch paused prop to freeze/resume countdown
watch(() => props.paused, (isPaused) => {
  if (isPaused) {
    // Freeze: store current remaining time and stop interval
    pausedAt = remainingMs.value
    if (countdownInterval) {
      clearInterval(countdownInterval)
      countdownInterval = null
    }
    if (graceTimer) {
      clearTimeout(graceTimer)
      graceTimer = null
    }
  } else if (props.active && pausedAt > 0) {
    // Resume: restart countdown from where we left off
    if (visible.value) {
      // Was in countdown phase - resume countdown
      startTime = Date.now() - (props.countdownMs - pausedAt)
      countdownInterval = setInterval(() => {
        const elapsed = Date.now() - startTime
        remainingMs.value = Math.max(0, props.countdownMs - elapsed)
        if (remainingMs.value <= 0 && shouldEmitTimeout) {
          cleanup()
          emit('timeout')
        }
      }, 50)
    } else {
      // Was in grace period - just restart grace
      startGracePeriod()
    }
    pausedAt = 0
  }
})

onUnmounted(() => {
  cleanup()
})

// Expose reset for parent to call when user takes action
defineExpose({ reset })
</script>

<style scoped lang="scss">
.timer-panel {
  position: fixed;
  left: max(12px, env(safe-area-inset-left));
  bottom: 50%;
  transform: translateY(50%);
  z-index: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: rgba(20, 20, 30, 0.85);
  border: 1px solid $surface-500;
  border-radius: 10px;
  backdrop-filter: blur(8px);
}

.turn-timer {
  width: 32px;
  height: 32px;
  position: relative;
}

.timer-pie {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: conic-gradient(
    var(--timer-color) calc(var(--progress) * 360deg),
    rgba(255, 255, 255, 0.15) calc(var(--progress) * 360deg)
  );
  transition: background 0.1s ease;
  
  // Inner circle cutout for donut effect
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60%;
    height: 60%;
    border-radius: 50%;
    background: rgba(20, 20, 30, 0.95);
  }
}

.timer-reset-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid $surface-500;
  border-radius: 6px;
  background: rgba(60, 60, 80, 0.8);
  color: #aaa;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(80, 80, 100, 0.9);
    color: #fff;
  }
  
  &:active {
    transform: scale(0.95);
  }
}

// Color phases
.turn-timer.green {
  --timer-color: #4ade80;
}

.turn-timer.yellow {
  --timer-color: #facc15;
  animation: pulse-yellow 0.5s ease-in-out infinite;
}

.turn-timer.red {
  --timer-color: #ef4444;
  animation: pulse-red 0.3s ease-in-out infinite;
}

@keyframes pulse-yellow {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes pulse-red {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

// Slide animation
.timer-slide-enter-active {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
}

.timer-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease;
}

.timer-slide-enter-from,
.timer-slide-leave-to {
  opacity: 0;
  transform: translateY(50%) translateX(-100%);
}
</style>
