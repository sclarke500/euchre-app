import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/styles/main.scss'
import { installConsoleCapture } from './utils/consoleCapture'
import { initDeviceMode } from './utils/deviceMode'
import { applySafeAreaCSSVars } from './utils/deviceSafeAreas'
import { initAppUpdates } from './composables/useAppUpdates'

// Install console capture early (before any logging)
installConsoleCapture()

// Initialize device mode (sets global CSS classes and card sizing vars)
initDeviceMode()

// Set safe area CSS vars for overlays outside ScaledContainer
applySafeAreaCSSVars()
// Re-apply on rotation: cutout insets swap sides at 180°, and the vars are
// otherwise a launch-time snapshot. The delayed second pass catches the
// native --android-safe-* injection landing after the resize event.
window.addEventListener('resize', () => {
  applySafeAreaCSSVars()
  setTimeout(applySafeAreaCSSVars, 250)
})

// Updates: registers the service worker on web (prompt mode); on native,
// notifyAppReady (required by Capgo or it rolls the bundle back) + silent OTA check
initAppUpdates()

// Log build version
const buildDate = new Date(__BUILD_TIME__)
const buildInfo = buildDate.toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
console.log(`🃏 67cardgames.com | v${__APP_VERSION__} | Build: ${buildInfo}`)

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')
