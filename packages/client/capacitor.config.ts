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
}

export default config
