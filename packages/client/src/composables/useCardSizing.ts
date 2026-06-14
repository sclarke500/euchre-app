/**
 * Card sizing — derived entirely from the single board-viewport source of truth.
 *
 * There are NO device tiers anymore. The canonical height is fixed, so the base
 * card size is a constant in canonical units and the engine's one scale handles
 * every device. Context multipliers (user hand larger, opponents smaller, etc.)
 * are a single fixed set applied in canonical space.
 *
 * The deviceMode `isMobile`/`isSmallMobile` helpers are still re-exported here
 * (some call sites import them from this module) but they no longer affect sizing.
 */
import { computed } from 'vue'
import {
  isMobile as deviceIsMobile,
  isSmallMobile as deviceIsSmallMobile,
} from '@/utils/deviceMode'
import {
  useBoardViewport,
  BASE_CARD_WIDTH,
  BASE_CARD_HEIGHT,
} from '@/composables/useBoardViewport'

/**
 * Single set of context multipliers (relative to base card width), applied in
 * canonical space for every device. Tuned from the former "mobile" values,
 * which are the primary target.
 */
export const CardScales = {
  userHand: 1.5, // Player's hand — largest for readability/tapping
  opponentHand: 0.65, // Opponent hands — smaller to fit on table
  playArea: 0.8, // Cards played to center
  deck: 0.8, // Deal stack
  tricksWon: 0.5, // Won-trick piles
  sweep: 0.6, // Cards being swept off table
  mini: 0.3, // Very small (restoration animations)
  hidden: 0.05, // Collapsed at avatar (essentially invisible)
} as const

// ── Device-class helpers (no longer affect sizing) ───────────────────────────

export function isMobile(): boolean {
  return deviceIsMobile()
}

export function isSmallMobile(): boolean {
  return deviceIsSmallMobile()
}

// ── Canonical dimensions (board coordinate space) ────────────────────────────

/** Board width in canonical units (varies with viewport aspect). */
export function getViewportWidth(): number {
  return useBoardViewport().canonicalWidth.value
}

/** Board height in canonical units (constant). */
export function getViewportHeight(): number {
  return useBoardViewport().canonicalHeight.value
}

/** Base card width in canonical units (constant — no tiers). */
export function getBaseCardWidth(): number {
  return BASE_CARD_WIDTH
}

/** Convenience accessor mirroring the old API. */
export function getScales() {
  return CardScales
}

// ── Composable for reactive card sizing (used by CardTable) ──────────────────

export function useCardSizing() {
  const { canonicalWidth, canonicalHeight } = useBoardViewport()

  const mobileMode = computed(() => deviceIsMobile())
  const baseWidth = computed(() => BASE_CARD_WIDTH)
  const baseHeight = computed(() => BASE_CARD_HEIGHT)

  const sizes = computed(() => ({
    base: { width: baseWidth.value, height: baseHeight.value },
    userHand: {
      width: Math.round(baseWidth.value * CardScales.userHand),
      height: Math.round(baseHeight.value * CardScales.userHand),
      scale: CardScales.userHand,
    },
    opponentHand: {
      width: Math.round(baseWidth.value * CardScales.opponentHand),
      height: Math.round(baseHeight.value * CardScales.opponentHand),
      scale: CardScales.opponentHand,
    },
    playArea: {
      width: Math.round(baseWidth.value * CardScales.playArea),
      height: Math.round(baseHeight.value * CardScales.playArea),
      scale: CardScales.playArea,
    },
    deck: {
      width: Math.round(baseWidth.value * CardScales.deck),
      height: Math.round(baseHeight.value * CardScales.deck),
      scale: CardScales.deck,
    },
    tricksWon: {
      width: Math.round(baseWidth.value * CardScales.tricksWon),
      height: Math.round(baseHeight.value * CardScales.tricksWon),
      scale: CardScales.tricksWon,
    },
  }))

  return {
    viewportWidth: canonicalWidth,
    viewportHeight: canonicalHeight,
    mobileMode,
    baseWidth,
    baseHeight,
    sizes,
    scales: CardScales,
  }
}
