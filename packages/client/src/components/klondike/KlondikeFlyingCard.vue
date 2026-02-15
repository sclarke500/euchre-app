<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { KlondikeCard } from '@euchre/shared'
import Card from '../Card.vue'

export interface FlyingCardData {
  cards: KlondikeCard[]
  from: { x: number; y: number }
  to: { x: number; y: number }
}

const props = defineProps<{
  data: FlyingCardData | null
}>()

const emit = defineEmits<{
  complete: []
}>()

const isAnimating = ref(false)
const position = ref({ x: 0, y: 0 })
const cards = ref<KlondikeCard[]>([])

watch(() => props.data, async (newData) => {
  if (!newData) {
    isAnimating.value = false
    return
  }

  // Set initial position
  cards.value = newData.cards
  position.value = { x: newData.from.x, y: newData.from.y }
  isAnimating.value = true

  // Wait for DOM update
  await nextTick()

  // Small delay to ensure initial position is rendered
  await new Promise(r => setTimeout(r, 10))

  // Animate to destination
  position.value = { x: newData.to.x, y: newData.to.y }

  // Wait for animation to complete
  setTimeout(() => {
    isAnimating.value = false
    emit('complete')
  }, 250)
}, { immediate: true })
</script>

<template>
  <div
    v-if="isAnimating && cards.length > 0"
    class="flying-card-container"
    :style="{
      transform: `translate(${position.x}px, ${position.y}px)`,
    }"
  >
    <div
      v-for="(card, index) in cards"
      :key="card.id"
      class="flying-card"
      :style="{ top: `${index * 28}px` }"
    >
      <Card :card="card" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.flying-card-container {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  pointer-events: none;
  transition: transform 0.25s ease-out;
}

.flying-card {
  position: absolute;
  left: 0;
  width: var(--card-width, 75px);
  height: var(--card-height, 105px);
}
</style>
