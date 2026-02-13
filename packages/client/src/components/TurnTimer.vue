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
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const now = ctx.currentTime
    
    // "Yoo" note (~800 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.frequency.setValueAtTime(800, now)
    
    // Natural whistle envelope for "yoo"
    gain1.gain.setValueAtTime(0, now)
    gain1.gain.linearRampToValueAtTime(0.5, now + 0.05) // quick attack
    gain1.gain.linearRampToValueAtTime(0.4, now + 0.4)  // sustain
    gain1.gain.linearRampToValueAtTime(0, now + 0.7)    // fade out
    
    osc1.start(now)
    osc1.stop(now + 0.8)
    
    // "Hoo" note (~500 Hz) - overlaps with yoo
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.frequency.setValueAtTime(500, now + 0.35)
    
    // Natural envelope for "hoo"
    gain2.gain.setValueAtTime(0, now + 0.35)
    gain2.gain.linearRampToValueAtTime(0.45, now + 0.4)  // quick attack
    gain2.gain.linearRampToValueAtTime(0.35, now + 0.8)  // sustain
    gain2.gain.linearRampToValueAtTime(0, now + 1.2)     // longer fade
    
    osc2.start(now + 0.35)
    osc2.stop(now + 1.3)
  } catch (e) {
    // Audio not available, fail silently
  }
}

// Play "ding ding" bell with reverb when entering yellow phase
function playDing() {
  if (hasPlayedDing.value) return
  hasPlayedDing.value = true
  
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const now = ctx.currentTime
    
    // Create simple reverb impulse response
    function createReverb(seconds = 1.5) {
      const sampleRate = ctx.sampleRate
      const length = sampleRate * seconds
      const impulse = ctx.createBuffer(2, length, sampleRate)
      const left = impulse.getChannelData(0)
      const right = impulse.getChannelData(1)
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2) // exponential decay
        left[i] = (Math.random() * 2 - 1) * decay
        right[i] = (Math.random() * 2 - 1) * decay
      }
      const convolver = ctx.createConvolver()
      convolver.buffer = impulse
      return convolver
    }
    
    const reverb = createReverb(1.8)
    const wetGain = ctx.createGain()
    wetGain.gain.value = 0.6 // reverb level
    reverb.connect(wetGain).connect(ctx.destination)
    
    // Bell ding with inharmonic partials
    function ding(time: number, baseFreq: number, volume = 0.5) {
      const partials = [1.0, 2.0, 2.7, 4.0] // classic bell ratios
      partials.forEach(ratio => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(baseFreq * ratio, time)
        
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(volume / partials.length, time)
        gain.gain.exponentialRampToValueAtTime(0.001, time + 2.5)
        
        osc.connect(gain)
        // Dry + wet paths
        gain.connect(ctx.destination) // dry
        gain.connect(reverb)          // wet
        
        osc.start(time)
        osc.stop(time + 3)
      })
    }
    
    ding(now, 880, 0.5)        // First ding (A5)
    ding(now + 0.15, 659, 0.45) // Second ding (E5)
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
