<script setup lang="ts">
import { computed } from 'vue'
import type { KlondikeCard } from '@euchre/shared'
import Card from '../Card.vue'

const props = defineProps<{
  stock: KlondikeCard[]
  waste: KlondikeCard[]
  visibleWasteCards: KlondikeCard[]
  isWasteSelected: boolean
}>()

const emit = defineEmits<{
  drawCard: []
  tapWaste: []
}>()

const hasStock = computed(() => props.stock.length > 0)
const hasWaste = computed(() => props.waste.length > 0)

function handleStockClick() {
  emit('drawCard')
}

function handleWasteClick() {
  emit('tapWaste')
}
</script>

<template>
  <div class="stock-waste">
    <!-- Stock pile (draw pile) -->
    <div class="stock" :class="{ empty: !hasStock }" @click="handleStockClick">
      <div v-if="hasStock" class="card-back">
        <div class="card-back-pattern"></div>
      </div>
      <div v-else class="empty-stock">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 4v6h6" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      </div>
    </div>

    <!-- Waste pile (drawn cards) - fanned display -->
    <div class="waste-area" :class="{ selected: isWasteSelected }" @click="handleWasteClick">
      <div v-if="!hasWaste" class="waste-placeholder"></div>
      <div v-else class="waste-fan">
        <div
          v-for="(card, index) in visibleWasteCards"
          :key="card.id"
          class="waste-card"
          :style="{ '--fan-index': index }"
        >
          <Card :card="card" :selectable="index === visibleWasteCards.length - 1" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stock-waste {
  display: flex;
  gap: $spacing-sm;
}

.stock {
  width: var(--klondike-card-width, $card-width);
  height: var(--klondike-card-height, $card-height);
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;

  &.empty {
    background: rgba(255, 255, 255, 0.1);
    border: 2px dashed rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.empty-stock {
  color: rgba(255, 255, 255, 0.4);

  svg {
    width: 32px;
    height: 32px;
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

.waste-area {
  position: relative;
  // Width to accommodate fanned cards (card width + 2 * fan offset)
  width: calc(var(--klondike-card-width, $card-width) + 40px);
  height: var(--klondike-card-height, $card-height);
  cursor: pointer;
  flex-shrink: 0;

  &.selected .waste-card:last-child :deep(.card) {
    box-shadow: 0 0 0 3px $secondary-color, 0 4px 12px rgba(0, 0, 0, 0.4);
  }
}

.waste-placeholder {
  width: var(--klondike-card-width, $card-width);
  height: 100%;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border: 2px dashed rgba(255, 255, 255, 0.1);
}

.waste-fan {
  position: relative;
  width: 100%;
  height: 100%;
}

.waste-card {
  position: absolute;
  top: 0;
  left: calc(var(--fan-index, 0) * 20px);
  transition: left 0.2s ease-out;
}
</style>
