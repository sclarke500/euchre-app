import { Capacitor } from '@capacitor/core'

/**
 * True when running inside the native iOS/Android Capacitor shell
 * (as opposed to a browser tab or an installed PWA). Used to skip the
 * marketing landing page and suppress PWA install prompts in the native app.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}
