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
        
        <!-- Dealer chip - positioned on table, animates between seats -->
        <div
          v-if="dealerSeat >= 0"
          class="dealer-chip"
          :class="`dealer-seat-${dealerSeat}`"
        >D</div>
      </div>
      
      <!-- Opponent avatars - outside table-surface for proper z-index stacking -->
      <PlayerAvatar
        v-for="(seat, i) in seatData"
        :key="'avatar-' + i"
        v-show="!seat.isUser"
        :name="playerNames[i] ?? 'Player'"
        :is-current-turn="currentTurnSeat === i"
        :status="playerStatuses[i]"
        :position="getRailPosition(seat.side)"
        :custom-style="{ ...avatarStyles[i], opacity: props.avatarOpacities[i] ?? 1 }"
      >
        <slot :name="`player-info-${i}`" />
      </PlayerAvatar>

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

      <!-- User avatar at bottom center of screen -->
      <PlayerAvatar
        :name="playerNames[0] ?? 'You'"
        :is-current-turn="currentTurnSeat === 0"
        :is-user="true"
        position="bottom"
      >
        <slot name="user-info" />
      </PlayerAvatar>

      <!-- Overlay slot for game-specific UI (modals, score, etc.) -->
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, provide, watch } from 'vue'
import BoardCard from './BoardCard.vue'
import PlayerAvatar, { type AvatarPosition } from './PlayerAvatar.vue'
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
 * Map seat side to avatar position class
 */
function getRailPosition(side: string): AvatarPosition {
  switch (side) {
    case 'left': return 'rail-left'
    case 'right': return 'rail-right'
    case 'top': return 'rail-top'
    default: return 'bottom'
  }
}

/**
 * Compute CSS position for each avatar in board-space pixels.
 * Avatars are positioned ON the rail (straddling the table edge).
 */
const avatarStyles = computed(() => {
  const layout = lastLayoutResult.value
  if (!layout) return seatData.value.map(() => ({}))
  const { tableBounds } = layout

  return seatData.value.map((seat) => {
    // User avatar handled separately (fixed at bottom center)
    if (seat.isUser) return {}

    // Position ON the rail edge in board-space pixels
    switch (seat.side) {
      case 'left':
        return { left: `${tableBounds.left}px`, top: `${seat.handPosition.y}px` }
      case 'right':
        return { left: `${tableBounds.right}px`, top: `${seat.handPosition.y}px` }
      case 'top':
        return { left: `${seat.handPosition.x}px`, top: `${tableBounds.top}px` }
      default: // bottom (shouldn't happen - user is at bottom)
        return { left: `${seat.handPosition.x}px`, top: `${tableBounds.bottom}px` }
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
  // No background on main element - felt goes in ::after
  background: none;
  border: none;
  
  // Wood rail - sits behind the felt
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 40px;
    // Wood grain - subtle top-to-bottom shading for depth
    background: linear-gradient(
      180deg,
      #6b5035 0%,
      #5c4430 30%,
      #4f3a2a 70%,
      #4a3525 100%
    );
    // Glossy highlight on top, shadow on bottom
    box-shadow:
      inset 0 2px 4px rgba(255, 255, 255, 0.25),
      inset 0 -3px 6px rgba(0, 0, 0, 0.5),
      0 4px 20px rgba(0, 0, 0, 0.5);
  }
  
  // Green felt - inset from rail
  &::after {
    content: '';
    position: absolute;
    inset: 12px;
    border-radius: 28px;
    background: radial-gradient(ellipse at center, var(--felt) 0%, var(--felt-dark) 70%);
    // Inner shadow - felt recessed below rail
    box-shadow:
      inset 0 4px 12px rgba(0, 0, 0, 0.5),
      inset 0 0 40px rgba(0, 0, 0, 0.3),
      inset 0 -2px 8px rgba(0, 0, 0, 0.2);
  }

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
      opacity: 0.18;
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
    
    &::before {
      border-radius: 30px;
    }
    
    &::after {
      border-radius: 18px;
    }
  }
  
  // Ensure children (watermark, avatars) appear above the felt
  > * {
    position: relative;
    z-index: 1;
  }
}

// Dealer chip - positioned on table near each seat
.dealer-chip {
  position: absolute;
  z-index: 10;
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
  transition: left var(--anim-slower, 0.5s) ease, top var(--anim-slower, 0.5s) ease;

  // Position on table near each player (inset from edges)
  &.dealer-seat-0 { left: 50%; top: calc(100% - 40px); }      // bottom (user)
  &.dealer-seat-1 { left: 60px; top: 50%; }                    // left
  &.dealer-seat-2 { left: 50%; top: 40px; }                    // top
  &.dealer-seat-3 { left: calc(100% - 60px); top: 50%; }       // right
}
</style>
