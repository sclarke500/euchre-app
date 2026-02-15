export type MultiplayerQueueController<T> = {
  enable: () => void
  disable: () => void
  enqueue: (message: T) => void
  dequeue: () => T | null
  length: () => number
  isEnabled: () => boolean
  clear: () => void
}

export function createMultiplayerQueueController<T>(
  applyMessage: (message: T) => void
): MultiplayerQueueController<T> {
  const queue: T[] = []
  let queueMode = false

  return {
    enable() {
      queueMode = true
    },

    disable() {
      queueMode = false
      while (queue.length > 0) {
        applyMessage(queue.shift()!)
      }
    },

    enqueue(message: T) {
      queue.push(message)
    },

    dequeue() {
      return queue.shift() ?? null
    },

    length() {
      return queue.length
    },

    isEnabled() {
      return queueMode
    },

    clear() {
      queue.length = 0
      queueMode = false
    },
  }
}