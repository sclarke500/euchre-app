/**
 * Device Mode Detection & Initialization
 * 
 * Runs once on app init. Sets global CSS classes and custom properties
 * based on device type. Does NOT respond to resize — dimensions are
 * locked at init time for games.
 * 
 * Modes:
 * - mobile: phones in landscape (uses full screen, no aspect ratio constraint)
 * - full: tablets/desktop (16:9 scaled container)
 * 
 * Small-mobile is a sub-mode of mobile with smaller card sizes.
 */

// Standard card aspect ratio
const CARD_ASPECT_RATIO = 1.4

// Card base widths per mode
const CARD_WIDTH_SMALL_MOBILE = 54
const CARD_WIDTH_MOBILE = 60
const CARD_WIDTH_FULL = 84  // 70 * 1.2 = 84 (20% larger for tablets/desktop)

// Singleton state
let initialized = false
let mode: 'mobile' | 'full' = 'full'
let isSmallMobileMode = false
let cardWidth = CARD_WIDTH_FULL
let cardHeight = Math.round(CARD_WIDTH_FULL * CARD_ASPECT_RATIO)

/**
 * Detect if device is mobile (phone)
 * - width < 768px (phone portrait)
 * - height < 500px (phone landscape)
 */
function detectMobile(): boolean {
  return window.innerWidth < 768 || window.innerHeight < 500
}

/**
 * Detect small mobile (cramped phones like iPhone SE)
 * - height < 400px AND width < 860px
 */
function detectSmallMobile(): boolean {
  return window.innerHeight < 400 && window.innerWidth < 860
}

/**
 * Initialize device mode. Call once on app startup.
 * Sets global CSS classes and custom properties.
 */
export function initDeviceMode(): void {
  if (initialized) {
    console.log('[DeviceMode] Already initialized, skipping')
    return
  }

  const width = window.innerWidth
  const height = window.innerHeight
  
  // Detect mode
  const isMobile = detectMobile()
  const isSmall = detectSmallMobile()
  
  mode = isMobile ? 'mobile' : 'full'
  isSmallMobileMode = isSmall
  
  // Determine card size
  if (isSmall) {
    cardWidth = CARD_WIDTH_SMALL_MOBILE
  } else if (isMobile) {
    cardWidth = CARD_WIDTH_MOBILE
  } else {
    cardWidth = CARD_WIDTH_FULL
  }
  cardHeight = Math.round(cardWidth * CARD_ASPECT_RATIO)
  
  // Apply classes to document
  const html = document.documentElement
  html.classList.remove('mobile-mode', 'full-mode', 'small-mobile')
  html.classList.add(`${mode}-mode`)
  if (isSmall) {
    html.classList.add('small-mobile')
  }
  
  // Set CSS custom properties
  html.style.setProperty('--card-width', `${cardWidth}px`)
  html.style.setProperty('--card-height', `${cardHeight}px`)
  html.style.setProperty('--card-base-width', `${cardWidth}px`)
  html.style.setProperty('--card-base-height', `${cardHeight}px`)
  
  initialized = true
  
  console.log(`[DeviceMode] Initialized: ${width}x${height} → ${mode}${isSmall ? ' (small)' : ''}, cards: ${cardWidth}x${cardHeight}px`)
}

/**
 * Get current device mode
 */
export function getDeviceMode(): 'mobile' | 'full' {
  return mode
}

/**
 * Check if in mobile mode
 */
export function isMobile(): boolean {
  return mode === 'mobile'
}

/**
 * Check if in full mode (tablet/desktop)
 */
export function isFullMode(): boolean {
  return mode === 'full'
}

/**
 * Check if in small mobile mode
 */
export function isSmallMobile(): boolean {
  return isSmallMobileMode
}

/**
 * Get current card dimensions
 */
export function getCardWidth(): number {
  return cardWidth
}

export function getCardHeight(): number {
  return cardHeight
}

/**
 * Get card dimensions as object
 */
export function getCardDimensions(): { width: number; height: number } {
  return { width: cardWidth, height: cardHeight }
}
