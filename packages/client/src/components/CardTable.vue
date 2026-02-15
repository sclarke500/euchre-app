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

      <!-- User avatar at bottom center of screen -->
      <div class="user-avatar-bottom" :class="{ 'is-current-turn': currentTurnSeat === 0 }">
        <div class="avatar-circle">{{ playerNames[0]?.[0] ?? '?' }}</div>
        <div class="player-name">{{ playerNames[0] }}</div>
        <slot name="user-info" />
      </div>

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
    // Hide user avatar at table - shown separately at bottom of screen
    if (seat.isUser) return { display: 'none' }

    // Convert board-space hand position to table-relative percentage
    const pctX = ((seat.handPosition.x - tableBounds.left) / tableBounds.width * 100)
    const pctY = ((seat.handPosition.y - tableBounds.top) / tableBounds.height * 100)

    switch (seat.side) {
      case 'left':
        return { left: '-50px', top: `${pctY}%` }
      case 'right':
        return { left: 'calc(100% + 50px)', top: `${pctY}%` }
      case 'top':
        return { left: `${pctX}%`, top: '-40px' }
      default: // bottom
        return { left: `${pctX}%`, top: 'calc(100% + 40px)' }
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
  gap: 0;
  // Use CSS custom property for border color (for turn glow)
  --avatar-border: #4a4a60;

  // Unified shape: pill/badge that encompasses circle + name
  // Built with ::before (main body) and ::after (circle cutout top)
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 40px;
    background: rgba(30, 30, 45, 0.92);
    border: 2px solid var(--avatar-border);
    border-radius: 50%;
    z-index: 0;
    transition: border-color var(--anim-slow) ease;
  }

  &::after {
    content: '';
    position: absolute;
    top: 22px;
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% + 4px);
    height: calc(100% - 22px);
    background: rgba(30, 30, 45, 0.92);
    border: 2px solid var(--avatar-border);
    border-top: none;
    border-radius: 0 0 8px 8px;
    z-index: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    transition: border-color var(--anim-slow) ease;
  }

  // Circle content (no border - just the letter)
  .avatar-circle {
    position: relative;
    z-index: 2;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: transparent;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: bold;
    color: #ccc;
  }

  // Name text
  .player-name {
    position: relative;
    z-index: 1;
    padding: 2px 10px 6px;
    font-size: 11px;
    font-weight: 600;
    color: #ccc;
    white-space: nowrap;
  }

  .player-status {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 4px;
    padding: 1px 8px;
    font-size: 10px;
    font-weight: 600;
    color: #ffd700;
    white-space: nowrap;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 4px;
    opacity: 0;
    transition: opacity var(--anim-slow) ease;
    pointer-events: none;

    &.visible {
      opacity: 1;
    }
  }

  // Info tags (trump chip, etc) overlap the avatar
  .info-tags {
    position: absolute;
    top: -4px;
    right: -8px;
    z-index: 10;
    display: flex;
    gap: 2px;
  }

  // Turn indicator glow
  &.is-current-turn {
    --avatar-border: rgba(255, 215, 0, 0.7);
    
    &::after {
      box-shadow:
        0 0 12px rgba(255, 215, 0, 0.3),
        0 0 30px rgba(255, 215, 0, 0.15);
    }
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

// User avatar at bottom center of screen
.user-avatar-bottom {
  position: fixed;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 400;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  --avatar-border: #4a4a60;

  // Circle part of badge
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 40px;
    background: rgba(30, 30, 45, 0.92);
    border: 2px solid var(--avatar-border);
    border-radius: 50%;
    z-index: 0;
    transition: border-color var(--anim-slow) ease;
  }

  // Rectangle part of badge (connects to circle)
  &::after {
    content: '';
    position: absolute;
    top: 22px;
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% + 4px);
    height: calc(100% - 22px);
    background: rgba(30, 30, 45, 0.92);
    border: 2px solid var(--avatar-border);
    border-top: none;
    border-radius: 0 0 8px 8px;
    z-index: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    transition: border-color var(--anim-slow) ease;
  }

  .avatar-circle {
    position: relative;
    z-index: 2;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: transparent;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: bold;
    color: #ccc;
  }

  .player-name {
    position: relative;
    z-index: 1;
    padding: 2px 10px 6px;
    font-size: 11px;
    font-weight: 600;
    color: #ccc;
    white-space: nowrap;
  }

  &.is-current-turn {
    --avatar-border: rgba(255, 215, 0, 0.7);
    
    &::after {
      box-shadow:
        0 0 12px rgba(255, 215, 0, 0.3),
        0 0 30px rgba(255, 215, 0, 0.15);
    }
  }
}
</style>
