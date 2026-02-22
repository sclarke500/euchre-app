<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useChatStore } from '@/stores/chatStore'
import { CHAT_MAX_LENGTH } from '@67cards/shared'

const props = withDefaults(defineProps<{
  show: boolean
  mode?: 'overlay' | 'sidebar'
}>(), {
  mode: 'overlay',
})

const emit = defineEmits<{
  close: []
}>()

const chatStore = useChatStore()
const messagesRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const inputText = ref('')
const showQuickReacts = ref(false)

const quickReacts = [
  { emoji: '👍' },
  { emoji: '😂' },
  { emoji: '🎉' },
  { emoji: '😅' },
  { emoji: '🤔' },
  { emoji: '👋' },
]

// Mark as read when panel opens
watch(() => props.show, (isOpen) => {
  if (isOpen) {
    chatStore.markAsRead()
    scrollToBottom()
    // Don't auto-focus input - causes keyboard to pop up on mobile
  }
})

// Auto-scroll on new messages when panel is open
watch(() => chatStore.messages.length, () => {
  if (props.show) {
    scrollToBottom()
  }
})

function scrollToBottom() {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}

const canSubmit = computed(() => {
  return inputText.value.trim().length > 0 && chatStore.canSend()
})

function handleSubmit() {
  if (!canSubmit.value) return
  
  const sent = chatStore.sendChatMessage(inputText.value)
  if (sent) {
    inputText.value = ''
    nextTick(() => inputRef.value?.focus())
  }
}

function handleQuickReact(emoji: string) {
  chatStore.sendChatMessage(emoji, true)
  showQuickReacts.value = false
}
</script>

<template>
  <!-- Overlay mode: teleport to body with backdrop -->
  <Teleport v-if="mode === 'overlay'" to="body">
    <Transition name="panel">
      <div
        v-if="show"
        class="chat-panel-overlay"
        @click="handleBackdropClick"
      >
        <div class="chat-panel overlay-panel">
          <div class="panel-header">
            <h3>Chat</h3>
            <button class="close-btn" @click="$emit('close')" title="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div ref="messagesRef" class="messages-container">
            <div v-if="chatStore.messages.length === 0" class="empty-state">
              <div class="empty-icon">💬</div>
              <span>No messages yet</span>
            </div>
            
            <div
              v-for="msg in chatStore.messages"
              :key="msg.id"
              class="message-row"
              :class="{ 'is-own': msg.seatIndex === 0 }"
            >
              <div class="message-bubble">
                <span v-if="msg.seatIndex !== 0" class="message-name">{{ msg.playerName }}</span>
                <span class="message-text">{{ msg.text.trim() }}</span>
              </div>
            </div>
          </div>
          
          <!-- Input area at bottom -->
          <div class="panel-input-area">
            <div class="input-row">
              <input
                ref="inputRef"
                v-model="inputText"
                type="text"
                class="panel-input"
                placeholder="Message..."
                :maxlength="CHAT_MAX_LENGTH"
                @keydown.enter.prevent="handleSubmit"
              />
              <button
                class="emoji-btn"
                :class="{ active: showQuickReacts }"
                @click="showQuickReacts = !showQuickReacts"
              >
                😊
              </button>
              <button
                class="send-btn"
                :disabled="!canSubmit"
                @click="handleSubmit"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
            
            <!-- Quick emoji picker -->
            <Transition name="picker">
              <div v-if="showQuickReacts" class="quick-picker">
                <button
                  v-for="react in quickReacts"
                  :key="react.emoji"
                  class="picker-emoji"
                  @click="handleQuickReact(react.emoji)"
                >
                  {{ react.emoji }}
                </button>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Sidebar mode: inline, no backdrop -->
  <div v-else-if="mode === 'sidebar'" class="chat-panel sidebar-panel">
    <div class="panel-header">
      <h3>Chat</h3>
      <button class="close-btn" @click="$emit('close')" title="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
    
    <div ref="messagesRef" class="messages-container">
      <div v-if="chatStore.messages.length === 0" class="empty-state">
        <div class="empty-icon">💬</div>
        <span>No messages yet</span>
      </div>
      
      <div
        v-for="msg in chatStore.messages"
        :key="msg.id"
        class="message-row"
        :class="{ 'is-own': msg.seatIndex === 0 }"
      >
        <div class="message-bubble">
          <span v-if="msg.seatIndex !== 0" class="message-name">{{ msg.playerName }}</span>
          <span class="message-text">{{ msg.text.trim() }}</span>
        </div>
      </div>
    </div>
    
    <!-- Input area at bottom -->
    <div class="panel-input-area">
      <div class="input-row">
        <input
          ref="inputRef"
          v-model="inputText"
          type="text"
          class="panel-input"
          placeholder="Message..."
          :maxlength="CHAT_MAX_LENGTH"
          @keydown.enter.prevent="handleSubmit"
        />
        <button
          class="emoji-btn"
          :class="{ active: showQuickReacts }"
          @click="showQuickReacts = !showQuickReacts"
        >
          😊
        </button>
        <button
          class="send-btn"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
      
      <!-- Quick emoji picker -->
      <Transition name="picker">
        <div v-if="showQuickReacts" class="quick-picker">
          <button
            v-for="react in quickReacts"
            :key="react.emoji"
            class="picker-emoji"
            @click="handleQuickReact(react.emoji)"
          >
            {{ react.emoji }}
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped lang="scss">
.chat-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: stretch;
  background: rgba(0, 0, 0, 0.3);
}

.chat-panel {
  height: 100%;
  background: rgba(25, 28, 38, 0.95);
  display: flex;
  flex-direction: column;
  
  // Overlay mode (inside teleport)
  &.overlay-panel {
    width: 300px;
    max-width: 85vw;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 4px 0 32px rgba(0, 0, 0, 0.5);
  }
  
  // Sidebar mode (inline)
  &.sidebar-panel {
    width: 100%;
    border-right: none;
    box-shadow: none;
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  
  h3 {
    margin: 0;
    font-size: 1.1rem;
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
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s ease;
  
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
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  
  // Subtle scrollbar
  &::-webkit-scrollbar {
    width: 5px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.25);
    }
  }
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.875rem;
  
  .empty-icon {
    font-size: 2rem;
    opacity: 0.5;
  }
}

// WhatsApp-style message bubbles
.message-row {
  display: flex;
  
  &.is-own {
    justify-content: flex-end;
    
    .message-bubble {
      background: linear-gradient(135deg, #0d7377 0%, #0a5f62 100%);
      border-radius: 18px 18px 4px 18px;
    }
  }
  
  &:not(.is-own) {
    justify-content: flex-start;
    
    .message-bubble {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 18px 18px 18px 4px;
    }
  }
}

.message-bubble {
  max-width: 80%;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.message-name {
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--color-primary-light, #14b8a6);
}

.message-text {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.95);
  word-break: break-word;
  line-height: 1.4;
}

// Input area at bottom
.panel-input-area {
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
}

.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 4px 4px 4px 16px;
}

.panel-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: rgba(255, 255, 255, 0.95);
  font-size: 14px;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
}

.emoji-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover, &.active {
    background: rgba(255, 255, 255, 0.1);
  }
}

.send-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary, #0d7377);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover:not(:disabled) {
    background: var(--color-primary-dark, #0a5f62);
  }
  
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  
  svg {
    width: 18px;
    height: 18px;
    margin-left: 2px;
  }
}

.quick-picker {
  display: flex;
  gap: 4px;
  padding: 10px 4px 4px;
  justify-content: center;
}

.picker-emoji {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: scale(1.1);
  }
  
  &:active {
    transform: scale(0.95);
  }
}

// Picker animation
.picker-enter-active,
.picker-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.picker-enter-from,
.picker-leave-to {
  opacity: 0;
  transform: translateY(8px);
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
