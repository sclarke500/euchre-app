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

      <!-- Dealer chip - animates between player positions -->
      <div 
        v-if="dealerSeat >= 0" 
        class="dealer-chip-table"
        :style="dealerChipStyle"
      >D</div>

      <!-- Trump indicator - top-right of trump caller's avatar -->
      <div 
        v-if="trumpCallerSeat >= 0 && trumpSymbol" 
        class="trump-chip-table"
        :style="trumpChipStyle"
      >{{ trumpSymbol }}</div>

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
  trumpCallerSeat?: number
  trumpSymbol?: string
  trumpColor?: string
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
  trumpCallerSeat: -1,
  trumpSymbol: '',
  trumpColor: '',
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

/**
 * Dealer chip position - top-left of each player's avatar, in board coordinates.
 * Uses absolute left/top so the chip visibly animates across the table when dealer changes.
 */
const dealerChipStyle = computed(() => {
  const layout = lastLayoutResult.value
  const board = boardRef.value
  if (!layout || !board || props.dealerSeat < 0) return { display: 'none' }
  
  const seat = seatData.value[props.dealerSeat]
  if (!seat) return { display: 'none' }
  
  const { tableBounds } = layout
  const chipOffset = { x: -38, y: -38 } // Chip center at avatar's top-left corner
  
  // Get avatar center point in board coordinates
  let avatarX: number
  let avatarY: number
  
  if (seat.isUser) {
    // User avatar is at bottom center of board
    avatarX = tableBounds.centerX
    avatarY = board.offsetHeight - 35 // ~35px from bottom (avatar bottom: 10px + half height)
  } else {
    // Opponent avatars positioned on rail
    switch (seat.side) {
      case 'left':
        avatarX = tableBounds.left
        avatarY = seat.handPosition.y
        break
      case 'right':
        avatarX = tableBounds.right
        avatarY = seat.handPosition.y
        break
      case 'top':
        avatarX = seat.handPosition.x
        avatarY = tableBounds.top
        break
      default:
        avatarX = tableBounds.centerX
        avatarY = tableBounds.bottom
    }
  }
  
  return {
    left: `${avatarX + chipOffset.x}px`,
    top: `${avatarY + chipOffset.y}px`,
  }
})

/**
 * Trump chip position - top-right of trump caller's avatar, in board coordinates.
 */
const trumpChipStyle = computed(() => {
  const layout = lastLayoutResult.value
  const board = boardRef.value
  if (!layout || !board || props.trumpCallerSeat < 0) return { display: 'none' }
  
  const seat = seatData.value[props.trumpCallerSeat]
  if (!seat) return { display: 'none' }
  
  const { tableBounds } = layout
  const chipOffset = { x: 38, y: -38 } // Chip center at avatar's top-right corner
  
  // Get avatar center point in board coordinates
  let avatarX: number
  let avatarY: number
  
  if (seat.isUser) {
    avatarX = tableBounds.centerX
    avatarY = board.offsetHeight - 35
  } else {
    switch (seat.side) {
      case 'left':
        avatarX = tableBounds.left
        avatarY = seat.handPosition.y
        break
      case 'right':
        avatarX = tableBounds.right
        avatarY = seat.handPosition.y
        break
      case 'top':
        avatarX = seat.handPosition.x
        avatarY = tableBounds.top
        break
      default:
        avatarX = tableBounds.centerX
        avatarY = tableBounds.bottom
    }
  }
  
  return {
    left: `${avatarX + chipOffset.x}px`,
    top: `${avatarY + chipOffset.y}px`,
    color: props.trumpColor || '#fff',
  }
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
  el.style.setProperty('--table-top', `${(tableBounds.top / h * 100).toFixed(2)}%`)
  el.style.setProperty('--table-bottom', `${((h - tableBounds.bottom) / h * 100).toFixed(2)}%`)

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
  --felt: #1e6045;           // Deep casino green
  --felt-light: #247552;     // Center highlight  
  --felt-dark: #15483a;      // Edge shadow
  --surface-bg: #151518;

  // Floor effect - lounge with bokeh lights (dialed back)
  background:
    // Bokeh light 1 - top left warm
    radial-gradient(circle at 8% 15%, rgba(255, 175, 90, 0.2) 0%, rgba(255, 180, 100, 0.06) 5%, transparent 10%),
    // Bokeh light 2 - top right cool
    radial-gradient(circle at 92% 12%, rgba(140, 175, 255, 0.17) 0%, rgba(150, 180, 255, 0.05) 4%, transparent 9%),
    // Bokeh light 3 - bottom left
    radial-gradient(circle at 5% 85%, rgba(255, 195, 135, 0.16) 0%, rgba(255, 200, 150, 0.05) 4%, transparent 8%),
    // Bokeh light 4 - bottom right
    radial-gradient(circle at 95% 88%, rgba(175, 155, 225, 0.15) 0%, rgba(180, 160, 220, 0.05) 4%, transparent 9%),
    // Extra accent - mid left
    radial-gradient(circle at 3% 50%, rgba(255, 200, 130, 0.12) 0%, transparent 6%),
    // Extra accent - mid right  
    radial-gradient(circle at 97% 55%, rgba(160, 180, 255, 0.1) 0%, transparent 5%),
    // Table spotlight
    radial-gradient(ellipse 65% 55% at center 42%, rgba(255, 240, 200, 0.08) 0%, transparent 60%),
    // Table shadow
    radial-gradient(ellipse 55% 45% at center 44%, rgba(0, 0, 0, 0.5) 0%, transparent 80%),
    // Vignette
    radial-gradient(ellipse 100% 100% at center, transparent 35%, rgba(0, 0, 0, 0.6) 100%),
    // Base - dark with slight blue tint
    linear-gradient(180deg, #1a1a24 0%, #141420 50%, #0f0f18 100%);

}

.table-surface {
  position: absolute;
  top: var(--table-top, 15%);
  bottom: var(--table-bottom, 20%);
  left: var(--table-left, 20%);
  right: var(--table-right, 20%);
  border-radius: 40px;
  // No background on main element - felt goes in ::after
  background: none;
  border: none;
  
  // 3D perspective - "looking down at table" effect
  transform: perspective(800px) rotateX(20deg);
  transform-origin: center 80%; // Pivot point near bottom
  
  // Wood rail - sits behind the felt
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 40px;
    // Rich mahogany wood - deeper reds/browns
    background: 
      // Subtle horizontal grain lines
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        rgba(0,0,0,0.03) 1px,
        transparent 2px,
        transparent 8px
      ),
      // Main wood color with depth
      linear-gradient(
        180deg,
        #5c4035 0%,
        #4a332a 15%,
        #3d2a22 50%,
        #4a332a 85%,
        #5c4035 100%
      );
    // Polished wood - strong highlight, deep shadow
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      inset 0 3px 8px rgba(255, 200, 150, 0.1),
      inset 0 -4px 8px rgba(0, 0, 0, 0.5),
      0 6px 24px rgba(0, 0, 0, 0.6);
  }
  
  // Green felt - inset from rail
  &::after {
    content: '';
    position: absolute;
    inset: 12px;
    border-radius: 28px;
    // Subtle center brightening, dark edges under rail shadow
    background: radial-gradient(
      ellipse 80% 70% at center 45%,
      var(--felt-light) 0%,
      var(--felt) 50%,
      var(--felt-dark) 100%
    );
    // Felt recessed under rail - deeper shadows
    box-shadow:
      inset 0 4px 16px rgba(0, 0, 0, 0.5),
      inset 0 0 40px rgba(0, 0, 0, 0.25),
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

// Dealer chip - poker chip style with striped border
.dealer-chip-table {
  position: absolute;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  // Striped border using conic-gradient - blue stripes, thicker
  background: 
    radial-gradient(circle at center, #fff 0%, #fff 55%, transparent 55%),
    conic-gradient(
      from 0deg,
      #2563eb 0deg 30deg,
      #fff 30deg 60deg,
      #2563eb 60deg 90deg,
      #fff 90deg 120deg,
      #2563eb 120deg 150deg,
      #fff 150deg 180deg,
      #2563eb 180deg 210deg,
      #fff 210deg 240deg,
      #2563eb 240deg 270deg,
      #fff 270deg 300deg,
      #2563eb 300deg 330deg,
      #fff 330deg 360deg
    );
  color: #1e40af;
  font-size: 14px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 
    0 2px 6px rgba(0, 0, 0, 0.5),
    inset 0 1px 2px rgba(255, 255, 255, 0.8),
    inset 0 -1px 2px rgba(0, 0, 0, 0.2);
  z-index: 400;
  pointer-events: none;
  // Animate position changes
  transition: left 0.5s cubic-bezier(0.4, 0, 0.2, 1),
              top 0.5s cubic-bezier(0.4, 0, 0.2, 1),
              bottom 0.5s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

// Trump indicator chip - shows suit symbol at trump caller's avatar
.trump-chip-table {
  position: absolute;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(30, 35, 45, 0.95);
  border: 2px solid rgba(255, 255, 255, 0.3);
  font-size: 16px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 
    0 2px 6px rgba(0, 0, 0, 0.5),
    inset 0 1px 2px rgba(255, 255, 255, 0.1);
  z-index: 400;
  pointer-events: none;
  // No transition - just appears/disappears at caller's position
}

</style>
