/**
 * useBoardViewport — single source of truth for the card engine's coordinate space.
 *
 * Model "B" (responsive canonical):
 *  - The canonical design space has a FIXED HEIGHT (CANONICAL_HEIGHT). Its width
 *    follows the viewport's aspect ratio, so the canonical always matches the
 *    real screen shape — the board fills the viewport edge-to-edge with no
 *    letterbox and no centering offset.
 *  - A single scale (`viewportHeight / CANONICAL_HEIGHT`) maps canonical → CSS px.
 *  - Because the canonical height is constant, every size in canonical units
 *    (card width, fan spacing, seat insets) is a CONSTANT. There are NO device
 *    tiers — the one scale handles every device, so the same physical screen
 *    renders identically whether in the PWA or the native app.
 *
 * The felt/visual surface uses the FULL canonical (full-bleed, under notches).
 * `safeRect` expresses the device safe-area insets in canonical units so the
 * layout can keep interactive content (hand, avatars, buttons) clear of cutouts.
 *
 * This module is a module-level singleton (shared reactive state) so the
 * renderer (ScaledContainer), the layout (useTableLayout) and the card sizing
 * all read the exact same numbers.
 */
import { ref, computed, readonly } from 'vue'

// ── Canonical design constants (tune in the cross-device pass) ───────────────

/** Fixed canonical height. All canonical-space sizes are relative to this. */
export const CANONICAL_HEIGHT = 720

/** Base playing-card width in canonical units (~0.16 × height). */
export const BASE_CARD_WIDTH = 116
/** Standard playing-card aspect ratio (height / width). */
export const CARD_ASPECT_RATIO = 1.4
export const BASE_CARD_HEIGHT = Math.round(BASE_CARD_WIDTH * CARD_ASPECT_RATIO)

/** Frozen platform constants — see docs/PLATFORM_CONTRACT.md before changing. */
export const PLATFORM_CONSTANTS = {
  CANONICAL_HEIGHT,
  BASE_CARD_WIDTH,
  BASE_CARD_HEIGHT,
  CARD_ASPECT_RATIO,
  /** Fanned user-hand Y as a fraction of board height (canonical units). */
  USER_HAND_Y_FRACTION: 0.84,
  /** User avatar anchor Y offset from board bottom (canonical units). */
  USER_AVATAR_BOTTOM_OFFSET: 50,
} as const

/**
 * Clamp the canonical aspect ratio only for truly pathological viewports
 * (ultra-wide monitors). The lower bound must stay below a portrait PHONE
 * (~0.46) so portrait screens — e.g. the main menu — render full-height rather
 * than getting squeezed into a small landscape box at the top. Within the range
 * the board fills the screen exactly; outside it, it letterboxes gracefully.
 */
const MIN_ASPECT = 0.4 // taller than a portrait phone → pillarbox (rare)
const MAX_ASPECT = 2.6 // wider than this → letterbox (ultra-wide)

// ── Reactive viewport inputs (set by ScaledContainer) ────────────────────────

const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 720)

/** Device safe-area insets in viewport CSS px (notch, home indicator, etc.). */
const safeInsetsPx = ref({ top: 0, right: 0, bottom: 0, left: 0 })

// ── Derived canonical geometry ───────────────────────────────────────────────

/** Raw viewport aspect ratio (width / height), guarded against zero. */
const rawAspect = computed(() => {
  const h = viewportHeight.value || 1
  return (viewportWidth.value || 1) / h
})

/** Aspect ratio used for the canonical, clamped to a sane range. */
const aspect = computed(() => Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, rawAspect.value)))

const canonicalHeight = computed(() => CANONICAL_HEIGHT)
const canonicalWidth = computed(() => Math.round(CANONICAL_HEIGHT * aspect.value))

/**
 * Canonical → CSS px scale. Height-driven so the board always fills height.
 * When the aspect is clamped (ultra-wide / near-square), fall back to a fit
 * scale so the canonical never overflows the viewport.
 */
const scale = computed(() => {
  const byHeight = viewportHeight.value / CANONICAL_HEIGHT
  if (rawAspect.value > MAX_ASPECT || rawAspect.value < MIN_ASPECT) {
    const byWidth = viewportWidth.value / canonicalWidth.value
    return Math.min(byHeight, byWidth)
  }
  return byHeight
})

/** Safe-area insets expressed in canonical units. */
const safeRect = computed(() => {
  const s = scale.value || 1
  return {
    left: safeInsetsPx.value.left / s,
    top: safeInsetsPx.value.top / s,
    right: canonicalWidth.value - safeInsetsPx.value.right / s,
    bottom: canonicalHeight.value - safeInsetsPx.value.bottom / s,
  }
})

const baseCardWidth = computed(() => BASE_CARD_WIDTH)
const baseCardHeight = computed(() => BASE_CARD_HEIGHT)

// ── Mutators (called by ScaledContainer's resize/orientation handlers) ────────

export function setViewportSize(width: number, height: number): void {
  if (width > 0) viewportWidth.value = width
  if (height > 0) viewportHeight.value = height
}

export function setSafeInsets(insets: { top: number; right: number; bottom: number; left: number }): void {
  safeInsetsPx.value = { ...insets }
}

// ── Public accessor ──────────────────────────────────────────────────────────

export function useBoardViewport() {
  return {
    viewportWidth: readonly(viewportWidth),
    viewportHeight: readonly(viewportHeight),
    aspect,
    canonicalWidth,
    canonicalHeight,
    scale,
    safeRect,
    baseCardWidth,
    baseCardHeight,
  }
}
