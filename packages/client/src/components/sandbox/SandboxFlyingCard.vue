<template>
  <div 
    class="flying-card"
    :style="cardStyle"
  >
    <SandboxCard :card="card" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Card, TablePosition } from '@/engine'
import SandboxCard from './SandboxCard.vue'

const props = defineProps<{
  card: Card
  targetPosition: TablePosition
  delay: number
  onComplete: () => void
}>()

const stage = ref<'start' | 'flying' | 'done'>('start')

// Target positions relative to table center (percentages)
const targetCoords: Record<TablePosition, { x: number; y: number; rotate: number }> = {
  'bottom': { x: 50, y: 85, rotate: 0 },
  'top': { x: 50, y: 15, rotate: 180 },
  'left': { x: 15, y: 50, rotate: 90 },
  'right': { x: 85, y: 50, rotate: -90 },
  'top-left': { x: 25, y: 15, rotate: 180 },
  'top-right': { x: 75, y: 15, rotate: 180 },
}

const cardStyle = computed(() => {
  const target = targetCoords[props.targetPosition]
  
  if (stage.value === 'start') {
    // Start at deck position (center)
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%) scale(0.8)',
      opacity: 0,
      transition: 'none',
    }
  }
  
  if (stage.value === 'flying') {
    // Animate to target
    return {
      left: `${target.x}%`,
      top: `${target.y}%`,
      transform: `translate(-50%, -50%) rotate(${target.rotate}deg)`,
      opacity: 1,
      transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    }
  }
  
  // Done - hide
  return {
    opacity: 0,
    transition: 'opacity 0.1s',
  }
})

onMounted(() => {
  // Start animation after delay
  setTimeout(() => {
    stage.value = 'flying'
    
    // Complete after animation
    setTimeout(() => {
      stage.value = 'done'
      props.onComplete()
    }, 450)
  }, props.delay)
})
</script>

<style scoped>
.flying-card {
  position: absolute;
  z-index: 1000;
  pointer-events: none;
}
</style>
