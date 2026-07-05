import { ref, readonly } from 'vue'
import { Capacitor } from '@capacitor/core'

/**
 * App update checking/applying, unified across platforms:
 *
 * - Web/PWA: service worker in 'prompt' mode (vite-plugin-pwa). We register
 *   the SW here (not auto-injected) so the native shells never run it —
 *   on Android the WebView serves from https://localhost where a SW *would*
 *   register and its precache would fight the Capgo OTA bundle swapper.
 *
 * - Native (iOS/Android): Capgo updater in manual mode. We GET a static
 *   manifest (ota/latest.json), compare against the version baked into this
 *   bundle (__APP_VERSION__), and let the plugin download + swap. Downloaded
 *   updates are queued via next() so they apply on the following launch even
 *   if the user never taps "Restart".
 *
 * State machine (shared by both backends):
 *   idle → checking → up-to-date (reverts to idle after a few seconds)
 *                   → downloading → ready --applyUpdate()--> restart
 *                   → error (reverts to idle)
 */

export type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'up-to-date' | 'ready' | 'error'

const OTA_MANIFEST_URL = 'https://67cardgames.com/ota/latest.json'
/** How long "up to date" / "error" linger on the button before reverting */
const REVERT_MS = 4000

interface OtaManifest {
  version: string
  url: string
}

const status = ref<UpdateStatus>('idle')
const errorMessage = ref('')

// Web backend handles
let swRegistration: ServiceWorkerRegistration | null = null
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null
// Native backend handle: bundle downloaded and queued for next launch
let pendingBundleId: string | null = null

let revertTimer: ReturnType<typeof setTimeout> | null = null
let initialized = false

function settle(result: 'up-to-date' | 'error', message = '') {
  status.value = result
  errorMessage.value = message
  if (revertTimer) clearTimeout(revertTimer)
  revertTimer = setTimeout(() => {
    if (status.value === result) status.value = 'idle'
  }, REVERT_MS)
}

// ---------------------------------------------------------------------------
// Web (service worker) backend
// ---------------------------------------------------------------------------

async function initWeb() {
  if (!('serviceWorker' in navigator)) return
  const { registerSW } = await import('virtual:pwa-register')
  updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      swRegistration = registration ?? null
    },
    onNeedRefresh() {
      // New SW installed and waiting — surfaced as "Restart to Update"
      status.value = 'ready'
    },
  })
}

async function checkWeb() {
  if (!swRegistration) {
    // SW never registered (dev server, unsupported browser)
    settle('error', 'Updates unavailable here')
    return
  }
  try {
    await swRegistration.update()
  } catch {
    settle('error', 'Check failed — are you offline?')
    return
  }
  if (swRegistration.waiting) {
    status.value = 'ready'
    return
  }
  if (swRegistration.installing) {
    // Found one; onNeedRefresh flips us to 'ready' when it finishes installing
    status.value = 'downloading'
    return
  }
  settle('up-to-date')
}

// ---------------------------------------------------------------------------
// Native (Capgo) backend
// ---------------------------------------------------------------------------

function isNewerVersion(remote: string, local: string): boolean {
  const r = remote.split('.').map(Number)
  const l = local.split('.').map(Number)
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const a = r[i] ?? 0
    const b = l[i] ?? 0
    if (a !== b) return a > b
  }
  return false
}

async function checkNative() {
  if (pendingBundleId) {
    // Already downloaded and queued this session
    status.value = 'ready'
    return
  }
  let manifest: OtaManifest
  try {
    const res = await fetch(OTA_MANIFEST_URL, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    manifest = await res.json()
  } catch {
    settle('error', 'Check failed — are you offline?')
    return
  }

  if (!manifest?.version || !manifest?.url || !isNewerVersion(manifest.version, __APP_VERSION__)) {
    settle('up-to-date')
    return
  }

  status.value = 'downloading'
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    const bundle = await CapacitorUpdater.download({ url: manifest.url, version: manifest.version })
    // Queue for next launch — the update lands even if "Restart" is ignored
    await CapacitorUpdater.next({ id: bundle.id })
    pendingBundleId = bundle.id
    status.value = 'ready'
  } catch (e) {
    console.warn('[updates] OTA download failed', e)
    settle('error', 'Download failed')
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Background check: never leaves an error state showing in Settings,
 *  and never interrupts a button-initiated check. */
async function silentNativeCheck() {
  if (status.value === 'checking' || status.value === 'downloading') return
  await checkNative()
  if (status.value === 'error') status.value = 'idle'
}

/** Don't re-check on every foreground — a game gets resumed constantly. */
const RESUME_CHECK_MIN_MS = 30 * 60 * 1000
let lastSilentCheck = 0

/** Call once at startup (main.ts). Registers the SW on web; on native calls
 *  notifyAppReady (required — skipping it makes Capgo roll back the bundle)
 *  and runs silent background checks on launch and app-resume. */
export function initAppUpdates() {
  if (initialized) return
  initialized = true

  if (Capacitor.isNativePlatform()) {
    ;(async () => {
      try {
        const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
        await CapacitorUpdater.notifyAppReady()
      } catch (e) {
        console.warn('[updates] notifyAppReady failed', e)
      }
      // Silent launch check, after the app has settled
      setTimeout(() => {
        lastSilentCheck = Date.now()
        silentNativeCheck()
      }, 3000)
      // Re-check when the app returns to foreground — mobile apps get
      // suspended for days and rarely cold-launch, so launch-only checks
      // would leave long-running installs behind.
      const { App } = await import('@capacitor/app')
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive && Date.now() - lastSilentCheck > RESUME_CHECK_MIN_MS) {
          lastSilentCheck = Date.now()
          silentNativeCheck()
        }
      })
    })()
  } else {
    initWeb()
  }
}

/** "Check for Updates" button. */
export async function checkForUpdates() {
  if (status.value === 'checking' || status.value === 'downloading') return
  if (status.value === 'ready') return // nothing to re-check; restart applies it
  status.value = 'checking'
  errorMessage.value = ''
  if (Capacitor.isNativePlatform()) await checkNative()
  else await checkWeb()
}

/** "Restart to Update" button — activates the downloaded update now. */
export async function applyUpdate() {
  if (status.value !== 'ready') return
  if (Capacitor.isNativePlatform()) {
    if (!pendingBundleId) return
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    // Swaps to the new bundle and reloads the WebView. No code after this runs.
    await CapacitorUpdater.set({ id: pendingBundleId })
  } else {
    // Activates the waiting SW and reloads the page
    await updateSW?.(true)
  }
}

export function useAppUpdates() {
  return {
    updateStatus: readonly(status),
    updateError: readonly(errorMessage),
    appVersion: __APP_VERSION__,
    checkForUpdates,
    applyUpdate,
  }
}
