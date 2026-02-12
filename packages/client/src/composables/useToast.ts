import { ref, readonly } from 'vue'

interface Toast {
  message: string
  type: 'info' | 'error' | 'success'
}

const current = ref<Toast | null>(null)
let timeoutId: ReturnType<typeof setTimeout> | null = null

function show(message: string, type: Toast['type'] = 'info', durationMs = 6000) {
  if (timeoutId) clearTimeout(timeoutId)
  current.value = { message, type }
  timeoutId = setTimeout(() => {
    current.value = null
    timeoutId = null
  }, durationMs)
}

function dismiss() {
  if (timeoutId) clearTimeout(timeoutId)
  current.value = null
  timeoutId = null
}

export function useToast() {
  return {
    current: readonly(current),
    show,
    dismiss,
  }
}
