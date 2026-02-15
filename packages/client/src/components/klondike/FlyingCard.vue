<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Card from '../Card.vue'
import type { KlondikeCard } from '@euchre/shared'

const props = defineProps<{
  card: KlondikeCard
  startX: number
  startY: number
  endX: number
  endY: number
  width: number
  height: number
  delay?: number
}>()

const hasAnimated = ref(false)

// Start at source position, then animate to destination
const style = computed(() => {
  const x = hasAnimated.value ? props.endX : props.startX
  const y = hasAnimated.value ? props.endY : props.startY
  
  return {
    position: 'fixed' as const,
    left: `${x}px`,
    top: `${y}px`,
    width: `${props.width}px`,
    height: `${props.height}px`,
    zIndex: 9999,
    transition: hasAnimated.value ? 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1), top 0.25s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
    pointerEvents: 'none' as const,
    '--card-width': `${props.width}px`,
    '--card-height': `${props.height}px`,
  }
})

onMounted(() => {
  // Small delay then trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      hasAnimated.value = true
    })
  })
})
</script>

<template>
  <div class="flying-card" :style="style">
    <Card :card="card" />
  </div>
</template>

<style scoped>
.flying-card {
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4));
}
</style>
