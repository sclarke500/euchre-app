import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Bundle/App ID — reverse-DNS, and no segment may start with a digit
  // (Android package names must be valid Java identifiers). The display name
  // below can still use "67".
  appId: 'com.sixsevencardgames.app',
  appName: '67 Card Games',
  // Vite builds the web app into packages/client/dist; Capacitor copies that
  // into the native iOS/Android shells on `cap sync`.
  webDir: 'dist',
  // All @capacitor/* packages must share the same major version (here: 7.x).
  plugins: {
    // OTA web-bundle updates (Capgo, self-hosted). Manual mode: useAppUpdates
    // fetches /ota/latest.json itself (static GET — no Capgo cloud, no update
    // server) and drives download()/next()/set(). The plugin still owns the
    // hard parts: atomic bundle swap + auto-rollback when a new bundle fails
    // to call notifyAppReady() within appReadyTimeout.
    CapacitorUpdater: {
      autoUpdate: false,
      // Disable Capgo cloud telemetry endpoints — we self-host.
      statsUrl: '',
      channelUrl: '',
    },
  },
}

export default config
