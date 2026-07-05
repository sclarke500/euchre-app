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

      <!-- Rail overlay: redraws just the wood rail ABOVE the table cards, so
           won-trick piles and opponent card-backs tuck under it. -->
      <div class="table-rail-overlay" :class="layout" aria-hidden="true"></div>

      <!-- Felt shadow overlay: re-casts the rail's recessed inner shadow ABOVE
           the cards, so cards tucked against the rail sit *under* the shadow. -->
      <div class="table-felt-shadow" :class="layout" aria-hidden="true"></div>
      
      <!-- Opponent avatars - outside table-surface for proper z-index stacking -->
      <template v-for="(seat, i) in seatData" :key="'avatar-' + i">
        <PlayerAvatar
          v-if="!seat.isUser"
          :name="playerNames[i] ?? 'Player'"
          :avatar-url="playerAvatars[i]"
          :is-current-turn="currentTurnSeat === i"
          :status="playerStatuses[i]"
          :position="getRailPosition(seat.side)"
          :custom-style="{ ...avatarStyles[i], opacity: props.avatarOpacities[i] ?? 1 }"
          :trump-suit="trumpCallerSeat === i ? trumpSuit : ''"
          :trump-color="trumpCallerSeat === i ? trumpColor : ''"
          :bid-badge="bidBadges[i] ?? null"
          :seat-index="i"
          :chat-message="chatStore.activeBubbles.get(i)"
          :chat-persistent="chatStore.debugBubbles"
          @chat-dismiss="chatStore.hideBubble(i)"
        >
          <slot :name="`player-info-${i}`" />
        </PlayerAvatar>
      </template>

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
        :trump-suit="trumpCallerSeat === 0 ? trumpSuit : ''"
        :trump-color="trumpCallerSeat === 0 ? trumpColor : ''"
        :bid-badge="bidBadges[0] ?? null"
        :seat-index="0"
      >
        <slot name="user-info" />
      </PlayerAvatar>

      <!-- Dealer chip — single element animates between seats (NW quadrant of each avatar) -->
      <div
        v-if="dealerSeat >= 0 && dealerChipVisible"
        class="dealer-chip-animated avatar-chip avatar-chip--dealer"
        :style="dealerChipStyle"
        aria-label="Dealer"
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
import { ref, computed, onMounted, onUnmounted, provide, watch, nextTick } from 'vue'
import BoardCard from './BoardCard.vue'
import PlayerAvatar, { type AvatarPosition } from './PlayerAvatar.vue'
import { useChatStore } from '@/stores/chatStore'
import { useCardTable, type CardTableEngine } from '@/composables/useCardTable'
import { computeTableLayout, setUserHandLift, type SeatLayout, type TableLayoutResult } from '@/composables/useTableLayout'
import { useCardSizing } from '@/composables/useCardSizing'
import { useBoardViewport } from '@/composables/useBoardViewport'
import { measureDealerChipBoardPosition } from '@/utils/avatarChipLayout'

const props = withDefaults(defineProps<{
  playerCount: number
  playerNames: string[]
  playerAvatars?: (string | undefined)[] // Avatar URLs for each player
  layout?: 'normal' | 'wide'
  engine?: CardTableEngine
  dealerSeat?: number
  trumpCallerSeat?: number
  /** Trump suit name (e.g. "hearts") — rendered as an SVG pip on the caller's avatar */
  trumpSuit?: string
  trumpColor?: string
  playerStatuses?: string[]
  /** Per-seat corner badge (e.g. Spades bid), shown at the avatar's NE corner */
  bidBadges?: (string | number | null)[]
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
  trumpSuit: '',
  trumpColor: '',
  playerStatuses: () => [],
  bidBadges: () => [],
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

// Canonical safe-area, so the user hand can be lifted clear of the bottom
// gesture nav (native) plus a slight raise. Shared across all games.
const { safeRect, canonicalHeight } = useBoardViewport()

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
        // Nudge the top avatar down by a quarter of the top safe-area (status bar)
        // so it clears without dropping too far onto the table.
        return { left: `${seat.handPosition.x}px`, top: `calc(${tableBounds.top}px + (var(--safe-top, 0px) * 0.25))` }
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

const dealerChipPos = ref<{ left: number; top: number } | null>(null)
const dealerChipVisible = ref(false)

// Arg-less so it can double as the resize listener (no Event leaking in).
function updateDealerChipPosition() {
  tryPlaceDealerChip(5)
}

function tryPlaceDealerChip(retries: number) {
  if (props.dealerSeat < 0) {
    dealerChipVisible.value = false
    dealerChipPos.value = null
    return
  }

  const pos = measureDealerChipBoardPosition(boardRef.value, props.dealerSeat)
  if (pos) {
    dealerChipPos.value = pos
    dealerChipVisible.value = true
  } else if (retries > 0) {
    // Avatar frame not laid out yet (mid round-transition) — retry next frame
    // so we don't strand the chip at a garbage (top-left) position.
    requestAnimationFrame(() => tryPlaceDealerChip(retries - 1))
  }
}

const dealerChipStyle = computed(() => {
  if (!dealerChipPos.value) return { visibility: 'hidden' as const }
  return {
    left: `${dealerChipPos.value.left}px`,
    top: `${dealerChipPos.value.top}px`,
  }
})

function computeLayout() {
  if (!boardRef.value) return
  // Use offsetWidth/Height (layout dimensions) instead of getBoundingClientRect()
  // because CSS transforms (e.g. scale(0.85) on small screens) cause getBCR to
  // return visual dimensions, while absolute px positioning uses layout coordinates.
  const w = boardRef.value.offsetWidth
  const h = boardRef.value.offsetHeight
  // Bail while the board has no real size (a transient 0 fires during mount /
  // orientation change). Laying out now collapses every seat to x≈0, and emitting
  // it makes the director reposition all dealt cards to the left edge. A later
  // ResizeObserver fire at a real size re-runs this.
  if (w === 0 || h === 0) return
  // Lift the user hand by the bottom safe-area inset (gesture nav) + a slight raise.
  // Set here (CardTable owns the viewport) so cardController's deal/relayout use the
  // same value — keeps the hand cards aligned with the lifted bottom avatar.
  // Half-strength: a gentle raise (the full lift sat too high).
  const safeBottom = Math.max(0, canonicalHeight.value - safeRect.value.bottom)
  setUserHandLift((safeBottom + h * 0.02) * 0.5)
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

  nextTick(() => updateDealerChipPosition())

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
  window.addEventListener('resize', updateDealerChipPosition)
  nextTick(() => updateDealerChipPosition())
})

watch(() => [props.playerCount, props.layout], () => {
  computeLayout()
})

watch(() => props.dealerSeat, () => {
  nextTick(() => updateDealerChipPosition())
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('resize', updateDealerChipPosition)
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
@use '@/assets/styles/avatar-chips' as *;

.dealer-chip-animated {
  position: absolute;
  z-index: 550;
  transition:
    left 0.5s cubic-bezier(0.4, 0, 0.2, 1),
    top 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

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
      width: 190px;
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
// Rail overlay — redraws just the outer wood ring (center masked out so cards
// show through) above the table cards, so won-trick piles / opponent backs tuck
// under the rail. Positioned identically to .table-surface.
.table-rail-overlay {
  position: absolute;
  top: var(--table-top, 15%);
  bottom: var(--table-bottom, 20%);
  left: var(--table-left, 20%);
  right: var(--table-right, 20%);
  border-radius: 40px;
  z-index: 250; // above won-trick (50) + opponent backs (200), below avatars (350)
  pointer-events: none;
  padding: 12px; // ring thickness == felt inset on .table-surface::after
  background:
    repeating-linear-gradient(90deg, transparent 0px, rgba(0, 0, 0, 0.03) 1px, transparent 2px, transparent 8px),
    linear-gradient(180deg, #5c4035 0%, #4a332a 15%, #3d2a22 50%, #4a332a 85%, #5c4035 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    inset 0 -4px 8px rgba(0, 0, 0, 0.5);
  // Show ONLY the padding ring: full mask minus the content-box center.
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;

  &.normal {
    border-radius: 30px;
  }
}

// Felt shadow overlay — mirrors the felt inner area (12px inside the rail) and
// re-casts the recessed under-rail shadow ABOVE the cards. Without this the
// shadow lives on .table-surface::after (below the cards), so won-trick piles
// tucked against the rail would cover it. z-index sits above the cards
// (won-trick 50, opponent backs 200) but below the rail ring (250) and avatars.
.table-felt-shadow {
  position: absolute;
  top: calc(var(--table-top, 15%) + 12px);
  bottom: calc(var(--table-bottom, 20%) + 12px);
  left: calc(var(--table-left, 20%) + 12px);
  right: calc(var(--table-right, 20%) + 12px);
  border-radius: 28px;
  z-index: 240;
  pointer-events: none;
  background: none;
  box-shadow:
    inset 0 4px 16px rgba(0, 0, 0, 0.5),
    inset 0 -2px 8px rgba(0, 0, 0, 0.2);

  &.normal {
    border-radius: 18px;
  }
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


