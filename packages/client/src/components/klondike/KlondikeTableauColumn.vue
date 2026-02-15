<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import type { TableauColumn, KlondikeCard } from '@euchre/shared'
import Card from '../Card.vue'
import { getKlondikeAnimation } from '@/composables/useKlondikeAnimation'
import { useKlondikeStore } from '@/stores/klondikeStore'

const props = defineProps<{
  column: TableauColumn
  columnIndex: number
  selectedCardIndex: number | null
}>()

const emit = defineEmits<{
  tapCard: [columnIndex: number, cardIndex: number]
  tapEmpty: [columnIndex: number]
}>()

const animation = getKlondikeAnimation()
const store = useKlondikeStore()
const columnRef = ref<HTMLElement | null>(null)
const cardRefs = ref<Map<number, HTMLElement>>(new Map())

const isEmpty = computed(() => props.column.cards.length === 0)

// Check if a card is hidden (being animated)
function isCardHidden(cardId: string): boolean {
  return store.hiddenCardIds.has(cardId)
}

// Register column container for empty targets
watch(columnRef, (el) => {
  animation.registerContainer(`tableau-${props.columnIndex}`, el)
}, { immediate: true })

// Register each card element
function setCardRef(index: number, el: HTMLElement | null) {
  if (el) {
    cardRefs.value.set(index, el)
    animation.registerCard(`tableau-${props.columnIndex}-${index}`, el)
  } else {
    cardRefs.value.delete(index)
    animation.registerCard(`tableau-${props.columnIndex}-${index}`, null)
  }
}

// Re-register cards when column changes
watch(() => props.column.cards, () => {
  // Clean up old registrations
  cardRefs.value.forEach((_, index) => {
    if (index >= props.column.cards.length) {
      animation.registerCard(`tableau-${props.columnIndex}-${index}`, null)
      cardRefs.value.delete(index)
    }
  })
}, { deep: true })

onBeforeUnmount(() => {
  animation.registerContainer(`tableau-${props.columnIndex}`, null)
  cardRefs.value.forEach((_, index) => {
    animation.registerCard(`tableau-${props.columnIndex}-${index}`, null)
  })
})

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
  <div 
    ref="columnRef"
    class="tableau-column" 
    :style="{ height: `calc(var(--card-height, 105px) * ${columnHeightMultiplier})` }"
  >
    <!-- Empty column placeholder -->
    <div v-if="isEmpty" class="empty-column" @click="handleEmptyClick">
      <span class="king-hint">K</span>
    </div>

    <!-- Stacked cards with transition -->
    <TransitionGroup v-else name="card-stack" tag="div" class="cards-container" appear>
      <div
        v-for="(card, index) in column.cards"
        :key="card.id"
        :ref="(el) => setCardRef(index, el as HTMLElement)"
        class="stacked-card"
        :class="{ selected: isSelected(index), hidden: isCardHidden(card.id) }"
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
    </TransitionGroup>
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

.cards-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.stacked-card {
  position: absolute;
  left: 0;
  width: var(--card-width, $card-width);
  height: var(--card-height, $card-height);
  transition: top 0.3s ease-out, transform 0.3s ease-out, opacity 0.3s ease-out;

  &.selected :deep(.card) {
    box-shadow: 0 0 0 3px $secondary-color, 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  &.hidden {
    visibility: hidden;
  }
}

// Vue TransitionGroup classes
.card-stack-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.card-stack-leave-active {
  transition: all 0.2s ease-in;
  position: absolute;
}

.card-stack-enter-from {
  opacity: 0;
  transform: scale(0.7) translateY(-25px);
}

.card-stack-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(-15px);
}

.card-stack-move {
  transition: all 0.3s ease-out;
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
