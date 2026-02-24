<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { ContainerRect } from './useKlondikeLayout'
import type { KlondikeState } from '@67cards/shared'

const props = defineProps<{
  state: KlondikeState
}>()

const emit = defineEmits<{
  containerMeasured: [type: 'stock' | 'waste' | 'foundation' | 'tableau', index: number | null, rect: ContainerRect]
  stockClick: []
  wasteClick: []
  foundationClick: [index: number]
  tableauClick: [index: number]
}>()

import { isFullMode } from '@/utils/deviceMode'

// Orientation detection
// In full mode (16:9 ScaledContainer), always use landscape layout
const isLandscape = ref(isFullMode() || window.innerWidth > window.innerHeight)

function updateOrientation() {
  isLandscape.value = isFullMode() || window.innerWidth > window.innerHeight
}

// Refs for measuring
const stockRef = ref<HTMLElement | null>(null)
const wasteRef = ref<HTMLElement | null>(null)
const foundationRefs = ref<(HTMLElement | null)[]>([null, null, null, null])
const tableauRefs = ref<(HTMLElement | null)[]>([null, null, null, null, null, null, null])

// Foundation slots - no suit symbols (any Ace can go anywhere per standard rules)

// Measure and emit container positions (relative to parent container)
// Accounts for CSS transform scale by detecting scale factor
function measureContainers() {
  const parent = stockRef.value?.closest('.containers-layer') as HTMLElement | null
  if (!parent) return
  
  // Detect scale factor by comparing getBoundingClientRect to offsetWidth
  // If parent is scaled, rect.width will be different from offsetWidth
  const parentRect = parent.getBoundingClientRect()
  const scale = parent.offsetWidth > 0 ? parentRect.width / parent.offsetWidth : 1
  
  // Helper to get position relative to parent, accounting for scale
  function getRect(el: HTMLElement) {
    const rect = el.getBoundingClientRect()
    return {
      x: (rect.left - parentRect.left) / scale,
      y: (rect.top - parentRect.top) / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    }
  }
  
  if (stockRef.value) {
    emit('containerMeasured', 'stock', null, getRect(stockRef.value))
  }
  if (wasteRef.value) {
    emit('containerMeasured', 'waste', null, getRect(wasteRef.value))
  }
  foundationRefs.value.forEach((el, i) => {
    if (el) {
      emit('containerMeasured', 'foundation', i, getRect(el))
    }
  })
  tableauRefs.value.forEach((el, i) => {
    if (el) {
      emit('containerMeasured', 'tableau', i, getRect(el))
    }
  })
}

// Measure on mount and resize (with nextTick to ensure DOM is ready)
onMounted(async () => {
  // Wait for refs to be populated
  await new Promise(resolve => setTimeout(resolve, 50))
  measureContainers()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

function handleResize() {
  const wasLandscape = isLandscape.value
  updateOrientation()
  
  // If orientation actually changed, the watch will handle remeasure
  // Otherwise just remeasure after a short delay
  if (wasLandscape === isLandscape.value) {
    setTimeout(measureContainers, 100)
  }
}

// Re-measure when orientation changes - need longer delay for DOM to fully switch
watch(isLandscape, async () => {
  // Wait for Vue to process the v-if/v-else switch
  await nextTick()
  // Additional delay for layout to settle
  setTimeout(measureContainers, 200)
})

// Re-measure when state changes (in case layout shifts)
watch(() => props.state, measureContainers, { deep: true })

function setFoundationRef(index: number, el: HTMLElement | null) {
  foundationRefs.value[index] = el
}

function setTableauRef(index: number, el: HTMLElement | null) {
  tableauRefs.value[index] = el
}

// Expose refs for drag-and-drop zone detection
defineExpose({
  tableauRefs,
  foundationRefs,
})
</script>

<template>
  <div class="containers-layer">
    <!-- Portrait layout -->
    <div v-if="!isLandscape" class="portrait-layout">
      <!-- Top row: Foundations + Stock/Waste -->
      <div class="top-row">
        <div class="foundations-row">
          <div
            v-for="(_, index) in 4"
            :key="'f' + index"
            :ref="(el) => setFoundationRef(index, el as HTMLElement)"
            class="foundation-slot"
            @click="emit('foundationClick', index)"
          >
            <span class="ace-hint">A</span>
          </div>
        </div>
        <div class="stock-waste-row">
          <div ref="stockRef" class="stock-slot" @click="emit('stockClick')">
            <template v-if="state.stock.length === 0">
              <svg class="recycle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </template>
          </div>
          <div ref="wasteRef" class="waste-slot" @click="emit('wasteClick')"></div>
        </div>
      </div>

      <!-- Tableau -->
      <div class="tableau-row">
        <div
          v-for="(column, index) in state.tableau"
          :key="'t' + index"
          :ref="(el) => setTableauRef(index, el as HTMLElement)"
          class="tableau-slot"
          @click="emit('tableauClick', index)"
        >
          <span v-if="column.cards.length === 0" class="king-hint">K</span>
        </div>
      </div>
    </div>

    <!-- Landscape layout -->
    <div v-else class="landscape-layout">
      <!-- Left: Foundations -->
      <div class="left-column">
        <div
          v-for="(_, index) in 4"
          :key="'lf' + index"
          :ref="(el) => setFoundationRef(index, el as HTMLElement)"
          class="foundation-slot"
          @click="emit('foundationClick', index)"
        >
          <span class="ace-hint">A</span>
        </div>
      </div>

      <!-- Center: Tableau -->
      <div class="center-area">
        <div class="tableau-row">
          <div
            v-for="(column, index) in state.tableau"
            :key="'lt' + index"
            :ref="(el) => setTableauRef(index, el as HTMLElement)"
            class="tableau-slot"
            @click="emit('tableauClick', index)"
          >
            <span v-if="column.cards.length === 0" class="king-hint">K</span>
          </div>
        </div>
      </div>

      <!-- Right: Stock/Waste -->
      <div class="right-column">
        <div ref="stockRef" class="stock-slot" @click="emit('stockClick')">
          <template v-if="state.stock.length === 0">
            <svg class="recycle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </template>
        </div>
        <div ref="wasteRef" class="waste-slot" @click="emit('wasteClick')"></div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.containers-layer {
  width: 100%;
  height: 100%;
}

// Common slot styles
.foundation-slot,
.stock-slot,
.waste-slot,
.tableau-slot {
  width: var(--card-width, 50px);
  height: var(--card-height, 70px);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px dashed rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.foundation-slot {
  // Empty slot styling handled by base empty-slot styles
}

.stock-slot {
  .recycle-icon {
    width: 28px;
    height: 28px;
    color: rgba(255, 255, 255, 0.4);
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

.waste-slot {
  // Width to accommodate 3 fanned cards (1 full + 2 offsets of 0.22)
  width: calc(var(--card-width, 50px) * 1.5);
  border-style: dotted;
  border-color: rgba(255, 255, 255, 0.1);
}

.tableau-slot {
  height: var(--card-height, 70px);
}

.king-hint,
.ace-hint {
  font-size: 1.25rem;
  color: rgba(255, 255, 255, 0.2);
  font-weight: bold;
}

// Portrait layout
.portrait-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 8px;
  padding: 8px;
  padding-bottom: 64px; // Space for bottom toolbar + extra room for card stacks
}

.top-row {
  display: flex;
  justify-content: space-between;
  flex-shrink: 0;
}

.foundations-row {
  display: flex;
  gap: 4px;
}

.stock-waste-row {
  display: flex;
  gap: 8px;
}

.tableau-row {
  display: flex;
  justify-content: center;
  gap: 4px;
  flex: 1;
}

// Landscape layout
.landscape-layout {
  display: flex;
  height: 100%;
  gap: 8px;
  padding: 8px;
  padding-bottom: 64px; // Space for bottom toolbar + extra room for card stacks
}

.left-column {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.center-area {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.right-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

// Layout visibility controlled by v-if in template
</style>
