/**
 * Device-specific safe area insets for landscape mode
 * 
 * Strategy:
 * 1. Detect device via user agent + screen dimensions
 * 2. Return known precise values for common devices
 * 3. Fall back to CSS env() values for unknown devices
 * 
 * All values in CSS pixels (points on iOS)
 * 
 * Sources:
 * - useyourloaf.com/blog/iphone-16-screen-sizes/
 * - screensizechecker.com/devices/android-viewport-sizes
 */

export interface SafeAreaInsets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface DeviceInfo {
  name: string
  insets: SafeAreaInsets
  isKnown: boolean
}

// iPhone models - landscape insets (left/right are the notch sides)
const IPHONE_DEVICES: Record<string, SafeAreaInsets> = {
  // Dynamic Island - larger (iPhone 16 Pro series)
  'iPhone 16 Pro Max': { top: 0, right: 62, bottom: 21, left: 62 },
  'iPhone 16 Pro': { top: 0, right: 62, bottom: 21, left: 62 },
  
  // Dynamic Island - standard (iPhone 14 Pro, 15 all, 16/16 Plus)
  'iPhone 16 Plus': { top: 0, right: 59, bottom: 21, left: 59 },
  'iPhone 16': { top: 0, right: 59, bottom: 21, left: 59 },
  'iPhone 15 Pro Max': { top: 0, right: 59, bottom: 21, left: 59 },
  'iPhone 15 Pro': { top: 0, right: 59, bottom: 21, left: 59 },
  'iPhone 15 Plus': { top: 0, right: 59, bottom: 21, left: 59 },
  'iPhone 15': { top: 0, right: 59, bottom: 21, left: 59 },
  'iPhone 14 Pro Max': { top: 0, right: 59, bottom: 21, left: 59 },
  'iPhone 14 Pro': { top: 0, right: 59, bottom: 21, left: 59 },
  
  // Notch (iPhone X through 14/14 Plus)
  'iPhone 14 Plus': { top: 0, right: 47, bottom: 21, left: 47 },
  'iPhone 14': { top: 0, right: 47, bottom: 21, left: 47 },
  'iPhone 13 Pro Max': { top: 0, right: 47, bottom: 21, left: 47 },
  'iPhone 13 Pro': { top: 0, right: 47, bottom: 21, left: 47 },
  'iPhone 13': { top: 0, right: 47, bottom: 21, left: 47 },
  'iPhone 13 mini': { top: 0, right: 47, bottom: 21, left: 47 },
  'iPhone 12 Pro Max': { top: 0, right: 47, bottom: 21, left: 47 },
  'iPhone 12 Pro': { top: 0, right: 47, bottom: 21, left: 47 },
  'iPhone 12': { top: 0, right: 47, bottom: 21, left: 47 },
  'iPhone 12 mini': { top: 0, right: 47, bottom: 21, left: 47 },
  'iPhone 11 Pro Max': { top: 0, right: 47, bottom: 21, left: 47 },
  'iPhone 11 Pro': { top: 0, right: 47, bottom: 21, left: 47 },
  'iPhone 11': { top: 0, right: 47, bottom: 21, left: 47 },
  'iPhone XS Max': { top: 0, right: 47, bottom: 21, left: 47 },
  'iPhone XS': { top: 0, right: 47, bottom: 21, left: 47 },
  'iPhone XR': { top: 0, right: 47, bottom: 21, left: 47 },
  'iPhone X': { top: 0, right: 47, bottom: 21, left: 47 },
  
  // No notch (SE, older models)
  'iPhone SE': { top: 0, right: 0, bottom: 0, left: 0 },
  'iPhone 8': { top: 0, right: 0, bottom: 0, left: 0 },
  'iPhone 8 Plus': { top: 0, right: 0, bottom: 0, left: 0 },
  'iPhone 7': { top: 0, right: 0, bottom: 0, left: 0 },
  'iPhone 7 Plus': { top: 0, right: 0, bottom: 0, left: 0 },
}

// Android devices - punch-hole cameras are small, minimal insets needed
// In landscape, punch-hole is typically on the side and doesn't obstruct much
const ANDROID_DEVICES: Record<string, SafeAreaInsets> = {
  // Google Pixel (punch-hole camera, centered or corner)
  'Pixel 10 Pro XL': { top: 0, right: 20, bottom: 0, left: 20 },
  'Pixel 10 Pro': { top: 0, right: 20, bottom: 0, left: 20 },
  'Pixel 10': { top: 0, right: 20, bottom: 0, left: 20 },
  'Pixel 9 Pro XL': { top: 0, right: 20, bottom: 0, left: 20 },
  'Pixel 9 Pro': { top: 0, right: 20, bottom: 0, left: 20 },
  'Pixel 9': { top: 0, right: 20, bottom: 0, left: 20 },
  'Pixel 8 Pro': { top: 0, right: 20, bottom: 0, left: 20 },
  'Pixel 8': { top: 0, right: 20, bottom: 0, left: 20 },
  'Pixel 7 Pro': { top: 0, right: 20, bottom: 0, left: 20 },
  'Pixel 7': { top: 0, right: 20, bottom: 0, left: 20 },
  
  // Samsung Galaxy S series (punch-hole camera, centered)
  'Galaxy S25 Ultra': { top: 0, right: 16, bottom: 0, left: 16 },
  'Galaxy S25+': { top: 0, right: 16, bottom: 0, left: 16 },
  'Galaxy S25': { top: 0, right: 16, bottom: 0, left: 16 },
  'Galaxy S24 Ultra': { top: 0, right: 16, bottom: 0, left: 16 },
  'Galaxy S24+': { top: 0, right: 16, bottom: 0, left: 16 },
  'Galaxy S24': { top: 0, right: 16, bottom: 0, left: 16 },
  'Galaxy S23 Ultra': { top: 0, right: 16, bottom: 0, left: 16 },
  'Galaxy S23+': { top: 0, right: 16, bottom: 0, left: 16 },
  'Galaxy S23': { top: 0, right: 16, bottom: 0, left: 16 },
}

// Screen dimension signatures for detection (viewport width x height in portrait)
// Used as secondary signal when UA parsing is ambiguous
const SCREEN_SIGNATURES: Record<string, string> = {
  // iPhone 16 Pro Max: 440x956
  '440x956': 'iPhone 16 Pro Max',
  // iPhone 16 Pro: 402x874
  '402x874': 'iPhone 16 Pro',
  // iPhone 16/15/15 Pro/14 Pro: 393x852
  '393x852': 'iPhone 16',
  // iPhone 16 Plus/15 Plus/15 Pro Max/14 Pro Max: 430x932
  '430x932': 'iPhone 16 Plus',
  // iPhone 14/13/12: 390x844
  '390x844': 'iPhone 14',
  // iPhone 14 Plus/13 Pro Max/12 Pro Max: 428x926
  '428x926': 'iPhone 14 Plus',
  // iPhone 11 Pro Max/XS Max: 414x896 @3x
  '414x896': 'iPhone 11 Pro Max',
  // iPhone 12/13 mini: 375x812
  '375x812': 'iPhone 13 mini',
  // iPhone SE 3/2, iPhone 8/7/6s: 375x667
  '375x667': 'iPhone SE',
  
  // Android - use viewport widths as hints
  '412x923': 'Pixel 10',
  '414x921': 'Pixel 9 Pro XL',
  '410x914': 'Pixel 9 Pro',
  '412x915': 'Pixel 8',
  '412x891': 'Galaxy S24 Ultra',
  '360x780': 'Galaxy S24',
}

/**
 * Parse user agent to extract device model
 */
function parseUserAgent(): string | null {
  const ua = navigator.userAgent
  
  // iOS: Look for iPhone model
  // Example: "iPhone14,3" = iPhone 13 Pro Max
  const iphoneMatch = ua.match(/iPhone\d+,\d+/)
  if (iphoneMatch) {
    // Map iPhone identifiers to names
    const iphoneModels: Record<string, string> = {
      // iPhone 16 series
      'iPhone17,1': 'iPhone 16 Pro',
      'iPhone17,2': 'iPhone 16 Pro Max',
      'iPhone17,3': 'iPhone 16',
      'iPhone17,4': 'iPhone 16 Plus',
      // iPhone 15 series
      'iPhone16,1': 'iPhone 15 Pro',
      'iPhone16,2': 'iPhone 15 Pro Max',
      'iPhone15,4': 'iPhone 15',
      'iPhone15,5': 'iPhone 15 Plus',
      // iPhone 14 series
      'iPhone15,2': 'iPhone 14 Pro',
      'iPhone15,3': 'iPhone 14 Pro Max',
      'iPhone14,7': 'iPhone 14',
      'iPhone14,8': 'iPhone 14 Plus',
      // iPhone 13 series
      'iPhone14,2': 'iPhone 13 Pro',
      'iPhone14,3': 'iPhone 13 Pro Max',
      'iPhone14,5': 'iPhone 13',
      'iPhone14,4': 'iPhone 13 mini',
      // iPhone 12 series
      'iPhone13,1': 'iPhone 12 mini',
      'iPhone13,2': 'iPhone 12',
      'iPhone13,3': 'iPhone 12 Pro',
      'iPhone13,4': 'iPhone 12 Pro Max',
      // iPhone 11 series
      'iPhone12,1': 'iPhone 11',
      'iPhone12,3': 'iPhone 11 Pro',
      'iPhone12,5': 'iPhone 11 Pro Max',
      // iPhone X series
      'iPhone11,2': 'iPhone XS',
      'iPhone11,4': 'iPhone XS Max',
      'iPhone11,6': 'iPhone XS Max',
      'iPhone11,8': 'iPhone XR',
      'iPhone10,3': 'iPhone X',
      'iPhone10,6': 'iPhone X',
      // iPhone SE
      'iPhone14,6': 'iPhone SE',
      'iPhone12,8': 'iPhone SE',
      // iPhone 8
      'iPhone10,1': 'iPhone 8',
      'iPhone10,4': 'iPhone 8',
      'iPhone10,2': 'iPhone 8 Plus',
      'iPhone10,5': 'iPhone 8 Plus',
    }
    return iphoneModels[iphoneMatch[0]] || null
  }
  
  // Generic iPhone detection by screen size
  if (/iPhone/.test(ua)) {
    const sig = `${window.screen.width}x${window.screen.height}`
    const altSig = `${window.screen.height}x${window.screen.width}` // Might be in landscape
    return SCREEN_SIGNATURES[sig] || SCREEN_SIGNATURES[altSig] || null
  }
  
  // Android: Look for Pixel or Galaxy
  if (/Pixel \d+/.test(ua)) {
    const pixelMatch = ua.match(/Pixel (\d+)( Pro)?( XL)?/i)
    if (pixelMatch) {
      const num = pixelMatch[1]
      const pro = pixelMatch[2] ? ' Pro' : ''
      const xl = pixelMatch[3] ? ' XL' : ''
      return `Pixel ${num}${pro}${xl}`
    }
  }
  
  if (/SM-S9\d\d|Galaxy S2[345]/i.test(ua)) {
    // Samsung Galaxy S series
    if (/SM-S928|S25 Ultra/i.test(ua)) return 'Galaxy S25 Ultra'
    if (/SM-S926|S25\+/i.test(ua)) return 'Galaxy S25+'
    if (/SM-S921|Galaxy S25(?! )/i.test(ua)) return 'Galaxy S25'
    if (/SM-S928|S24 Ultra/i.test(ua)) return 'Galaxy S24 Ultra'
    if (/SM-S926|S24\+/i.test(ua)) return 'Galaxy S24+'
    if (/SM-S921|Galaxy S24(?! )/i.test(ua)) return 'Galaxy S24'
    if (/SM-S918|S23 Ultra/i.test(ua)) return 'Galaxy S23 Ultra'
    if (/SM-S916|S23\+/i.test(ua)) return 'Galaxy S23+'
    if (/SM-S911|Galaxy S23(?! )/i.test(ua)) return 'Galaxy S23'
  }
  
  return null
}

/**
 * Get CSS env() safe area values (fallback)
 */
function getCSSEnvInsets(): SafeAreaInsets {
  const root = document.documentElement
  const style = getComputedStyle(root)
  
  const parse = (prop: string): number => {
    const value = style.getPropertyValue(prop).trim()
    return parseInt(value, 10) || 0
  }
  
  return {
    top: parse('env(safe-area-inset-top)'),
    right: parse('env(safe-area-inset-right)'),
    bottom: parse('env(safe-area-inset-bottom)'),
    left: parse('env(safe-area-inset-left)'),
  }
}

/**
 * Detect device and return appropriate safe area insets
 */
export function getDeviceSafeAreas(): DeviceInfo {
  const deviceName = parseUserAgent()
  
  // Check known devices
  if (deviceName) {
    const iphoneInsets = IPHONE_DEVICES[deviceName]
    if (iphoneInsets) {
      return { name: deviceName, insets: iphoneInsets, isKnown: true }
    }
    
    const androidInsets = ANDROID_DEVICES[deviceName]
    if (androidInsets) {
      return { name: deviceName, insets: androidInsets, isKnown: true }
    }
  }
  
  // Try screen signature
  const sig = `${Math.min(window.screen.width, window.screen.height)}x${Math.max(window.screen.width, window.screen.height)}`
  const sigDevice = SCREEN_SIGNATURES[sig]
  if (sigDevice) {
    const insets = IPHONE_DEVICES[sigDevice] || ANDROID_DEVICES[sigDevice]
    if (insets) {
      return { name: sigDevice, insets, isKnown: true }
    }
  }
  
  // Unknown device - use CSS env() as fallback
  const envInsets = getCSSEnvInsets()
  
  // If CSS env() returns zeros but we're on a mobile device, use conservative defaults
  const isMobileUA = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  if (isMobileUA && envInsets.left === 0 && envInsets.right === 0) {
    // Conservative fallback for unknown mobile devices
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
    if (isIOS) {
      // Assume notched iPhone
      return {
        name: 'Unknown iPhone',
        insets: { top: 0, right: 47, bottom: 21, left: 47 },
        isKnown: false,
      }
    } else {
      // Android with punch-hole - minimal insets
      return {
        name: 'Unknown Android',
        insets: { top: 0, right: 16, bottom: 0, left: 16 },
        isKnown: false,
      }
    }
  }
  
  return {
    name: deviceName || 'Unknown',
    insets: envInsets,
    isKnown: false,
  }
}

/**
 * Get safe area insets as CSS custom properties string
 */
export function getSafeAreaCSSVars(): string {
  const { insets } = getDeviceSafeAreas()
  return `
    --device-safe-top: ${insets.top}px;
    --device-safe-right: ${insets.right}px;
    --device-safe-bottom: ${insets.bottom}px;
    --device-safe-left: ${insets.left}px;
  `
}

/**
 * Apply safe area insets as CSS custom properties to document root
 */
export function applySafeAreaCSSVars(): DeviceInfo {
  const info = getDeviceSafeAreas()
  const root = document.documentElement
  
  root.style.setProperty('--device-safe-top', `${info.insets.top}px`)
  root.style.setProperty('--device-safe-right', `${info.insets.right}px`)
  root.style.setProperty('--device-safe-bottom', `${info.insets.bottom}px`)
  root.style.setProperty('--device-safe-left', `${info.insets.left}px`)
  
  console.log(`[SafeArea] Device: ${info.name} (${info.isKnown ? 'known' : 'fallback'})`, info.insets)
  
  return info
}
