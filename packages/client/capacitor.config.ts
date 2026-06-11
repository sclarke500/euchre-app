import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.67cards.app',
  appName: '67 Card Games',
  // Vite builds the web app into packages/client/dist; Capacitor copies that
  // into the native iOS/Android shells on `cap sync`.
  webDir: 'dist',
  // All @capacitor/* packages must share the same major version (here: 7.x).
}

export default config
