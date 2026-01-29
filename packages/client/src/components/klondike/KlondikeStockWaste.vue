<script setup lang="ts">
import { computed } from 'vue'
import type { KlondikeCard } from '@euchre/shared'
import Card from '../Card.vue'

const props = defineProps<{
  stock: KlondikeCard[]
  waste: KlondikeCard[]
  isWasteSelected: boolean
}>()

const emit = defineEmits<{
  drawCard: []
  tapWaste: []
}>()

const wasteTopCard = computed(() =>
  props.waste.length > 0 ? props.waste[props.waste.length - 1] : null
)

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

    <!-- Waste pile (drawn cards) -->
    <div class="waste" :class="{ selected: isWasteSelected }" @click="handleWasteClick">
      <div v-if="!wasteTopCard" class="waste-placeholder"></div>
      <Card v-else :card="wasteTopCard" selectable />
    </div>
  </div>
</template>

<style scoped lang="scss">
.stock-waste {
  display: flex;
  gap: $spacing-sm;
}

.stock,
.waste {
  width: $card-width;
  height: $card-height;
  border-radius: 6px;
  cursor: pointer;
}

.stock {
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

.waste {
  position: relative;

  &.selected :deep(.card) {
    box-shadow: 0 0 0 3px $secondary-color, 0 4px 12px rgba(0, 0, 0, 0.4);
  }
}

.waste-placeholder {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border: 2px dashed rgba(255, 255, 255, 0.1);
}
</style>
