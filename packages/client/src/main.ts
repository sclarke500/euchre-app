import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/styles/main.scss'

// Log build version
const buildDate = new Date(__BUILD_TIME__)
const buildInfo = buildDate.toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
console.log(`🃏 67cardgames.com | Build: ${buildInfo}`)

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
