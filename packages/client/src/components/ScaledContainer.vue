<script setup lang="ts">
/**
 * ScaledContainer — viewport adapter for the card engine (Model B).
 *
 * Canonical height is fixed (720); width follows viewport aspect ratio.
 * One scale (`viewportHeight / 720`) maps canonical → CSS px via transform.
 * Safe-area insets are exposed as --safe-* CSS vars for HUD positioning;
 * the felt is full-bleed under notches.
 *
 * See docs/PLATFORM_CONTRACT.md and useBoardViewport.ts.
 *
 * iOS: viewport dimensions are derived from screen size + orientation because
 * visualViewport is unreliable during rotation transitions.
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { isMobile } from '@/utils/deviceMode'
import { getDeviceSafeAreas, type SafeAreaInsets } from '@/utils/deviceSafeAreas'
import { useSettingsStore } from '@/stores/settingsStore'
import { useBoardViewport, setViewportSize, setSafeInsets } from '@/composables/useBoardViewport'

const settings = useSettingsStore()

// Canonical geometry + scale come from the single board-viewport source of truth
// (model B: fixed canonical height, width follows viewport aspect, one scale).
const { canonicalWidth, canonicalHeight, scale, safeRect } = useBoardViewport()

// Expose the board scale as a CSS variable so screen-fixed HUD overlays
// (scoreboard, action panel, menu, etc.) can scale in lockstep with the board
// via `transform: scale(var(--board-scale))`.
watch(scale, (s) => {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--board-scale', String(s))
  }
}, { immediate: true })

// Expose per-edge safe-area insets in CANONICAL units. The felt fills the whole
// viewport (full-bleed, under notches); the interactive HUD adds these to its
// edge offsets via calc(... + var(--safe-*)) so nothing tappable/readable hides
// behind a notch, camera cutout, or home indicator.
watch([safeRect, canonicalWidth, canonicalHeight], ([rect, cw, ch]) => {
  if (typeof document === 'undefined') return
  const s = document.documentElement.style
  s.setProperty('--safe-left', `${Math.round(rect.left)}px`)
  s.setProperty('--safe-top', `${Math.round(rect.top)}px`)
  s.setProperty('--safe-right', `${Math.round(cw - rect.right)}px`)
  s.setProperty('--safe-bottom', `${Math.round(ch - rect.bottom)}px`)
}, { immediate: true })

const wrapperRef = ref<HTMLElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const safeInsets = ref<SafeAreaInsets>({ top: 0, right: 0, bottom: 0, left: 0 })
const deviceName = ref('Unknown')
const isPortrait = ref(false)

// ── TEMP full-bleed diagnostic ───────────────────────────────────────────────
// On-screen readout of every dimension source + the REAL env(safe-area-inset)
// values, so we can see whether the PWA is drawing under the notch. Remove once
// the bleed issue is resolved.
const SHOW_BLEED_DEBUG = true
const dbg = ref('')

/** Read the browser's actual safe-area insets via a probe element. */
function readEnvInsets(): { t: number; r: number; b: number; l: number } {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) ' +
    'env(safe-area-inset-bottom) env(safe-area-inset-left);'
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const out = {
    t: Math.round(parseFloat(cs.paddingTop) || 0),
    r: Math.round(parseFloat(cs.paddingRight) || 0),
    b: Math.round(parseFloat(cs.paddingBottom) || 0),
    l: Math.round(parseFloat(cs.paddingLeft) || 0),
  }
  document.body.removeChild(probe)
  return out
}

function updateDebug(): void {
  if (!SHOW_BLEED_DEBUG) return
  const env = readEnvInsets()
  const vv = window.visualViewport
  const wrap = wrapperRef.value?.getBoundingClientRect()
  const standalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  dbg.value = [
    `screen ${window.screen.width}x${window.screen.height}`,
    `inner ${window.innerWidth}x${window.innerHeight}`,
    `vv ${vv ? Math.round(vv.width) + 'x' + Math.round(vv.height) : '-'}`,
    `docEl ${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`,
    `wrap ${wrap ? Math.round(wrap.width) + 'x' + Math.round(wrap.height) : '-'}`,
    `ENV t${env.t} r${env.r} b${env.b} l${env.l}`,
    `iOS:${isIOS()} mob:${isMobile()} sa:${standalone} ${isPortrait.value ? 'P' : 'L'}`,
  ].join('\n')
}

// Track last known dimensions
let lastViewportW = 0
let lastViewportH = 0

/**
 * Get device orientation using screen.orientation API
 * More reliable than comparing viewport dimensions during iOS transitions
 */
function getDeviceOrientation(): 'portrait' | 'landscape' {
  // Try screen.orientation API first (most reliable)
  if (screen.orientation?.type) {
    return screen.orientation.type.startsWith('portrait') ? 'portrait' : 'landscape'
  }
  // Fallback: deprecated window.orientation (still works on iOS)
  if (typeof window.orientation === 'number') {
    return (window.orientation === 0 || window.orientation === 180) ? 'portrait' : 'landscape'
  }
  // Last resort: compare dimensions
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
}

/**
 * Detect if running on iOS
 */
function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

/**
 * Derive full-screen dimensions from physical screen + orientation.
 * Used as fallback when layout APIs are mid-rotation garbage (iOS PWA).
 */
function getScreenOrientedDimensions(): { width: number, height: number } {
  const orientation = getDeviceOrientation()
  const screenW = window.screen.width
  const screenH = window.screen.height
  const isScreenPortrait = screenH > screenW

  if (orientation === 'portrait') {
    return {
      width: isScreenPortrait ? screenW : screenH,
      height: isScreenPortrait ? screenH : screenW,
    }
  }
  return {
    width: isScreenPortrait ? screenH : screenW,
    height: isScreenPortrait ? screenW : screenH,
  }
}

/**
 * Get viewport dimensions for scale math.
 * Prefer the laid-out wrapper (self-corrects PWA safe-area inset quirks), then
 * visualViewport / documentElement, then iOS screen fallback.
 */
function getViewportDimensions(): { width: number, height: number } {
  // The wrapper is fixed + inset:0 — it IS the drawable viewport (the full screen
  // when viewport-fit=cover is honored, the safe-area box otherwise). Measure it
  // directly and fill exactly that. Do NOT force it up to the physical screen
  // size: if the body is inset, a bigger board just overflows off the right edge
  // (it's anchored top-left) instead of moving under the notch.
  if (wrapperRef.value) {
    const rect = wrapperRef.value.getBoundingClientRect()
    if (rect.width >= 200 && rect.height >= 200) {
      return { width: Math.round(rect.width), height: Math.round(rect.height) }
    }
  }

  const vv = window.visualViewport
  if (vv && vv.width >= 200 && vv.height >= 200) {
    return { width: Math.round(vv.width), height: Math.round(vv.height) }
  }

  const innerW = window.innerWidth
  const innerH = window.innerHeight
  if (innerW >= 200 && innerH >= 200) {
    return { width: innerW, height: innerH }
  }

  if (isMobile() && isIOS()) {
    return getScreenOrientedDimensions()
  }

  return { width: innerW || 1280, height: innerH || 720 }
}

/**
 * Check if viewport dimensions look valid for the given orientation
 */
function dimensionsLookValid(width: number, height: number, orientation: 'portrait' | 'landscape'): boolean {
  // Reject zero/tiny dimensions
  if (width < 200 || height < 200) return false
  
  // Reject square-ish dimensions (mid-transition garbage)
  const ratio = width / height
  if (ratio > 0.9 && ratio < 1.1) return false
  
  // Check if dimensions match expected orientation
  const looksPortrait = height > width
  const looksLandscape = width > height
  
  if (orientation === 'portrait' && !looksPortrait) return false
  if (orientation === 'landscape' && !looksLandscape) return false
  
  return true
}

function resolveEdgeInsets(isPortraitOrientation: boolean): SafeAreaInsets {
  if (!isMobile()) return { top: 0, right: 0, bottom: 0, left: 0 }

  const deviceInfo = getDeviceSafeAreas()
  deviceName.value = deviceInfo.name
  if (isPortraitOrientation) {
    // deviceSafeAreas returns landscape values; the notch moves to top in portrait
    return { top: deviceInfo.insets.left, right: 0, bottom: deviceInfo.insets.bottom, left: 0 }
  }
  return deviceInfo.insets
}

function calculateScale() {
  const deviceOrientation = getDeviceOrientation()
  isPortrait.value = deviceOrientation === 'portrait'

  const insets = resolveEdgeInsets(isPortrait.value)
  safeInsets.value = insets

  const { width: viewportW, height: viewportH } = getViewportDimensions()

  if (viewportW === 0 || viewportH === 0) return

  // Viewport-px safe areas for teleported overlays (chat, modals, back button).
  if (typeof document !== 'undefined') {
    const s = document.documentElement.style
    s.setProperty('--screen-safe-top', `${insets.top}px`)
    s.setProperty('--screen-safe-right', `${insets.right}px`)
    s.setProperty('--screen-safe-bottom', `${insets.bottom}px`)
    s.setProperty('--screen-safe-left', `${insets.left}px`)
  }

  // Feed the single source of truth (canonical width + scale derive from this).
  setViewportSize(viewportW, viewportH)
  setSafeInsets(insets)

  lastViewportW = viewportW
  lastViewportH = viewportH

  updateDebug()
}

function handleResize() {
  // Calculate immediately - dimensions are derived from screen size on mobile
  calculateScale()
}

function handleOrientationChange() {
  const targetOrientation = getDeviceOrientation()
  console.log(`[ScaledContainer] Orientation change → ${targetOrientation}`)
  
  // Recalculate immediately - we derive dimensions from screen size + orientation
  // so we don't need to wait for viewport to settle
  calculateScale()
  
  // But also do a couple follow-ups in case screen.orientation was slow
  setTimeout(() => calculateScale(), 100)
  setTimeout(() => calculateScale(), 300)
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (wrapperRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => calculateScale())
    resizeObserver.observe(wrapperRef.value)
  }

  // Initial calculation with small delay to let DOM settle
  requestAnimationFrame(() => {
    calculateScale()

    // On mobile, do a few more checks in case dimensions are still settling
    if (isMobile()) {
      setTimeout(() => calculateScale(), 100)
      setTimeout(() => calculateScale(), 300)
    }
  })

  window.addEventListener('resize', handleResize)
  window.addEventListener('orientationchange', handleOrientationChange)

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleResize)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null

  window.removeEventListener('resize', handleResize)
  window.removeEventListener('orientationchange', handleOrientationChange)

  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', handleResize)
  }
})

// Model B fills the viewport exactly (canonical aspect == viewport aspect), so
// the board scales from the top-left with no centering offset.
const scaledStyle = computed(() => ({
  width: `${canonicalWidth.value}px`,
  height: `${canonicalHeight.value}px`,
  transform: `scale(${scale.value})`,
}))

// Aurora glow sits behind the board (slightly larger), sharing the same scale.
const auroraStyle = computed(() => {
  const glowPad = 50
  return {
    width: `${canonicalWidth.value + glowPad * 2}px`,
    height: `${canonicalHeight.value + glowPad * 2}px`,
    transform: `translate(${-glowPad * scale.value}px, ${-glowPad * scale.value}px) scale(${scale.value})`,
  }
})

// Expose dimensions for child components
const containerWidth = computed(() => canonicalWidth.value)
const containerHeight = computed(() => canonicalHeight.value)

defineExpose({
  width: containerWidth,
  height: containerHeight,
  scale,
  deviceName,
  safeInsets,
  isPortrait,
})
</script>

<template>
  <div ref="wrapperRef" class="scaled-container-wrapper" :class="[`theme-${settings.roomTheme}`, { 'is-mobile': isMobile() }]">
    <!-- Star field background (space theme only) -->
    <template v-if="settings.roomTheme === 'space'">
      <div class="star-field">
        <div class="stars stars-small"></div>
        <div class="stars stars-medium"></div>
        <div class="stars stars-large"></div>
      </div>
      
      <!-- Aurora glow orbs (static on mobile for performance) -->
      <div class="aurora-orb orb-1" :style="auroraStyle"></div>
      <div class="aurora-orb orb-2" :style="auroraStyle"></div>
      <div class="aurora-orb orb-3" :style="auroraStyle"></div>
    </template>
    
    <div
      ref="containerRef"
      class="scaled-container"
      :style="scaledStyle"
    >
      <slot />
    </div>

    <!-- TEMP full-bleed diagnostic readout -->
    <pre v-if="SHOW_BLEED_DEBUG" class="bleed-debug">{{ dbg }}</pre>
  </div>
</template>

<style scoped lang="scss">
.bleed-debug {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 99999;
  margin: 0;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.82);
  color: #6f6;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
  line-height: 1.5;
  border: 1px solid #6f6;
  border-radius: 8px;
  white-space: pre;
  pointer-events: none;
}

.scaled-container-wrapper {
  // Fill the drawable viewport exactly (the full screen when viewport-fit=cover
  // is honored, the safe-area box otherwise). The board sizes itself to this.
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: radial-gradient(ellipse at center, #12121a 0%, #08080c 50%, #050508 100%);
}

// Star field - layers of different star sizes
.star-field {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.stars {
  position: absolute;
  width: 100%;
  height: 100%;
  background-repeat: repeat;
}

// Small stars - dense, dim, subtle twinkle
.stars-small {
  background-image: 
    radial-gradient(1px 1px at 20px 30px, rgba(255,255,255,0.8), transparent),
    radial-gradient(1px 1px at 40px 70px, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 50px 160px, rgba(255,255,255,0.7), transparent),
    radial-gradient(1px 1px at 90px 40px, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.7), transparent),
    radial-gradient(1px 1px at 160px 120px, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 200px 50px, rgba(255,255,255,0.8), transparent),
    radial-gradient(1px 1px at 220px 150px, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 250px 90px, rgba(255,255,255,0.7), transparent),
    radial-gradient(1px 1px at 280px 180px, rgba(255,255,255,0.6), transparent);
  background-size: 300px 200px;
  animation: twinkle 4s ease-in-out infinite;
}

// Medium stars - scattered, brighter
.stars-medium {
  background-image:
    radial-gradient(1.5px 1.5px at 70px 55px, rgba(255,255,255,0.9), transparent),
    radial-gradient(1.5px 1.5px at 150px 140px, rgba(200,220,255,0.85), transparent),
    radial-gradient(1.5px 1.5px at 230px 25px, rgba(255,255,255,0.8), transparent),
    radial-gradient(1.5px 1.5px at 310px 110px, rgba(255,230,200,0.85), transparent),
    radial-gradient(1.5px 1.5px at 380px 75px, rgba(255,255,255,0.9), transparent);
  background-size: 450px 180px;
  animation: twinkle 6s ease-in-out infinite reverse;
}

// Large stars - few, bright, slow twinkle
.stars-large {
  background-image:
    radial-gradient(2px 2px at 100px 80px, rgba(255,255,255,1), transparent),
    radial-gradient(2.5px 2.5px at 320px 150px, rgba(200,220,255,0.95), transparent),
    radial-gradient(2px 2px at 500px 60px, rgba(255,240,220,0.9), transparent),
    radial-gradient(3px 3px at 700px 120px, rgba(255,255,255,1), transparent);
  background-size: 800px 200px;
  animation: twinkle 8s ease-in-out infinite;
}

@keyframes twinkle {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

// Glowing orbs that move around the container
.aurora-orb {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  pointer-events: none;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.35;
}

.orb-1 {
  background: rgba(100, 255, 150, 0.6); // Green
  animation: drift1 20s ease-in-out infinite, color1 20s ease-in-out infinite;
}

.orb-2 {
  background: rgba(100, 180, 255, 0.6); // Blue
  animation: drift2 25s ease-in-out infinite, color2 25s ease-in-out infinite;
}

.orb-3 {
  background: rgba(180, 150, 255, 0.6); // Purple
  animation: drift3 30s ease-in-out infinite, color3 30s ease-in-out infinite;
}

.scaled-container {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  overflow: hidden;
  border-radius: 16px;
  // Beveled edge effect - light top-left, dark bottom-right
  border: 2px solid transparent;
  border-top-color: rgba(255, 255, 255, 0.15);
  border-left-color: rgba(255, 255, 255, 0.1);
  border-bottom-color: rgba(0, 0, 0, 0.3);
  border-right-color: rgba(0, 0, 0, 0.25);
  // Layered inset shadows for depth
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.1),      // top highlight
    inset 0 -1px 0 rgba(0, 0, 0, 0.2),           // bottom shadow
    inset 2px 2px 8px rgba(255, 255, 255, 0.05), // inner top-left glow
    inset -2px -2px 8px rgba(0, 0, 0, 0.15),     // inner bottom-right shadow
    inset 0 0 30px rgba(0, 0, 0, 0.25);          // overall depth
}

// Orbs drift around bottom-right quadrant - like orbiting a planet
// Container is 1120x630, orbs are 300px, margins position their top-left corner
@keyframes drift1 {
  0%, 100% { margin: 420px 0 0 750px; opacity: 0.4; }    // bottom-right
  33% { margin: 480px 0 0 600px; opacity: 0.3; }         // bottom-center-right
  66% { margin: 380px 0 0 850px; opacity: 0.35; }        // right edge
}

@keyframes drift2 {
  0%, 100% { margin: 520px 0 0 850px; opacity: 0.35; }   // bottom-right corner
  50% { margin: 400px 0 0 700px; opacity: 0.4; }         // center-right
}

@keyframes drift3 {
  0%, 100% { margin: 460px 0 0 900px; opacity: 0.3; }    // right edge
  40% { margin: 530px 0 0 650px; opacity: 0.35; }        // bottom
  80% { margin: 380px 0 0 800px; opacity: 0.25; }        // right
}

// Color shifts include fading to dark
@keyframes color1 {
  0%, 100% { background: rgba(100, 255, 150, 0.5); }
  30% { background: rgba(50, 80, 60, 0.1); } // dark
  50% { background: rgba(50, 255, 220, 0.5); } // teal
  80% { background: rgba(100, 255, 150, 0.5); }
}

@keyframes color2 {
  0%, 100% { background: rgba(100, 180, 255, 0.5); }
  25% { background: rgba(40, 60, 80, 0.1); } // dark
  50% { background: rgba(180, 150, 255, 0.5); } // purple
  75% { background: rgba(100, 180, 255, 0.5); }
}

@keyframes color3 {
  0%, 100% { background: rgba(180, 150, 255, 0.5); }
  35% { background: rgba(100, 255, 150, 0.5); } // green
  55% { background: rgba(50, 50, 60, 0.1); } // dark
  80% { background: rgba(50, 255, 220, 0.5); } // teal
}

// Mobile: static aurora orbs (no animation = GPU caches the blur)
// Positioned bottom-right like orbiting a planet
.is-mobile {
  .aurora-orb {
    animation: none !important;
  }
  .orb-1 {
    margin: 280px 0 0 550px;
    background: rgba(100, 255, 150, 0.5);
  }
  .orb-2 {
    margin: 350px 0 0 620px;
    background: rgba(100, 180, 255, 0.5);
  }
  .orb-3 {
    margin: 220px 0 0 500px;
    background: rgba(180, 150, 255, 0.5);
  }
  // Disable star twinkle on mobile too
  .stars {
    animation: none !important;
    opacity: 0.85;
  }
}

// ============================================
// ROOM THEMES
// ============================================

// Games Room - grey carpet with subtle texture
.theme-games-room {
  background: 
    // Carpet texture noise
    url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.08'/%3E%3C/svg%3E"),
    // Subtle vignette
    radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.4) 100%),
    // Base carpet grey
    linear-gradient(180deg, #3a3a3a 0%, #2d2d2d 50%, #252525 100%);
}

// Pub - warm oak hardwood floor (lighter, warmer than rail)
.theme-pub {
  position: relative;
  overflow: hidden;
  
  // Wood plank texture
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url('@/assets/textures/hardwood-floor.jpg');
    background-size: 600px auto;
    // Slightly darkened for pub ambiance
    filter: brightness(0.72) saturate(1.15) sepia(0.1);
    pointer-events: none;
    z-index: 0;
  }
  
  // Vignette only - no tint
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%);
    pointer-events: none;
    z-index: 0;
  }
  
  // Ensure content stays above background layers
  > * {
    position: relative;
    z-index: 1;
  }
}

// Vegas - that iconic gaudy casino carpet
.theme-vegas {
  background:
    // Swirly pattern overlay
    url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0 Q45 15 30 30 Q15 45 30 60 M0 30 Q15 15 30 30 Q45 45 60 30' stroke='%23b8860b' stroke-width='2' fill='none' opacity='0.3'/%3E%3Ccircle cx='30' cy='30' r='8' fill='%23800020' opacity='0.4'/%3E%3Ccircle cx='10' cy='10' r='4' fill='%23006400' opacity='0.3'/%3E%3Ccircle cx='50' cy='50' r='4' fill='%23006400' opacity='0.3'/%3E%3Ccircle cx='10' cy='50' r='3' fill='%23b8860b' opacity='0.25'/%3E%3Ccircle cx='50' cy='10' r='3' fill='%23b8860b' opacity='0.25'/%3E%3C/svg%3E"),
    // Dark vignette
    radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.6) 100%),
    // Base deep burgundy/purple
    linear-gradient(135deg, #1a0a15 0%, #2d1428 25%, #1a0a15 50%, #2d1428 75%, #1a0a15 100%);
  background-size: 60px 60px, 100% 100%, 100% 100%;
}
</style>
