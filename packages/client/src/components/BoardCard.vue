<template>
  <div
    ref="rootEl"
    class="board-card"
    :class="{ 'arc-fan': useArcFan, 'dimmed': dimmed, 'selected': selected, 'highlighted': highlighted }"
    :style="cardStyle"
  >
    <div class="card-inner" :class="{ 'face-down': !showFaceUp }">
      <template v-if="showFaceUp">
        <div class="corner top-left" :class="colorClass">
          <span class="rank">{{ displayRank }}</span>
          <SuitGlyph v-if="card.rank !== 'Joker'" :suit="card.suit" class="suit" />
        </div>
        <div class="center" :class="colorClass">
          <img v-if="card.rank === 'Joker'" :src="jokerLogo" alt="Joker" class="joker-logo" />
          <SuitGlyph v-else :suit="card.suit" class="suit-large" />
        </div>
        <div class="corner bottom-right" :class="colorClass">
          <span class="rank">{{ displayRank }}</span>
          <SuitGlyph v-if="card.rank !== 'Joker'" :suit="card.suit" class="suit" />
        </div>
      </template>
      <template v-else>
        <div class="card-back-pattern">
          <div class="pattern"></div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import type { CardPosition, EngineCard } from './cardContainers'
import SuitGlyph from './SuitGlyph.vue'
import jokerLogo from '@/assets/joker-67-color.png'

const props = defineProps<{
  card: EngineCard
  faceUp: boolean
  initialPosition?: CardPosition
  dimmed?: boolean
  selected?: boolean
  highlighted?: boolean
}>()

const rootEl = ref<HTMLElement | null>(null)

const position = ref<CardPosition>(props.initialPosition ?? {
  x: 0,
  y: 0,
  rotation: 0,
  zIndex: 1,
  scale: 1,
  flipY: 0,
  tableSkew: false,
})

// The flip state used for face rendering. Kept separate from position.value
// because during a WAAPI move position.value snaps to the target immediately,
// but the visible face must not swap until the card is edge-on (flip midpoint).
const displayFlipY = ref(position.value.flipY ?? 0)

// Position is expressed entirely in transform (translate3d), never left/top.
// Transform changes skip layout and can run on the compositor thread — this is
// what keeps card animations smooth in the Android WebView, which has far less
// main-thread headroom than desktop Chrome.
function transformFor(pos: CardPosition): string {
  const scale = pos.scale ?? 1.0
  const flipY = pos.flipY ?? 0
  // flipY controls scaleX: 0=full, 90=flat, 180=full (flipped content shown via showFaceUp)
  const flipProgress = Math.abs(Math.cos(flipY * Math.PI / 180))
  return `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) rotate(${pos.rotation}deg) scale(${scale * flipProgress}, ${scale})`
}

const cardStyle = computed(() => {
  const scale = position.value.scale ?? 1.0
  return {
    transform: transformFor(position.value),
    zIndex: position.value.zIndex,
    // Hide cards completely when scaled very small (hidden at avatar)
    opacity: scale < 0.1 ? 0 : 1,
  }
})

// When flipY is between 90-270, show the opposite face
// Cards with no suit/rank (e.g. kitty dummies) are always face-down
const showFaceUp = computed(() => {
  if (!props.card.suit && !props.card.rank) return false
  return isFlippedRegion(displayFlipY.value) ? !props.faceUp : props.faceUp
})

function isFlippedRegion(flipY: number): boolean {
  const normalized = ((flipY % 360) + 360) % 360
  return normalized > 90 && normalized < 270
}

const colorClass = computed(() => {
  if (props.card.rank === 'Joker') return 'joker'
  return props.card.suit === 'hearts' || props.card.suit === 'diamonds' ? 'red' : 'black'
})

const displayRank = computed(() => {
  if (props.card.rank === 'Joker') return '★'
  return props.card.rank
})

// Moves run through the Web Animations API so they're driven by the browser's
// animation machinery (composited off the JS main thread where supported)
// instead of a per-frame rAF + Vue-reactivity loop. position.value snaps to
// the target when a move starts — z-index must apply instantly so cards moving
// to the pile render above existing pile cards immediately — and the running
// Animation overrides the rendered transform/opacity until it finishes.
//
// Only one move may be in flight per card: starting a new move (or setPosition)
// cancels the previous Animation and starts from the current visual position.
// Without this, overlapping moves fight each other — the source of cards
// stuttering/teleporting/landing wrong during fast play, resync, or reconnect.
interface Flight {
  start: CardPosition
  target: CardPosition
  startTime: number
  duration: number
  anim: Animation
}
let flight: Flight | null = null
let flipTimer: ReturnType<typeof setTimeout> | null = null

function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3)
}

function interpolate(start: CardPosition, target: CardPosition, eased: number): CardPosition {
  return {
    x: start.x + (target.x - start.x) * eased,
    y: start.y + (target.y - start.y) * eased,
    rotation: start.rotation + (target.rotation - start.rotation) * eased,
    zIndex: target.zIndex,
    scale: (start.scale ?? 1) + ((target.scale ?? 1) - (start.scale ?? 1)) * eased,
    flipY: (start.flipY ?? 0) + ((target.flipY ?? (start.flipY ?? 0)) - (start.flipY ?? 0)) * eased,
    tableSkew: target.tableSkew ?? false, // Snap to target (no interpolation for bool)
  }
}

// Where the card visually is right now — mid-flight this interpolates the
// active animation, since position.value already holds the move's target.
function currentVisualPosition(): CardPosition {
  if (!flight) return { ...position.value }
  const progress = Math.min((performance.now() - flight.startTime) / flight.duration, 1)
  return interpolate(flight.start, flight.target, easeOutCubic(progress))
}

function cancelFlight() {
  if (flipTimer !== null) {
    clearTimeout(flipTimer)
    flipTimer = null
  }
  if (flight) {
    const anim = flight.anim
    flight = null // clear first so the oncancel handler doesn't double-clean
    anim.cancel() // fires oncancel → resolves the superseded move's promise
    if (rootEl.value) rootEl.value.style.willChange = ''
  }
}

// The easing curve is baked into sampled keyframes (linear between samples)
// because scaleX follows |cos(flipY)| during flips — a nonlinear path that
// two-keyframe transform interpolation can't express.
function buildKeyframes(start: CardPosition, target: CardPosition, duration: number): Keyframe[] {
  const intervals = Math.min(Math.max(Math.ceil(duration / 16), 2), 60)
  const frames: Keyframe[] = []
  for (let i = 0; i <= intervals; i++) {
    const pos = interpolate(start, target, easeOutCubic(i / intervals))
    frames.push({
      transform: transformFor(pos),
      opacity: (pos.scale ?? 1) < 0.1 ? 0 : 1,
    })
  }
  return frames
}

// Swap the rendered face at the moment the flip passes edge-on (90°/270°),
// matching when the animated scaleX reaches zero.
function scheduleFaceFlip(startFlip: number, targetFlip: number, duration: number) {
  const startFace = isFlippedRegion(startFlip)
  let crossing: number | null = null
  for (let i = 1; i <= 64; i++) {
    const progress = i / 64
    const flip = startFlip + (targetFlip - startFlip) * easeOutCubic(progress)
    if (isFlippedRegion(flip) !== startFace) {
      crossing = progress
      break
    }
  }
  if (crossing === null) {
    displayFlipY.value = targetFlip
    return
  }
  flipTimer = setTimeout(() => {
    flipTimer = null
    displayFlipY.value = targetFlip
  }, crossing * duration)
}

function moveTo(target: CardPosition, duration: number = 350): Promise<void> {
  const start = currentVisualPosition()
  cancelFlight()

  const resolved: CardPosition = {
    x: target.x,
    y: target.y,
    rotation: target.rotation,
    zIndex: target.zIndex,
    scale: target.scale ?? 1,
    // Omitted flipY preserves the current visual flip state (see dealTo)
    flipY: target.flipY ?? start.flipY ?? 0,
    tableSkew: target.tableSkew ?? false,
  }

  position.value = resolved

  const el = rootEl.value
  if (!el || duration <= 0) {
    displayFlipY.value = resolved.flipY ?? 0
    return Promise.resolve()
  }

  scheduleFaceFlip(start.flipY ?? 0, resolved.flipY ?? 0, duration)

  // will-change only while in flight: promotes the moving card to its own
  // compositor layer (so the felt underneath isn't repainted every frame)
  // without permanently holding a layer per card on the table.
  el.style.willChange = 'transform'
  const anim = el.animate(buildKeyframes(start, resolved, duration), { duration, fill: 'none' })
  flight = { start, target: resolved, startTime: performance.now(), duration, anim }

  return new Promise((resolve) => {
    const done = () => {
      if (flight?.anim === anim) {
        flight = null
        el.style.willChange = ''
      }
      resolve()
    }
    anim.onfinish = done
    anim.oncancel = done
  })
}

function setPosition(pos: CardPosition) {
  cancelFlight()
  position.value = { ...pos }
  displayFlipY.value = pos.flipY ?? 0
}

function getPosition(): CardPosition {
  return currentVisualPosition()
}

const useArcFan = ref(false)
function setArcFan(enabled: boolean) {
  useArcFan.value = enabled
}

// Stop any in-flight animation if the card is removed mid-animation
// (e.g. trick clears or hand empties while a card is still flying).
onUnmounted(() => {
  cancelFlight()
})

defineExpose({
  moveTo,
  setPosition,
  getPosition,
  setArcFan,
})
</script>

<style scoped lang="scss">
.board-card {
  position: absolute;
  // Anchored at the board origin; all positioning happens via transform so
  // moves never trigger layout (see transformFor).
  left: 0;
  top: 0;
  pointer-events: auto;
  cursor: default;

  // Fan arc origin - only applied when card has .arc-fan class
  // Pivot point far below card creates arc spread when rotated
  &.arc-fan {
    transform-origin: center 500%;
  }

  &.dimmed {
    filter: brightness(0.5) saturate(0.4);
    transition: filter 0.7s ease;
  }

  &.selected {
    margin-top: -12px;
    filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.6));
    transition: margin-top var(--anim-fast) ease, filter var(--anim-fast) ease;
  }

  &.highlighted {
    filter: drop-shadow(0 0 8px rgba(0, 200, 150, 0.7)) drop-shadow(0 0 16px rgba(0, 200, 150, 0.3));
    transition: filter var(--anim-medium) ease;
  }

  &:not(.selected):not(.highlighted) {
    transition: margin-top var(--anim-fast) ease, filter 0.7s ease;
  }
}

.card-inner {
  // Dynamic card size from CSS custom properties (set by CardTable via useCardSizing)
  // Fallback to reasonable defaults if vars not set
  width: var(--card-base-width, 83px);
  height: var(--card-base-height, 116px);
  background: #fff;
  border-radius: calc(var(--card-base-width, 83px) * 0.07);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  position: relative;
  user-select: none;

  &.face-down {
    background: #e8e4df;
  }
}

.corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  // Left-align so the suit sits at the card edge under the rank's first digit,
  // not centered under it — otherwise a two-digit "10" shifts its suit right and
  // looks inconsistent with single-digit cards.
  align-items: flex-start;
  font-weight: bold;
  line-height: 1;

  &.top-left {
    top: 4%;
    left: 5%;
  }

  &.bottom-right {
    bottom: 4%;
    right: 5%;
    transform: rotate(180deg);
  }

  // Font size scales with card - slightly larger for readability.
  // Kept below the size where a two-digit "10" rank would reach the center pip.
  .rank {
    font-size: calc(var(--card-base-width, 83px) * 0.26);
  }

  // SVG pip sizes are tuned to match how the old text glyphs rendered in
  // desktop Chrome (glyphs filled ~70% of their em box in Apple's fallback font).
  .suit {
    width: calc(var(--card-base-width, 83px) * 0.18);
    height: calc(var(--card-base-width, 83px) * 0.18);
    margin-top: calc(var(--card-base-width, 83px) * 0.02);
  }

  &.red { color: #e74c3c; }
  &.black { color: #2c3e50; }
  &.joker { color: #9b59b6; }
}

.center {
  // Fill the whole card and flex-center so the glyph is geometrically centered.
  // (Relying on a text baseline — the old translate(-50%,-50%) on an inline span —
  // floated the pip high because suit glyphs aren't centered in their line box.)
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  .suit-large {
    width: calc(var(--card-base-width, 83px) * 0.45);
    height: calc(var(--card-base-width, 83px) * 0.45);
  }

  .joker-logo {
    width: calc(var(--card-base-width, 83px) * 0.85);
    height: auto;
    object-fit: contain;
  }

  &.red { color: #e74c3c; }
  &.black { color: #2c3e50; }
  &.joker { color: #9b59b6; }
}

.card-back-pattern {
  width: 100%;
  height: 100%;
  padding: 3px;
  box-sizing: border-box;

  .pattern {
    width: 100%;
    height: 100%;
    background:
      repeating-linear-gradient(
        45deg,
        rgba(255, 255, 255, 0.15) 0px,
        rgba(255, 255, 255, 0.15) 1px,
        transparent 1px,
        transparent 5px
      ),
      repeating-linear-gradient(
        -45deg,
        rgba(255, 255, 255, 0.15) 0px,
        rgba(255, 255, 255, 0.15) 1px,
        transparent 1px,
        transparent 5px
      ),
      linear-gradient(135deg, #8b3a4a 0%, #6b2838 100%);
    border-radius: 2px;
  }
}
</style>
