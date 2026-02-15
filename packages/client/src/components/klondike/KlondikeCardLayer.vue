<script setup lang="ts">
/**
 * Single rendering layer for all Klondike cards
 * Cards are positioned absolutely and animate between positions
 */
import { computed } from 'vue'
import type { KlondikeEngine } from '@/composables/useKlondikeEngine'
import BoardCard from '../BoardCard.vue'

const props = defineProps<{
  engine: KlondikeEngine
}>()

const cards = computed(() => props.engine.allCards.value)

function setCardRef(cardId: string, el: any) {
  props.engine.setCardRef(cardId, el)
}
</script>

<template>
  <div class="klondike-card-layer">
    <BoardCard
      v-for="managed in cards"
      :key="managed.card.id"
      :ref="(el) => setCardRef(managed.card.id, el)"
      :card="{
        id: managed.card.id,
        suit: managed.card.suit,
        rank: managed.card.rank,
      }"
      :face-up="managed.card.faceUp"
      :initial-position="managed.position"
      :dimmed="false"
    />
  </div>
</template>

<style scoped lang="scss">
.klondike-card-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  
  :deep(.board-card) {
    pointer-events: auto;
  }
}
</style>
