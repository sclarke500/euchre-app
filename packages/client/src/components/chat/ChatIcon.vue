<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '@/stores/chatStore'

const chatStore = useChatStore()

defineEmits<{
  click: []
}>()

const hasUnread = computed(() => chatStore.unreadCount > 0)
</script>

<template>
  <button
    class="chat-icon-btn"
    :class="{ 'has-unread': hasUnread }"
    @click="$emit('click')"
    title="Chat history"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
    <span v-if="hasUnread" class="unread-dot" />
  </button>
</template>

<style scoped lang="scss">
.chat-icon-btn {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-dark-border);
  background: var(--color-dark-surface);
  color: var(--color-dark-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease, color 0.15s ease;
  
  &:hover {
    background: var(--color-dark-surface-elevated);
    color: var(--color-dark-text);
  }
  
  &.has-unread {
    color: var(--color-dark-text);
  }
  
  svg {
    width: 22px;
    height: 22px;
  }
}

.unread-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 10px;
  height: 10px;
  background: var(--color-danger);
  border-radius: 50%;
  border: 2px solid var(--color-dark-surface);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}
</style>
