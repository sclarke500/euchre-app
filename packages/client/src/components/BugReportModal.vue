<template>
  <Modal :show="show" @close="$emit('close')">
    <div class="bug-modal">
      <div class="modal-header">
        <h2>Bug Report</h2>
        <button class="close-btn" @click="$emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div class="modal-body">
        <p class="help-text">Describe what went wrong. We'll capture a game snapshot automatically.</p>

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
      </div>

      <div class="modal-footer">
        <div class="secondary-actions">
          <button class="link-btn" @click="handleCopy">Copy</button>
          <button class="link-btn" @click="handleDownload">Download</button>
          <button v-if="showResync" class="link-btn" @click="$emit('resync')">Resync</button>
        </div>
        <div class="primary-actions">
          <button class="btn-secondary" @click="$emit('close')">Cancel</button>
          <button class="btn-primary" :disabled="sending" @click="handleSend">
            {{ sending ? 'Sending...' : 'Send Report' }}
          </button>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from './Modal.vue'
import { sendBugReport } from '@/services/autoBugReport'
import { useToast } from '@/composables/useToast'
import { getRecentLogs } from '@/utils/consoleCapture'

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

function getFullPayload(logCount: number = 50) {
  return {
    ...props.buildPayload(),
    gameType: props.gameType,
    mode: props.mode ?? 'singleplayer',
    description: description.value.trim(),
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    consoleLogs: getRecentLogs(logCount),
  }
}

async function handleSend() {
  if (sending.value) return
  sending.value = true
  
  try {
    const payload = getFullPayload(50) // More logs for GitHub issues
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
    const payload = getFullPayload(15) // Fewer logs for clipboard (Telegram paste limits)
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
  background: linear-gradient(135deg, $home-gradient-top 0%, $home-gradient-bottom 100%);
  border-radius: 16px;
  min-width: 320px;
  max-width: 420px;
  width: 100%;
  color: white;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 6px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  svg {
    width: 1.25rem;
    height: 1.25rem;
  }
}

.modal-body {
  padding: 1.5rem;
}

.help-text {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
}

.bug-textarea {
  width: 100%;
  padding: 0.75rem;
  font-size: 0.9375rem;
  color: white;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  resize: vertical;
  min-height: 100px;
  margin-bottom: 0.75rem;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
  
  &:focus {
    outline: none;
    border-color: $brand-green;
    background: rgba(255, 255, 255, 0.15);
  }
}

.bug-info {
  display: flex;
  gap: 12px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  
  .info-item {
    text-transform: capitalize;
  }
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
  border-radius: 0 0 16px 16px;
}

.secondary-actions {
  display: flex;
  gap: 0.75rem;
}

.link-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  
  &:hover {
    color: white;
    text-decoration: underline;
  }
}

.primary-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-primary {
  padding: 0.625rem 1.25rem;
  font-size: 0.9375rem;
  font-weight: 500;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  background: $brand-green;
  color: white;
  
  &:hover:not(:disabled) {
    background: $brand-green-light;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-secondary {
  padding: 0.625rem 1.25rem;
  font-size: 0.9375rem;
  font-weight: 500;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  
  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }
}
</style>
