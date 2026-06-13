/**
 * Native orientation control.
 *
 * In the PWA/browser we cannot force device orientation, so the app shows a
 * "rotate your device" overlay for landscape-only screens. In the native
 * Capacitor app (iOS/Android) we can actually lock the orientation, so for
 * landscape-only screens we force landscape and skip the overlay.
 *
 * These helpers are no-ops on web (guarded by isNativeApp()), and the plugin is
 * dynamically imported so it never runs / loads in the browser build.
 */
import { isNativeApp } from './native'

export async function lockLandscape(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation')
    await ScreenOrientation.lock({ orientation: 'landscape' })
  } catch {
    // Orientation lock is best-effort; ignore failures (e.g. iPad multitasking).
  }
}

export async function unlockOrientation(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation')
    await ScreenOrientation.unlock()
  } catch {
    // Ignore — nothing to unlock or platform doesn't support it.
  }
}
