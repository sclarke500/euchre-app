<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useChatStore } from '@/stores/chatStore'

const props = defineProps<{
  show: boolean
  playerNames?: string[]
}>()

const emit = defineEmits<{
  close: []
}>()

const chatStore = useChatStore()
const messagesRef = ref<HTMLElement | null>(null)

// Mark as read when panel opens
watch(() => props.show, (isOpen) => {
  if (isOpen) {
    chatStore.markAsRead()
    // Scroll to bottom when opening
    nextTick(() => {
      if (messagesRef.value) {
        messagesRef.value.scrollTop = messagesRef.value.scrollHeight
      }
    })
  }
})

// Auto-scroll on new messages when panel is open
watch(() => chatStore.messages.length, () => {
  if (props.show) {
    nextTick(() => {
      if (messagesRef.value) {
        messagesRef.value.scrollTop = messagesRef.value.scrollHeight
      }
    })
  }
})

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="panel">
      <div
        v-if="show"
        class="chat-panel-overlay"
        @click="handleBackdropClick"
      >
        <div class="chat-panel">
          <div class="panel-header">
            <h3>Chat</h3>
            <button class="close-btn" @click="$emit('close')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div ref="messagesRef" class="messages-container">
            <div v-if="chatStore.messages.length === 0" class="empty-state">
              No messages yet
            </div>
            <div
              v-for="msg in chatStore.messages"
              :key="msg.id"
              class="message"
            >
              <span class="message-name">{{ msg.playerName }}</span>
              <span class="message-text">{{ msg.text }}</span>
              <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.chat-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: stretch;
}

.chat-panel {
  width: 280px;
  max-width: 85vw;
  height: 100%;
  background: linear-gradient(
    180deg,
    rgba(35, 38, 48, 0.98) 0%,
    rgba(25, 28, 35, 0.99) 100%
  );
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.4);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  
  h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: white;
  }
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }
  
  svg {
    width: 18px;
    height: 18px;
  }
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.875rem;
}

.message {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.message-name {
  font-weight: 600;
  font-size: 0.8125rem;
  color: var(--color-primary-light, #14919b);
}

.message-text {
  flex: 1;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.9);
  word-break: break-word;
}

.message-time {
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.4);
  margin-left: auto;
}

// Slide-in animation
.panel-enter-active {
  transition: opacity 0.2s ease;
  
  .chat-panel {
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
}

.panel-leave-active {
  transition: opacity 0.15s ease;
  
  .chat-panel {
    transition: transform 0.15s ease-in;
  }
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  
  .chat-panel {
    transform: translateX(-100%);
  }
}
</style>
