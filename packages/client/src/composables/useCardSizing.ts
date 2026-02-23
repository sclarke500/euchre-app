/**
 * Centralized card sizing based on viewport.
 * 
 * Two modes: Mobile (phones) vs Full (iPad/desktop)
 * Mobile: width < 768px OR height < 500px (catches phone portrait + landscape)
 * Full: everything else - uses 16:9 scaled container
 * 
 * Detection is done once on app init via deviceMode.ts
 * This module provides reactive access and context-specific scales.
 */

import { ref, computed, onMounted, watch } from 'vue'
import {
  isMobile as deviceIsMobile,
  isSmallMobile as deviceIsSmallMobile,
  isFullMode as deviceIsFullMode,
  getCardWidth as getDeviceCardWidth,
  getCardHeight as getDeviceCardHeight,
} from '@/utils/deviceMode'

// Standard playing card aspect ratio
const CARD_ASPECT_RATIO = 1.4

// Card sizes for each mode (kept for reference, actual values from deviceMode)
const SMALL_MOBILE_BASE_WIDTH = 54  // iPhone SE, small phones (height < 400)
const MOBILE_BASE_WIDTH = 60
const FULL_BASE_WIDTH = 70

// Canonical dimensions for full mode (16:9 scaled container)
const CANONICAL_WIDTH = 1120
const CANONICAL_HEIGHT = 630

// Context multipliers for small mobile (iPhone SE, very cramped)
const SmallMobileScales = {
  userHand: 1.3,        // Smaller than regular mobile
  opponentHand: 0.6,    // Tighter
  playArea: 0.75,       // Slightly smaller
  deck: 0.75,           // Deal stack
  tricksWon: 0.45,      // Won trick piles
  sweep: 0.55,          // Cards being swept
  mini: 0.25,           // Very small
  hidden: 0.05,         // Collapsed at avatar
} as const

// Context multipliers for mobile (need differentiation due to small screen)
const MobileScales = {
  userHand: 1.5,        // Player's hand - largest for readability/tapping
  opponentHand: 0.65,   // Opponent hands - smaller to fit on table
  playArea: 0.8,        // Cards played to center
  deck: 0.8,            // Deal stack
  tricksWon: 0.5,       // Won trick piles - small stacks
  sweep: 0.6,           // Cards being swept off table
  mini: 0.3,            // Very small (restoration animations)
  hidden: 0.05,         // Collapsed at avatar (essentially invisible)
} as const

// Context multipliers for full mode (more uniform, more room)
const FullScales = {
  userHand: 1.2,        // Larger for easier tapping/visibility
  opponentHand: 0.8,    // Slightly smaller than play area
  playArea: 1.0,        // Standard size in play area
  deck: 1.0,            // Deal stack
  tricksWon: 0.6,       // Won trick piles
  sweep: 1.0,           // Cards being swept
  mini: 0.3,            // Very small
  hidden: 0.05,         // Collapsed at avatar
} as const

// Singleton state - shared across all components
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 768)

// Lock state for ScaledContainer - when locked, viewport doesn't respond to resize
let viewportLocked = false

function updateViewport() {
  // Don't update if viewport is locked (we're in scaled container mode)
  if (viewportLocked) return
  
  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
  
  // Update CSS class on document for CSS-based responsive styling
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('mobile-mode', isMobile())
    document.documentElement.classList.toggle('full-mode', !isMobile())
  }
}

/**
 * Lock viewport to fixed dimensions (for ScaledContainer)
 * When locked, resize events are ignored and dimensions stay fixed
 */
export function lockViewport(width: number, height: number) {
  viewportLocked = true
  viewportWidth.value = width
  viewportHeight.value = height
  
  // Update CSS classes for the locked dimensions
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('mobile-mode', isMobile())
    document.documentElement.classList.toggle('full-mode', !isMobile())
  }
}

/**
 * Unlock viewport to respond to window resize again
 */
export function unlockViewport() {
  viewportLocked = false
  updateViewport()
}

/**
 * Check if viewport is currently locked
 */
export function isViewportLocked(): boolean {
  return viewportLocked
}

let listenerAttached = false

/**
 * Detect small mobile: small phones in landscape
 * Uses deviceMode detection (run once at init)
 */
export function isSmallMobile(): boolean {
  return deviceIsSmallMobile()
}

/**
 * Detect mobile mode: phones in any orientation
 * Uses deviceMode detection (run once at init)
 */
export function isMobile(): boolean {
  return deviceIsMobile()
}

/**
 * Get current viewport width
 * In full mode, returns canonical width (1120) for consistent positioning
 */
export function getViewportWidth(): number {
  if (deviceIsFullMode()) {
    return CANONICAL_WIDTH
  }
  return viewportWidth.value
}

/**
 * Get current viewport height
 * In full mode, returns canonical height (630) for consistent positioning
 */
export function getViewportHeight(): number {
  if (deviceIsFullMode()) {
    return CANONICAL_HEIGHT
  }
  return viewportHeight.value
}

/**
 * Get the base card width for current viewport mode
 * Uses deviceMode detection (values set once at init)
 */
export function getBaseCardWidth(): number {
  return getDeviceCardWidth()
}

/**
 * Get scales for current mode
 */
export function getScales() {
  if (isSmallMobile()) return SmallMobileScales
  if (isMobile()) return MobileScales
  return FullScales
}

// Dynamic scales based on viewport mode
export const CardScales = new Proxy({} as typeof MobileScales, {
  get(_, prop: keyof typeof MobileScales) {
    if (isSmallMobile()) return SmallMobileScales[prop]
    if (isMobile()) return MobileScales[prop]
    return FullScales[prop]
  }
})

/**
 * Composable for reactive card sizing
 */
export function useCardSizing() {
  onMounted(() => {
    if (!listenerAttached && typeof window !== 'undefined') {
      window.addEventListener('resize', updateViewport)
      listenerAttached = true
      updateViewport() // Set initial CSS classes
    }
  })

  // Note: We don't remove the listener since it's shared singleton state
  // This is intentional - the sizing should stay reactive app-wide

  const mobileMode = computed(() => isMobile())
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
    mobileMode,
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
