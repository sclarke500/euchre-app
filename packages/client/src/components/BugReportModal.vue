<template>
  <Modal :show="show" @close="$emit('close')">
    <div class="dialog-panel bug-modal">
      <h2 class="dialog-title">🐛 Bug Report</h2>
      <p class="dialog-text">Describe what went wrong. We'll capture a game snapshot automatically.</p>

      <textarea
        v-model="description"
        class="bug-textarea"
        rows="4"
        placeholder="What happened? What did you expect to happen?"
      />

      <div class="bug-info">
        <span class="info-item">{{ gameType }}</span>
        <span class="info-item">{{ mode === 'multiplayer' ? 'Multiplayer' : 'Single Player' }}</span>
      </div>

      <div class="dialog-actions bug-actions">
        <button class="dialog-btn dialog-btn--primary" :disabled="sending" @click="handleSend">
          {{ sending ? 'Sending...' : 'Send Report' }}
        </button>
        <button class="dialog-btn dialog-btn--muted" @click="$emit('close')">Cancel</button>
      </div>

      <div class="bug-secondary-actions">
        <button class="link-btn" @click="handleCopy">Copy to clipboard</button>
        <span class="divider">•</span>
        <button class="link-btn" @click="handleDownload">Download JSON</button>
        <template v-if="showResync">
          <span class="divider">•</span>
          <button class="link-btn" @click="$emit('resync')">Resync game</button>
        </template>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from './Modal.vue'
import { sendBugReport } from '@/services/autoBugReport'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  show: boolean
  gameType: string
  mode?: 'singleplayer' | 'multiplayer'
  buildPayload: () => Record<string, unknown>
  showResync?: boolean
}>()

const emit = defineEmits<{
  close: []
  resync: []
}>()

const toast = useToast()
const description = ref('')
const sending = ref(false)

// Reset state when modal opens
watch(() => props.show, (isOpen) => {
  if (isOpen) {
    description.value = ''
  }
})

function getFullPayload() {
  return {
    ...props.buildPayload(),
    gameType: props.gameType,
    mode: props.mode ?? 'singleplayer',
    description: description.value.trim(),
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
  }
}

async function handleSend() {
  if (sending.value) return
  sending.value = true
  
  try {
    const payload = getFullPayload()
    await sendBugReport({
      ...payload,
      reportType: 'user',
      userDescription: description.value.trim() || 'No description provided',
    })
    emit('close')
    toast.show('Thanks! Bug report sent.', 'success')
  } catch (err) {
    console.error('Failed to send report:', err)
    toast.show('Send failed. Try copying instead.', 'error')
  } finally {
    sending.value = false
  }
}

async function handleCopy() {
  try {
    const payload = getFullPayload()
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    toast.show('Copied to clipboard!', 'success')
  } catch (err) {
    console.error('Failed to copy:', err)
    toast.show('Copy failed', 'error')
  }
}

function handleDownload() {
  const payload = getFullPayload()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.gameType}-bug-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  toast.show('Downloaded!', 'success')
}
</script>

<style scoped lang="scss">
.bug-modal {
  min-width: 320px;
  max-width: 400px;
}

.bug-textarea {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  resize: vertical;
  margin-bottom: 12px;
  font-family: inherit;
  font-size: 0.9rem;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
  
  &:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.25);
  }
}

.bug-info {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  
  .info-item {
    text-transform: capitalize;
  }
}

.bug-actions {
  margin-bottom: 12px;
}

.bug-secondary-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.link-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 4px;
  
  &:hover {
    color: rgba(255, 255, 255, 0.8);
  }
}

.divider {
  color: rgba(255, 255, 255, 0.2);
  font-size: 0.6rem;
}
</style>
