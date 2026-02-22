/**
 * Centralized card sizing based on viewport.
 * 
 * Two modes: Mobile (phones) vs Full (iPad/desktop)
 * Mobile: width < 768px OR height < 500px (catches phone portrait + landscape)
 * Full: everything else, table capped at 1050x700
 */

import { ref, computed, onMounted, watch } from 'vue'

// Standard playing card aspect ratio
const CARD_ASPECT_RATIO = 1.4

// Card sizes for each mode
const MOBILE_BASE_WIDTH = 60
const FULL_BASE_WIDTH = 70

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
  userHand: 1.0,        // Same size as table cards
  opponentHand: 0.7,    // Slightly smaller
  playArea: 1.0,        // Same as user hand
  deck: 0.8,            // Deal stack
  tricksWon: 0.5,       // Won trick piles
  sweep: 0.6,           // Cards being swept
  mini: 0.3,            // Very small
  hidden: 0.05,         // Collapsed at avatar
} as const

// Singleton state - shared across all components
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 768)

function updateViewport() {
  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
  
  // Update CSS class on document for CSS-based responsive styling
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('mobile-mode', isMobile())
    document.documentElement.classList.toggle('full-mode', !isMobile())
  }
}

let listenerAttached = false

/**
 * Detect mobile mode: phones in any orientation
 * - width < 768px (phone portrait)
 * - height < 500px (phone landscape)
 */
export function isMobile(): boolean {
  return viewportWidth.value < 768 || viewportHeight.value < 500
}

/**
 * Get current viewport width
 */
export function getViewportWidth(): number {
  return viewportWidth.value
}

/**
 * Get current viewport height
 */
export function getViewportHeight(): number {
  return viewportHeight.value
}

/**
 * Get the base card width for current viewport mode
 */
export function getBaseCardWidth(): number {
  const mobile = isMobile()
  const baseWidth = mobile ? MOBILE_BASE_WIDTH : FULL_BASE_WIDTH
  
  console.log(`[CardSizing] ${viewportWidth.value}x${viewportHeight.value} → ${mobile ? 'mobile' : 'full'} → baseWidth: ${baseWidth}px`)
  return baseWidth
}

/**
 * Get scales for current mode
 */
export function getScales() {
  return isMobile() ? MobileScales : FullScales
}

// Dynamic scales based on viewport mode
export const CardScales = new Proxy({} as typeof MobileScales, {
  get(_, prop: keyof typeof MobileScales) {
    return isMobile() ? MobileScales[prop] : FullScales[prop]
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
