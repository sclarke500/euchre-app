<template>
  <div class="card-table-root">
    <div ref="boardRef" class="board">
      <!-- Table surface -->
      <div ref="tableRef" class="table-surface" :class="layout">
        <!-- Watermark -->
        <div class="table-watermark">
          <img src="@/assets/logo-jester-67-dark.png" alt="" class="watermark-img" />
        </div>
      </div>
      
      <!-- Opponent avatars - outside table-surface for proper z-index stacking -->
      <PlayerAvatar
        v-for="(seat, i) in seatData"
        :key="'avatar-' + i"
        v-show="!seat.isUser"
        :name="playerNames[i] ?? 'Player'"
        :avatar-url="playerAvatars[i]"
        :is-current-turn="currentTurnSeat === i"
        :status="playerStatuses[i]"
        :position="getRailPosition(seat.side)"
        :custom-style="{ ...avatarStyles[i], opacity: props.avatarOpacities[i] ?? 1 }"
        :trump-symbol="trumpCallerSeat === i ? trumpSymbol : ''"
        :trump-color="trumpCallerSeat === i ? trumpColor : ''"
        :chat-message="chatStore.activeBubbles.get(i)"
        :chat-persistent="chatStore.debugBubbles"
        @chat-dismiss="chatStore.hideBubble(i)"
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

      <!-- User avatar at bottom center of screen (no chat bubble - user sees their own messages in panel) -->
      <PlayerAvatar
        :name="playerNames[0] ?? 'You'"
        :is-current-turn="currentTurnSeat === 0"
        :is-user="true"
        position="bottom"
        :trump-symbol="trumpCallerSeat === 0 ? trumpSymbol : ''"
        :trump-color="trumpCallerSeat === 0 ? trumpColor : ''"
      >
        <slot name="user-info" />
      </PlayerAvatar>

      <!-- Dealer chip - animates between player positions -->
      <div 
        v-if="dealerSeat >= 0" 
        class="dealer-chip-table"
        :style="dealerChipStyle"
      >D</div>

      <!-- Overlay slot for game-specific UI (modals, score, etc.) -->
      <slot />
      
      <!-- Debug position dots -->
      <template v-if="debugPositions && lastLayoutResult">
        <!-- Avatar positions (red dots) -->
        <div
          v-for="(seat, i) in seatData"
          :key="'debug-avatar-' + i"
          class="debug-dot debug-dot--avatar"
          :style="getDebugAvatarStyle(seat, i)"
          :title="'Avatar ' + i + ': ' + JSON.stringify(getDebugAvatarPos(seat, i))"
        />
        <!-- Hand positions (blue dots) -->
        <div
          v-for="(seat, i) in seatData"
          :key="'debug-hand-' + i"
          class="debug-dot debug-dot--hand"
          :style="{ left: seat.handPosition.x + 'px', top: seat.handPosition.y + 'px' }"
          :title="'Hand ' + i + ': ' + JSON.stringify(seat.handPosition)"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, provide, watch } from 'vue'
import BoardCard from './BoardCard.vue'
import PlayerAvatar, { type AvatarPosition } from './PlayerAvatar.vue'
import { useChatStore } from '@/stores/chatStore'
import { useCardTable, type CardTableEngine } from '@/composables/useCardTable'
import { computeTableLayout, type SeatLayout, type TableLayoutResult } from '@/composables/useTableLayout'
import { useCardSizing } from '@/composables/useCardSizing'

const props = withDefaults(defineProps<{
  playerCount: number
  playerNames: string[]
  playerAvatars?: (string | undefined)[] // Avatar URLs for each player
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
  debugPositions?: boolean
}>(), {
  layout: 'normal',
  dealerSeat: -1,
  trumpCallerSeat: -1,
  trumpSymbol: '',
  trumpColor: '',
  playerStatuses: () => [],
  currentTurnSeat: -1,
  avatarOpacities: () => [],
  playerAvatars: () => [],
  gameName: '',
  debugPositions: false,
})

const emit = defineEmits<{
  'card-click': [cardId: string]
  'layout-changed': [layout: TableLayoutResult]
}>()

const boardRef = ref<HTMLElement | null>(null)
const tableRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

// Use provided engine or create our own
const engine = props.engine ?? useCardTable()
const seatData = ref<SeatLayout[]>([])
const lastLayoutResult = ref<TableLayoutResult | null>(null)

// Dynamic card sizing based on viewport
const { baseWidth, baseHeight } = useCardSizing()

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

// Chat store for bubble state
const chatStore = useChatStore()

// Debug helpers for position visualization
function getDebugAvatarPos(seat: SeatLayout, index: number) {
  const layout = lastLayoutResult.value
  if (!layout) return { x: 0, y: 0 }
  const { tableBounds } = layout
  switch (seat.side) {
    case 'left': return { x: tableBounds.left, y: seat.handPosition.y }
    case 'right': return { x: tableBounds.right, y: seat.handPosition.y }
    case 'top': return { x: seat.handPosition.x, y: tableBounds.top }
    default: return { x: seat.handPosition.x, y: tableBounds.bottom }
  }
}

function getDebugAvatarStyle(seat: SeatLayout, index: number) {
  const pos = getDebugAvatarPos(seat, index)
  return { left: pos.x + 'px', top: pos.y + 'px' }
}

/**
 * Dealer chip position - top-left of each player's avatar.
 * Uses absolute positioning with transition for smooth animation between dealers.
 * User position uses 'bottom' since avatar is fixed to screen bottom.
 */
const dealerChipStyle = computed(() => {
  const layout = lastLayoutResult.value
  const board = boardRef.value
  if (!layout || !board || props.dealerSeat < 0) return { display: 'none' }
  
  const seat = seatData.value[props.dealerSeat]
  if (!seat) return { display: 'none' }
  
  const { tableBounds } = layout
  const chipOffset = { x: -38, y: -38 } // Top-left of avatar
  
  if (seat.isUser) {
    // User avatar is fixed at bottom of screen
    // Convert to top positioning so CSS transition works (can't animate between top/bottom)
    const boardHeight = board.offsetHeight
    const chipTop = boardHeight - 50 - 28 // 50px from bottom, minus chip height
    return {
      left: `${tableBounds.centerX - 73}px`, // Left edge of avatar circle + 15px right offset
      top: `${chipTop}px`,
      bottom: 'auto',
    }
  }
  
  // Opponent avatars - use top positioning
  let avatarX: number
  let avatarY: number
  
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
  
  return {
    left: `${avatarX + chipOffset.x}px`,
    top: `${avatarY + chipOffset.y}px`,
    bottom: 'auto',
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
  
  // Set card base size CSS vars (used by BoardCard)
  el.style.setProperty('--card-base-width', `${baseWidth.value}px`)
  el.style.setProperty('--card-base-height', `${baseHeight.value}px`)

  // Notify listeners of layout change
  emit('layout-changed', result)

  return result
}

// Keyboard shortcut: Ctrl+Shift+B toggles test bubbles
function handleKeyDown(e: KeyboardEvent) {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'b') {
    e.preventDefault()
    chatStore.toggleTestBubbles(props.playerNames)
  }
}

onMounted(() => {
  computeLayout()
  if (boardRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      computeLayout()
    })
    resizeObserver.observe(boardRef.value)
  }
  window.addEventListener('keydown', handleKeyDown)
})

watch(() => [props.playerCount, props.layout], () => {
  computeLayout()
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  window.removeEventListener('keydown', handleKeyDown)
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
  // Table fills the ScaledContainer - no longer needs max constraints
  // (ScaledContainer handles the fixed 16:9 sizing)
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

  // Transparent background lets aurora and stars show through
  // Just keep subtle vignette and table shadow for depth
  background:
    // Table spotlight - subtle warm glow on felt
    radial-gradient(ellipse 65% 55% at center 42%, rgba(255, 240, 200, 0.06) 0%, transparent 60%),
    // Table shadow - grounds the felt
    radial-gradient(ellipse 55% 45% at center 44%, rgba(0, 0, 0, 0.35) 0%, transparent 80%),
    // Soft vignette
    radial-gradient(ellipse 100% 100% at center, transparent 40%, rgba(0, 0, 0, 0.4) 100%);
  // Note: no solid base color - fully transparent to show space behind

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

  // Watermark - jester logo in center of table
  .table-watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    user-select: none;
    
    .watermark-img {
      width: 120px;
      height: auto;
      opacity: 0.2;
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
  background: 
    radial-gradient(circle at center, #fff 0%, #fff 55%, transparent 55%),
    conic-gradient(
      from 0deg,
      #2563eb 0deg 30deg, #fff 30deg 60deg,
      #2563eb 60deg 90deg, #fff 90deg 120deg,
      #2563eb 120deg 150deg, #fff 150deg 180deg,
      #2563eb 180deg 210deg, #fff 210deg 240deg,
      #2563eb 240deg 270deg, #fff 270deg 300deg,
      #2563eb 300deg 330deg, #fff 330deg 360deg
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
  z-index: 550; // Above user avatar (500)
  pointer-events: none;
  transition: left 0.5s cubic-bezier(0.4, 0, 0.2, 1),
              top 0.5s cubic-bezier(0.4, 0, 0.2, 1),
              bottom 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

// Debug position dots
.debug-dot {
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  z-index: 9999;
  pointer-events: none;
  border: 2px solid #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.5);
  
  &--avatar {
    background: #ff0000; // Red = avatar position
  }
  
  &--hand {
    background: #0088ff; // Blue = hand position
  }
}
</style>
