/**
 * Centralized card sizing based on viewport.
 * 
 * Cards scale up on larger screens, with multipliers for different contexts.
 * Base size determined by viewport, then each context applies its multiplier.
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'

// Standard playing card aspect ratio
const CARD_ASPECT_RATIO = 1.4

// Base card width at different viewport breakpoints
// These are the "1.0 scale" reference sizes
const VIEWPORT_BREAKPOINTS = [
  { minWidth: 1920, baseWidth: 95 },   // Large desktop / TV
  { minWidth: 1440, baseWidth: 88 },   // Desktop
  { minWidth: 1024, baseWidth: 83 },   // iPad landscape / small desktop
  { minWidth: 768, baseWidth: 78 },    // iPad portrait
  { minWidth: 0, baseWidth: 70 },      // Mobile
]

// Context multipliers - these are consistent across all games
export const CardScales = {
  userHand: 1.5,        // Player's hand - largest for readability
  opponentHand: 0.65,   // Opponent hands - smaller to fit on table
  playArea: 0.85,       // Cards played to center
  deck: 0.8,            // Deal stack
  tricksWon: 0.5,       // Won trick piles - small stacks
  sweep: 0.6,           // Cards being swept off table
  mini: 0.3,            // Very small (restoration animations)
  hidden: 0.05,         // Collapsed at avatar (essentially invisible)
} as const

// Singleton state - shared across all components
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 768)

function updateViewport() {
  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
}

let listenerAttached = false

/**
 * Get the base card width for current viewport
 */
export function getBaseCardWidth(): number {
  const width = viewportWidth.value
  const breakpoint = VIEWPORT_BREAKPOINTS.find(bp => width >= bp.minWidth)
  return breakpoint?.baseWidth ?? 83
}

/**
 * Composable for reactive card sizing
 */
export function useCardSizing() {
  onMounted(() => {
    if (!listenerAttached && typeof window !== 'undefined') {
      window.addEventListener('resize', updateViewport)
      listenerAttached = true
      updateViewport()
    }
  })

  // Note: We don't remove the listener since it's shared singleton state
  // This is intentional - the sizing should stay reactive app-wide

  const baseWidth = computed(() => getBaseCardWidth())
  const baseHeight = computed(() => Math.round(baseWidth.value * CARD_ASPECT_RATIO))

  // Computed sizes for each context
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
    viewportWidth,
    viewportHeight,
    baseWidth,
    baseHeight,
    sizes,
    scales: CardScales,
  }
}

/**
 * Get card config for useCardController
 * Call this when setting up the game to get viewport-appropriate scales
 */
export function getCardControllerConfig() {
  return {
    userHandScale: CardScales.userHand,
    opponentHandScale: CardScales.opponentHand,
    // Note: play area and deck scales are handled within useCardController
  }
}
