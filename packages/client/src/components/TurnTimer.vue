<template>
  <div 
    v-if="visible" 
    class="turn-timer"
    :class="phase"
    :style="{ '--progress': progress }"
  >
    <div class="timer-pie"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  active: boolean  // True when it's the user's turn
  gracePeriodMs?: number  // Time before timer appears (default 30s)
  countdownMs?: number    // Time to count down (default 30s)
  yellowAtMs?: number     // Turn yellow at this remaining time (default 15s)
  redAtMs?: number        // Turn red at this remaining time (default 5s)
}>(), {
  gracePeriodMs: 30000,
  countdownMs: 30000,
  yellowAtMs: 15000,
  redAtMs: 5000,
})

const emit = defineEmits<{
  timeout: []
}>()

// Timer state
const visible = ref(false)
const remainingMs = ref(props.countdownMs)
const hasPlayedWhistle = ref(false)
const hasPlayedDing = ref(false)

let graceTimer: ReturnType<typeof setTimeout> | null = null
let countdownInterval: ReturnType<typeof setInterval> | null = null
let startTime = 0

// Progress as 0-1 (1 = full, 0 = empty)
const progress = computed(() => remainingMs.value / props.countdownMs)

// Phase for color styling
const phase = computed(() => {
  if (remainingMs.value <= props.redAtMs) return 'red'
  if (remainingMs.value <= props.yellowAtMs) return 'yellow'
  return 'green'
})

// Play "yoo-hoo" whistle when timer first appears
function playWhistle() {
  if (hasPlayedWhistle.value) return
  hasPlayedWhistle.value = true
  
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // First note (higher) - "yoo"
    const osc1 = audioCtx.createOscillator()
    const gain1 = audioCtx.createGain()
    osc1.connect(gain1)
    gain1.connect(audioCtx.destination)
    osc1.frequency.setValueAtTime(880, audioCtx.currentTime) // A5
    osc1.frequency.exponentialRampToValueAtTime(660, audioCtx.currentTime + 0.15) // Slide down
    osc1.type = 'sine'
    gain1.gain.setValueAtTime(0.25, audioCtx.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2)
    osc1.start(audioCtx.currentTime)
    osc1.stop(audioCtx.currentTime + 0.2)
    
    // Second note (lower) - "hoo"
    const osc2 = audioCtx.createOscillator()
    const gain2 = audioCtx.createGain()
    osc2.connect(gain2)
    gain2.connect(audioCtx.destination)
    osc2.frequency.setValueAtTime(660, audioCtx.currentTime + 0.2) // E5
    osc2.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.35) // Slide up
    osc2.type = 'sine'
    gain2.gain.setValueAtTime(0.25, audioCtx.currentTime + 0.2)
    gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4)
    osc2.start(audioCtx.currentTime + 0.2)
    osc2.stop(audioCtx.currentTime + 0.4)
  } catch (e) {
    // Audio not available, fail silently
  }
}

// Play "ding ding" bell when entering yellow phase
function playDing() {
  if (hasPlayedDing.value) return
  hasPlayedDing.value = true
  
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // First ding
    const osc1 = audioCtx.createOscillator()
    const gain1 = audioCtx.createGain()
    osc1.connect(gain1)
    gain1.connect(audioCtx.destination)
    osc1.frequency.value = 1200 // High bell tone
    osc1.type = 'sine'
    gain1.gain.setValueAtTime(0.3, audioCtx.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25)
    osc1.start(audioCtx.currentTime)
    osc1.stop(audioCtx.currentTime + 0.25)
    
    // Second ding (slightly delayed)
    const osc2 = audioCtx.createOscillator()
    const gain2 = audioCtx.createGain()
    osc2.connect(gain2)
    gain2.connect(audioCtx.destination)
    osc2.frequency.value = 1200
    osc2.type = 'sine'
    gain2.gain.setValueAtTime(0.3, audioCtx.currentTime + 0.3)
    gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.55)
    osc2.start(audioCtx.currentTime + 0.3)
    osc2.stop(audioCtx.currentTime + 0.55)
  } catch (e) {
    // Audio not available, fail silently
  }
}

// Watch for timer becoming visible to play whistle
watch(visible, (isVisible) => {
  if (isVisible) {
    playWhistle()
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
  
  countdownInterval = setInterval(() => {
    const elapsed = Date.now() - startTime
    remainingMs.value = Math.max(0, props.countdownMs - elapsed)
    
    if (remainingMs.value <= 0) {
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
  cleanup()
  visible.value = false
  hasPlayedWhistle.value = false
  hasPlayedDing.value = false
  remainingMs.value = props.countdownMs
}

// Watch active prop to start/stop timer
watch(() => props.active, (isActive) => {
  if (isActive) {
    startGracePeriod()
  } else {
    reset()
  }
}, { immediate: true })

onUnmounted(() => {
  cleanup()
})

// Expose reset for parent to call when user takes action
defineExpose({ reset })
</script>

<style scoped lang="scss">
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
</style>
