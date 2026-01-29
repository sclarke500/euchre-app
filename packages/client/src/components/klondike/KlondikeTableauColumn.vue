<script setup lang="ts">
import { computed } from 'vue'
import type { TableauColumn, KlondikeCard } from '@euchre/shared'
import Card from '../Card.vue'

const props = defineProps<{
  column: TableauColumn
  columnIndex: number
  selectedCardIndex: number | null
}>()

const emit = defineEmits<{
  tapCard: [columnIndex: number, cardIndex: number]
  tapEmpty: [columnIndex: number]
}>()

const isEmpty = computed(() => props.column.cards.length === 0)

// Offset amounts for card stacking
const FACE_DOWN_OFFSET = 20 // px to show for face-down cards
const FACE_UP_OFFSET = 32 // px to show for face-up cards

// Calculate position for each card
function getCardStyle(index: number) {
  let top = 0
  for (let i = 0; i < index; i++) {
    const card = props.column.cards[i]
    top += card?.faceUp ? FACE_UP_OFFSET : FACE_DOWN_OFFSET
  }
  return { top: `${top}px` }
}

// Calculate total column height
const columnHeight = computed(() => {
  if (isEmpty.value) return `${105}px` // card height

  let height = 105 // last card full height
  for (let i = 0; i < props.column.cards.length - 1; i++) {
    const card = props.column.cards[i]
    height += card?.faceUp ? FACE_UP_OFFSET : FACE_DOWN_OFFSET
  }
  return `${height}px`
})

function isSelected(cardIndex: number): boolean {
  if (props.selectedCardIndex === null) return false
  return cardIndex >= props.selectedCardIndex
}

function handleCardClick(cardIndex: number, card: KlondikeCard) {
  if (card.faceUp) {
    emit('tapCard', props.columnIndex, cardIndex)
  }
}

function handleEmptyClick() {
  emit('tapEmpty', props.columnIndex)
}
</script>

<template>
  <div class="tableau-column" :style="{ height: columnHeight }">
    <!-- Empty column placeholder -->
    <div v-if="isEmpty" class="empty-column" @click="handleEmptyClick">
      <span class="king-hint">K</span>
    </div>

    <!-- Stacked cards -->
    <template v-else>
      <div
        v-for="(card, index) in column.cards"
        :key="card.id"
        class="stacked-card"
        :class="{ selected: isSelected(index) }"
        :style="getCardStyle(index)"
        @click="handleCardClick(index, card)"
      >
        <!-- Face-up card -->
        <Card v-if="card.faceUp" :card="card" selectable />
        <!-- Face-down card -->
        <div v-else class="card-back">
          <div class="card-back-pattern"></div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.tableau-column {
  position: relative;
  width: $card-width;
  min-height: $card-height;
}

.empty-column {
  width: 100%;
  height: $card-height;
  background: rgba(255, 255, 255, 0.05);
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.king-hint {
  font-size: 1.5rem;
  color: rgba(255, 255, 255, 0.2);
  font-weight: bold;
}

.stacked-card {
  position: absolute;
  left: 0;
  width: $card-width;
  height: $card-height;

  &.selected :deep(.card) {
    box-shadow: 0 0 0 3px $secondary-color, 0 4px 12px rgba(0, 0, 0, 0.4);
  }
}

.card-back {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #2c5282 0%, #1a365d 100%);
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
}

.card-back-pattern {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  bottom: 8px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;

  &::before {
    content: '';
    position: absolute;
    top: 4px;
    left: 4px;
    right: 4px;
    bottom: 4px;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 4px,
      rgba(255, 255, 255, 0.05) 4px,
      rgba(255, 255, 255, 0.05) 8px
    );
  }
}
</style>
