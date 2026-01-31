<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
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

// Use CSS custom property values or defaults
// These are percentages of card height
const FACE_DOWN_OFFSET_RATIO = 0.19 // ~20px for 105px card
const FACE_UP_OFFSET_RATIO = 0.30 // ~32px for 105px card

// Calculate position for each card (as percentage of card height)
function getCardStyle(index: number) {
  let offset = 0
  for (let i = 0; i < index; i++) {
    const card = props.column.cards[i]
    offset += card?.faceUp ? FACE_UP_OFFSET_RATIO : FACE_DOWN_OFFSET_RATIO
  }
  // Use calc with CSS custom property
  return {
    top: `calc(var(--card-height, 105px) * ${offset})`
  }
}

// Calculate total column height
const columnHeightMultiplier = computed(() => {
  if (isEmpty.value) return 1

  let multiplier = 1 // last card full height
  for (let i = 0; i < props.column.cards.length - 1; i++) {
    const card = props.column.cards[i]
    multiplier += card?.faceUp ? FACE_UP_OFFSET_RATIO : FACE_DOWN_OFFSET_RATIO
  }
  return multiplier
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
  <div class="tableau-column" :style="{ height: `calc(var(--card-height, 105px) * ${columnHeightMultiplier})` }">
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
  width: var(--card-width, $card-width);
  min-height: var(--card-height, $card-height);
}

.empty-column {
  width: 100%;
  height: var(--card-height, $card-height);
  background: rgba(255, 255, 255, 0.05);
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.king-hint {
  font-size: 1.25rem;
  color: rgba(255, 255, 255, 0.2);
  font-weight: bold;
}

.stacked-card {
  position: absolute;
  left: 0;
  width: var(--card-width, $card-width);
  height: var(--card-height, $card-height);

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
  top: 6px;
  left: 6px;
  right: 6px;
  bottom: 6px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;

  &::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    right: 3px;
    bottom: 3px;
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
