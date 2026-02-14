<template>
  <Modal :show="show" @close="$emit('close')">
    <div class="bug-modal">
      <div class="bug-title">Bug Report</div>
      <div class="bug-subtitle">Describe what happened and we'll capture a snapshot.</div>

      <textarea
        v-model="description"
        class="bug-textarea"
        rows="4"
        placeholder="What happened? What did you expect?"
      />

      <div class="bug-actions">
        <button class="action-btn primary" :disabled="sending" @click="handleSend">
          {{ sending ? 'Sending...' : 'Send Report' }}
        </button>
        <button class="action-btn" @click="handleCopy">Copy</button>
        <button class="action-btn" @click="handleDownload">Download</button>
        <button v-if="showResync" class="action-btn" @click="$emit('resync')">Resync</button>
        <button class="action-btn" @click="$emit('close')">Close</button>
      </div>

      <div v-if="status" class="bug-status" :class="{ success: status.includes('Sent') || status.includes('Copied') }">
        {{ status }}
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from './Modal.vue'
import { sendBugReport } from '@/services/autoBugReport'

const props = defineProps<{
  show: boolean
  gameType: string
  buildPayload: () => Record<string, unknown>
  showResync?: boolean
}>()

const emit = defineEmits<{
  close: []
  resync: []
}>()

const description = ref('')
const status = ref('')
const sending = ref(false)

// Reset state when modal opens
watch(() => props.show, (isOpen) => {
  if (isOpen) {
    status.value = ''
  }
})

function getFullPayload() {
  return {
    ...props.buildPayload(),
    gameType: props.gameType,
    description: description.value.trim(),
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
  }
}

async function handleSend() {
  if (sending.value) return
  sending.value = true
  status.value = 'Sending...'
  
  try {
    const payload = getFullPayload()
    await sendBugReport({
      ...payload,
      reportType: 'user',
      userDescription: description.value.trim() || 'No description provided',
    })
    status.value = 'Sent! Thanks for the report.'
    setTimeout(() => {
      status.value = ''
      emit('close')
    }, 2000)
  } catch (err) {
    console.error('Failed to send report:', err)
    status.value = 'Send failed. Try copying instead.'
  } finally {
    sending.value = false
  }
}

async function handleCopy() {
  try {
    const payload = getFullPayload()
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    status.value = 'Copied to clipboard!'
    setTimeout(() => { status.value = '' }, 1500)
  } catch (err) {
    console.error('Failed to copy:', err)
    status.value = 'Copy failed (see console).'
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
  status.value = 'Downloaded!'
  setTimeout(() => { status.value = '' }, 1500)
}
</script>

<style scoped lang="scss">
.bug-modal {
  min-width: 280px;
  max-width: 90vw;
}

.bug-title {
  font-size: 1.25rem;
  font-weight: bold;
  margin-bottom: 4px;
  color: #fff;
}

.bug-subtitle {
  color: #aaa;
  font-size: 0.875rem;
  margin-bottom: 12px;
}

.bug-textarea {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid #444;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  resize: vertical;
  margin-bottom: 12px;
  font-family: inherit;
  font-size: 0.9rem;
  
  &::placeholder {
    color: #666;
  }
}

.bug-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.bug-status {
  margin-top: 10px;
  font-size: 0.875rem;
  color: #aaa;
  
  &.success {
    color: #4CAF50;
  }
}

.action-btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &.primary {
    background: linear-gradient(135deg, #d4a84b 0%, #b8942f 100%);
    color: #1a1a1a;
    
    &:hover {
      background: linear-gradient(135deg, #e0b555 0%, #c9a340 100%);
    }
  }
}
</style>
