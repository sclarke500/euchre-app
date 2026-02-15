<template>
  <div class="card-table-root">
    <div ref="boardRef" class="board">
      <!-- Table surface -->
      <div ref="tableRef" class="table-surface" :class="layout">
        <!-- Watermark with game name -->
        <div v-if="gameName" class="table-watermark">
          <img src="@/assets/AppLogo.png" alt="" class="watermark-logo" />
          <span class="watermark-name">{{ gameName }}</span>
        </div>
        <!-- Player avatars positioned outside the table -->
        <div
          v-for="(seat, i) in seatData"
          :key="'avatar-' + i"
          class="player-avatar"
          :class="{ 'is-user': seat.isUser, 'is-current-turn': currentTurnSeat === i }"
          :style="{ ...avatarStyles[i], opacity: props.avatarOpacities[i] ?? 1 }"
        >
          <div class="avatar-circle">{{ playerNames[i]?.[0] ?? '?' }}</div>
          <div class="player-name">{{ playerNames[i] }}</div>
          <div class="player-status" :class="{ visible: !!playerStatuses[i] }">{{ playerStatuses[i] }}</div>
          <div class="info-tags">
            <slot :name="`player-info-${i}`" />
          </div>
        </div>

        <!-- Dealer chip - single element that animates between seats -->
        <div
          v-if="dealerSeat >= 0"
          class="dealer-chip"
          :class="`dealer-seat-${dealerSeat}`"
        >D</div>
      </div>

      <!-- All cards rendered here -->
      <BoardCard
        v-for="managed in engine.allCards.value"
        :key="managed.card.id"
        :ref="(el) => engine.setCardRef(managed.card.id, el)"
        :card="managed.card"
        :face-up="managed.faceUp"
        :dimmed="!!dimmedCardIds?.size && dimmedCardIds.has(managed.card.id)"
        :selected="!!selectedCardIds?.size && selectedCardIds.has(managed.card.id)"
        :highlighted="!!highlightedCardIds?.size && highlightedCardIds.has(managed.card.id)"
        @click="$emit('card-click', managed.card.id)"
      />

      <!-- Overlay slot for game-specific UI (modals, score, etc.) -->
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, provide, watch } from 'vue'
import BoardCard from './BoardCard.vue'
import { useCardTable, type CardTableEngine } from '@/composables/useCardTable'
import { computeTableLayout, type SeatLayout, type TableLayoutResult } from '@/composables/useTableLayout'

const props = withDefaults(defineProps<{
  playerCount: number
  playerNames: string[]
  layout?: 'normal' | 'wide'
  engine?: CardTableEngine
  dealerSeat?: number
  playerStatuses?: string[]
  currentTurnSeat?: number
  dimmedCardIds?: Set<string>
  selectedCardIds?: Set<string>
  highlightedCardIds?: Set<string>
  avatarOpacities?: number[]
  gameName?: string
}>(), {
  layout: 'normal',
  dealerSeat: -1,
  playerStatuses: () => [],
  currentTurnSeat: -1,
  avatarOpacities: () => [],
  gameName: '',
})

defineEmits<{
  'card-click': [cardId: string]
}>()

const boardRef = ref<HTMLElement | null>(null)
const tableRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

// Use provided engine or create our own
const engine = props.engine ?? useCardTable()
const seatData = ref<SeatLayout[]>([])
const lastLayoutResult = ref<TableLayoutResult | null>(null)

/**
 * Compute CSS position for each avatar relative to the table surface.
 * Uses hand positions from the layout result, converting from board-space px
 * to table-relative percentages so avatars sit just outside the table edge.
 */
const avatarStyles = computed(() => {
  const layout = lastLayoutResult.value
  if (!layout) return seatData.value.map(() => ({}))
  const { tableBounds } = layout

  return seatData.value.map((seat) => {
    // Convert board-space hand position to table-relative percentage
    const pctX = ((seat.handPosition.x - tableBounds.left) / tableBounds.width * 100)
    const pctY = ((seat.handPosition.y - tableBounds.top) / tableBounds.height * 100)

    switch (seat.side) {
      case 'left':
        return { left: '-40px', top: `${pctY}%` }
      case 'right':
        return { left: 'calc(100% + 40px)', top: `${pctY}%` }
      case 'top':
        return { left: `${pctX}%`, top: '-30px' }
      default: // bottom (user seat)
        return { left: `${pctX}%`, top: 'calc(100% + 30px)' }
    }
  })
})

function computeLayout() {
  if (!boardRef.value) return
  // Use offsetWidth/Height (layout dimensions) instead of getBoundingClientRect()
  // because CSS transforms (e.g. scale(0.85) on small screens) cause getBCR to
  // return visual dimensions, while absolute px positioning uses layout coordinates.
  const w = boardRef.value.offsetWidth
  const h = boardRef.value.offsetHeight
  const result = computeTableLayout(w, h, props.layout, props.playerCount)
  seatData.value = result.seats
  lastLayoutResult.value = result

  // Set CSS vars so .table-surface position stays in sync with JS layout
  const { tableBounds } = result
  const el = boardRef.value
  el.style.setProperty('--table-left', `${(tableBounds.left / w * 100).toFixed(2)}%`)
  el.style.setProperty('--table-right', `${((w - tableBounds.right) / w * 100).toFixed(2)}%`)

  return result
}

onMounted(() => {
  computeLayout()
  if (boardRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      computeLayout()
    })
    resizeObserver.observe(boardRef.value)
  }
})

watch(() => [props.playerCount, props.layout], () => {
  computeLayout()
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

// Provide engine and layout for director composables
provide('cardTable', engine)
provide('cardTableBoardRef', boardRef)

// Expose engine and layout for parent imperative access
defineExpose({
  engine,
  boardRef,
  computeLayout,
  getSeatData: () => seatData.value,
})
</script>

<style scoped lang="scss">
.card-table-root {
  width: 100%;
  height: 100%;
  color: #fff;
}

.board {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;

  // Table palette — change these to retheme
  --felt: #24735a;
  --felt-dark: #1a5440;
  --rail: #4a3728;
  --rail-accent: #5c4533;
  --surface-bg: #23232e;

  background:
    radial-gradient(ellipse at center 40%, rgba(255,255,255,0.04) 0%, transparent 50%),
    radial-gradient(ellipse at center 40%, var(--surface-bg) 0%, #181820 100%);
}

.table-surface {
  position: absolute;
  top: 15%;
  bottom: 20%;
  border-radius: 40px;
  background:
    radial-gradient(ellipse at center, var(--felt) 0%, var(--felt-dark) 70%);
  border: 8px solid var(--rail);
  box-shadow:
    inset 0 0 60px rgba(0, 0, 0, 0.25),
    0 4px 20px rgba(0, 0, 0, 0.5),
    0 0 0 2px var(--rail-accent);

  // Watermark with game name
  .table-watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    pointer-events: none;
    user-select: none;
    
    .watermark-logo {
      width: 120px;
      height: 120px;
      object-fit: contain;
      opacity: 0.1;
    }
    
    .watermark-name {
      font-family: 'Rock Salt', cursive;
      font-size: 1.1rem;
      font-weight: 400;
      color: white;
      text-shadow: 0 0 12px rgba(255, 255, 255, 0.6), 1px 1px 2px rgba(0, 0, 0, 0.5);
      letter-spacing: 0.08em;
      margin-top: -20px;
      -webkit-text-stroke: 0.5px white;
      opacity: 0.18;
    }
  }

  // Horizontal position driven by JS layout via CSS vars
  left: var(--table-left, 22%);
  right: var(--table-right, 22%);

  // Normal layout (4 players) - more square
  &.normal {
    border-radius: 30px;
  }
}

.player-avatar {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 300;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;

  .avatar-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #333344;
    border: 2px solid #4a4a60;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: bold;
    color: #ccc;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    transition: border-color var(--anim-slow) ease, box-shadow var(--anim-slow) ease;
  }

  .player-name {
    padding: 2px 10px;
    font-size: 13px;
    font-weight: 600;
    color: #ccc;
    white-space: nowrap;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 4px;
  }

  .player-status {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 2px;
    padding: 1px 8px;
    font-size: 10px;
    font-weight: 600;
    color: #ffd700;
    white-space: nowrap;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 4px;
    opacity: 0;
    transition: opacity var(--anim-slow) ease;
    pointer-events: none;

    &.visible {
      opacity: 1;
    }
  }

  .info-tags {
    display: flex;
    gap: 4px;
  }

  // Turn indicator glow — soft diffused halo
  &.is-current-turn .avatar-circle {
    border-color: rgba(255, 215, 0, 0.7);
    box-shadow:
      0 0 12px rgba(255, 215, 0, 0.3),
      0 0 30px rgba(255, 215, 0, 0.15),
      0 0 50px rgba(255, 215, 0, 0.08);
  }
}

.dealer-chip {
  position: absolute;
  z-index: 310;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fff 0%, #e0e0e0 100%);
  color: #2c3e50;
  font-size: 13px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  transform: translate(-50%, -50%);
  transition: left var(--anim-slower) ease, top var(--anim-slower) ease;

  // On-table, 50px offset to each player's left (from their perspective)
  &.dealer-seat-0 { left: calc(50% - 50px); top: calc(100% - 20px); }
  &.dealer-seat-1 { left: 20px; top: calc(50% - 50px); }
  &.dealer-seat-2 { left: calc(50% + 50px); top: 20px; }
  &.dealer-seat-3 { left: calc(100% - 20px); top: calc(50% + 50px); }
}
</style>
