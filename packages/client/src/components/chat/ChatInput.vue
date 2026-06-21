<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useChatStore } from '@/stores/chatStore'
import { CHAT_MAX_LENGTH } from '@67cards/shared'
import { ENABLE_FREE_TEXT_CHAT } from '@/config/chat'

const chatStore = useChatStore()

const inputText = ref('')
const showQuickReacts = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const quickReacts = [
  { emoji: '👍', text: '👍' },
  { emoji: '😂', text: '😂' },
  { emoji: '🎉', text: 'Nice!' },
  { emoji: '😅', text: 'Oops' },
  { emoji: '🤔', text: '🤔' },
  { emoji: '👋', text: 'GG' },
]

const canSubmit = computed(() => {
  return inputText.value.trim().length > 0 && chatStore.canSend()
})

function handleSubmit() {
  if (!canSubmit.value) return
  
  const sent = chatStore.sendChatMessage(inputText.value)
  if (sent) {
    inputText.value = ''
    // Blur input to dismiss mobile keyboard
    inputRef.value?.blur()
  }
}

function handleQuickReact(react: { emoji: string; text: string }) {
  // Send emoji + text together (e.g. "🎉 Nice!" not just "Nice!")
  const message = react.emoji === react.text ? react.emoji : `${react.emoji} ${react.text}`
  chatStore.sendChatMessage(message, true)
  showQuickReacts.value = false
}

function toggleQuickReacts() {
  showQuickReacts.value = !showQuickReacts.value
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.quick-reacts-container')) {
    showQuickReacts.value = false
  }
}
</script>

<template>
  <div class="chat-input-container" @click.stop>
    <div class="chat-input-wrapper">
      <input
        v-if="ENABLE_FREE_TEXT_CHAT"
        ref="inputRef"
        v-model="inputText"
        type="text"
        class="chat-input"
        placeholder="Type a message..."
        :maxlength="CHAT_MAX_LENGTH"
        :disabled="false"
        @keydown.enter.prevent="handleSubmit"
      />
      <span v-else class="reacts-label">React</span>
      <button
        class="quick-react-btn"
        :class="{ active: showQuickReacts }"
        @click="toggleQuickReacts"
        title="Quick reactions"
      >
        😊
      </button>
    </div>

    <!-- Quick reactions picker -->
    <Transition name="picker">
      <div
        v-if="showQuickReacts"
        class="quick-reacts-container"
        @click.stop
      >
        <button
          v-for="react in quickReacts"
          :key="react.text"
          class="quick-react-option"
          @click="handleQuickReact(react)"
        >
          {{ react.emoji }}<span v-if="react.text !== react.emoji" class="react-text">{{ react.text }}</span>
        </button>
      </div>
    </Transition>

    <!-- Click outside to close picker -->
    <Teleport to="body">
      <div
        v-if="showQuickReacts"
        class="picker-backdrop"
        @click="showQuickReacts = false"
      />
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.chat-input-container {
  position: absolute;
  bottom: 16px; // ScaledContainer handles safe areas now
  left: 16px;
  z-index: 400;
}

.chat-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(
    180deg,
    rgba(45, 48, 58, 0.5) 0%,
    rgba(28, 30, 38, 0.5) 100%
  );
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  padding: 6px 8px 6px 16px;
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.chat-input {
  width: 110px;
  background: transparent;
  border: none;
  outline: none;
  color: rgba(255, 255, 255, 0.95);
  font-size: 14px;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
  
  &:disabled {
    opacity: 0.5;
  }
  
  @media (max-width: 480px) {
    width: 85px;
    font-size: 13px;
  }
}

.reacts-label {
  color: rgba(255, 255, 255, 0.55);
  font-size: $ui-sm;
  letter-spacing: 0.02em;
  padding-right: 2px;
  user-select: none;
}

.quick-react-btn {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  font-size: $ui-lg;
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.1s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &.active {
    background: rgba(255, 255, 255, 0.25);
  }
}

.quick-reacts-container {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 8px;
  display: flex;
  gap: 6px;
  padding: 10px;
  background: linear-gradient(
    180deg,
    rgba(45, 48, 58, 0.95) 0%,
    rgba(28, 30, 38, 0.98) 100%
  );
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.quick-react-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 14px;
  color: rgba(255, 255, 255, 0.9);
  font-size: $ui-lg;
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.1s ease;
  white-space: nowrap;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  &:active {
    transform: scale(0.95);
  }

  .react-text {
    font-size: $ui-sm;
    color: rgba(255, 255, 255, 0.7);
  }
}

.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 399;
}

// Picker animation
.picker-enter-active,
.picker-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.picker-enter-from,
.picker-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.95);
}
</style>
