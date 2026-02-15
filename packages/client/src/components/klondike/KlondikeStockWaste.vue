<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import type { KlondikeCard } from '@euchre/shared'
import Card from '../Card.vue'
import { getKlondikeAnimation } from '@/composables/useKlondikeAnimation'

const props = withDefaults(defineProps<{
  stock: KlondikeCard[]
  waste: KlondikeCard[]
  visibleWasteCards: KlondikeCard[]
  isWasteSelected: boolean
  layout?: 'horizontal' | 'vertical'
}>(), {
  layout: 'horizontal'
})

const emit = defineEmits<{
  drawCard: []
  tapWaste: []
}>()

const animation = getKlondikeAnimation()
const stockRef = ref<HTMLElement | null>(null)
const wasteRef = ref<HTMLElement | null>(null)
const wasteCardRefs = ref<Map<number, HTMLElement>>(new Map())

const hasStock = computed(() => props.stock.length > 0)
const hasWaste = computed(() => props.waste.length > 0)
const isVertical = computed(() => props.layout === 'vertical')

// Register stock container
watch(stockRef, (el) => {
  animation.registerContainer('stock', el)
}, { immediate: true })

// Register waste container
watch(wasteRef, (el) => {
  animation.registerContainer('waste', el)
}, { immediate: true })

// Register waste top card (the playable one)
function setWasteCardRef(index: number, el: HTMLElement | null) {
  if (el) {
    wasteCardRefs.value.set(index, el)
    // Only register the top card as "waste" for animation purposes
    if (index === props.visibleWasteCards.length - 1) {
      animation.registerCard('waste', el)
    }
  } else {
    wasteCardRefs.value.delete(index)
  }
}

// Re-register when visible cards change
watch(() => props.visibleWasteCards.length, () => {
  // Update waste card registration
  const topIndex = props.visibleWasteCards.length - 1
  const topEl = wasteCardRefs.value.get(topIndex)
  if (topEl) {
    animation.registerCard('waste', topEl)
  }
})

onBeforeUnmount(() => {
  animation.registerContainer('stock', null)
  animation.registerContainer('waste', null)
  animation.registerCard('waste', null)
})

function handleStockClick() {
  emit('drawCard')
}

function handleWasteClick() {
  emit('tapWaste')
}
</script>

<template>
  <div class="stock-waste" :class="{ vertical: isVertical }">
    <!-- Waste pile (drawn cards) - fanned display -->
    <!-- In vertical mode, waste comes first (on top) -->
    <div 
      v-if="isVertical"
      ref="wasteRef"
      class="waste-area" 
      :class="{ selected: isWasteSelected, vertical: isVertical }" 
      @click="handleWasteClick"
    >
      <div v-if="!hasWaste" class="waste-placeholder"></div>
      <TransitionGroup v-else name="waste-fan" tag="div" class="waste-fan" :class="{ vertical: isVertical }">
        <div
          v-for="(card, index) in visibleWasteCards"
          :key="card.id"
          :ref="(el) => setWasteCardRef(index, el as HTMLElement)"
          class="waste-card"
          :class="{ vertical: isVertical }"
          :style="{ '--fan-index': index }"
        >
          <Card :card="card" :selectable="index === visibleWasteCards.length - 1" />
        </div>
      </TransitionGroup>
    </div>

    <!-- Stock pile (draw pile) -->
    <div ref="stockRef" class="stock" :class="{ empty: !hasStock }" @click="handleStockClick">
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

    <!-- Waste pile for horizontal layout (comes after stock) -->
    <div 
      v-if="!isVertical"
      ref="wasteRef"
      class="waste-area" 
      :class="{ selected: isWasteSelected }" 
      @click="handleWasteClick"
    >
      <div v-if="!hasWaste" class="waste-placeholder"></div>
      <TransitionGroup v-else name="waste-fan" tag="div" class="waste-fan">
        <div
          v-for="(card, index) in visibleWasteCards"
          :key="card.id"
          :ref="(el) => setWasteCardRef(index, el as HTMLElement)"
          class="waste-card"
          :style="{ '--fan-index': index }"
        >
          <Card :card="card" :selectable="index === visibleWasteCards.length - 1" />
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stock-waste {
  display: flex;
  gap: $spacing-sm;

  &.vertical {
    flex-direction: column;
    gap: $spacing-xs;
  }
}

.stock {
  width: var(--card-width, $card-width);
  height: var(--card-height, $card-height);
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
    width: 28px;
    height: 28px;
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

.waste-area {
  position: relative;
  // Width to accommodate fanned cards (card width + 2 * fan offset)
  width: calc(var(--card-width, $card-width) + 36px);
  height: var(--card-height, $card-height);
  cursor: pointer;
  flex-shrink: 0;

  &.vertical {
    width: var(--card-width, $card-width);
    height: calc(var(--card-height, $card-height) + 36px);
  }

  &.selected .waste-card:last-child :deep(.card) {
    box-shadow: 0 0 0 3px $secondary-color, 0 4px 12px rgba(0, 0, 0, 0.4);
  }
}

.waste-placeholder {
  width: var(--card-width, $card-width);
  height: var(--card-height, $card-height);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border: 2px dashed rgba(255, 255, 255, 0.1);
}

.waste-fan {
  position: relative;
  width: 100%;
  height: 100%;

  &.vertical {
    // For vertical, we need to position from bottom
  }
}

.waste-card {
  position: absolute;
  top: 0;
  left: calc(var(--fan-index, 0) * 18px);
  transition: left var(--anim-medium) ease-out, top var(--anim-medium) ease-out, transform var(--anim-medium) ease-out;

  &.vertical {
    left: 0;
    top: calc(var(--fan-index, 0) * 18px);
  }
}

.waste-fan-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.waste-fan-leave-active {
  transition: all 0.2s ease-in;
  position: absolute;
}

.waste-fan-enter-from {
  opacity: 0;
  transform: scale(0.7) translateX(-20px);
}

.waste-fan-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(-15px);
}

.waste-fan-move {
  transition: all 0.3s ease-out;
}
</style>
