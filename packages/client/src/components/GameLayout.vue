<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ChatPanel from './chat/ChatPanel.vue'
import ChatIcon from './chat/ChatIcon.vue'

const props = withDefaults(defineProps<{
  showChat: boolean
  enableChat?: boolean
}>(), {
  enableChat: true,
})

const emit = defineEmits<{
  'update:showChat': [value: boolean]
}>()

// Viewport tracking
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)

function updateViewport() {
  viewportWidth.value = window.innerWidth
}

onMounted(() => {
  window.addEventListener('resize', updateViewport)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewport)
})

// Wide mode: >= 1350px, chat becomes sidebar
const isWideMode = computed(() => viewportWidth.value >= 1350)
const chatMode = computed(() => isWideMode.value ? 'sidebar' : 'overlay')

// Chat visibility
const chatVisible = computed({
  get: () => props.showChat,
  set: (val) => emit('update:showChat', val)
})

function toggleChat() {
  chatVisible.value = !chatVisible.value
}
</script>

<template>
  <div class="game-layout" :class="{ 'wide-mode': isWideMode, 'chat-open': chatVisible && isWideMode }">
    <!-- Sidebar chat (wide mode only) -->
    <aside v-if="enableChat && isWideMode" class="chat-sidebar" :class="{ open: chatVisible }">
      <ChatPanel
        v-if="chatVisible"
        :show="true"
        mode="sidebar"
        @close="chatVisible = false"
      />
    </aside>

    <!-- Main game area -->
    <main class="game-main">
      <!-- Chat toggle button (wide mode - fixed position) -->
      <div v-if="enableChat && isWideMode" class="chat-toggle-wide">
        <button class="toggle-btn" :class="{ active: chatVisible }" @click="toggleChat" title="Toggle chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>

      <!-- Chat icon (narrow mode - inside game area) -->
      <div v-if="enableChat && !isWideMode" class="chat-icon-wrapper">
        <ChatIcon @click="chatVisible = true" />
      </div>

      <!-- Game content slot -->
      <slot />

      <!-- Overlay chat (narrow mode only) -->
      <ChatPanel
        v-if="enableChat && !isWideMode"
        :show="chatVisible"
        mode="overlay"
        @close="chatVisible = false"
      />
    </main>
  </div>
</template>

<style scoped lang="scss">
.game-layout {
  width: 100%;
  height: 100%;
  display: flex;
  background: #0f0f18;
}

.game-main {
  flex: 1;
  min-width: 0;
  height: 100%;
  position: relative;
}

// Sidebar (wide mode)
.chat-sidebar {
  width: 0;
  height: 100%;
  overflow: hidden;
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  background: rgba(25, 28, 38, 0.95);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  
  &.open {
    width: 320px;
  }
}

// Chat toggle for wide mode
.chat-toggle-wide {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 100;
}

.toggle-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgba(0, 0, 0, 0.8);
    color: white;
  }
  
  &.active {
    background: var(--color-primary, #0d7377);
    color: white;
    border-color: var(--color-primary, #0d7377);
  }
  
  svg {
    width: 22px;
    height: 22px;
  }
}

// Chat icon wrapper (narrow mode)
.chat-icon-wrapper {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 100;
}
</style>
