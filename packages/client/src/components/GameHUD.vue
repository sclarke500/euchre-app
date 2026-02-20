<template>
  <div class="game-hud">
    <!-- Three-dot menu button -->
    <button class="hud-btn menu-btn" @click="menuOpen = !menuOpen">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="19" r="2" />
      </svg>
    </button>

    <!-- Dropdown menu -->
    <Transition name="dropdown">
      <div v-if="menuOpen" class="menu-dropdown">
        <button class="menu-item" @click="handleLeave">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>
        <button class="menu-item" @click="handleRules">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <path d="M8 7h8" />
            <path d="M8 11h8" />
            <path d="M8 15h4" />
          </svg>
          Game Rules
        </button>
        <button class="menu-item" @click="handleBugReport">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
          Report Bug
        </button>
      </div>
    </Transition>

    <!-- Click outside to close -->
    <div v-if="menuOpen" class="menu-backdrop" @click="menuOpen = false" />

    <!-- Bug Report Modal -->
    <BugReportModal
      :show="showBugReport"
      :game-type="gameType"
      :mode="mode"
      :build-payload="buildPayload"
      :show-resync="showResync"
      @close="closeBugReport"
      @resync="$emit('resync')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BugReportModal from './BugReportModal.vue'

defineProps<{
  gameType: string
  mode?: 'singleplayer' | 'multiplayer'
  buildPayload: () => Record<string, unknown>
  showResync?: boolean
}>()

const emit = defineEmits<{
  leave: []
  resync: []
  rules: []
  'bug-report-open': []
  'bug-report-close': []
}>()

const menuOpen = ref(false)
const showBugReport = ref(false)

function handleLeave() {
  menuOpen.value = false
  emit('leave')
}

function handleBugReport() {
  menuOpen.value = false
  showBugReport.value = true
  emit('bug-report-open')
}

function closeBugReport() {
  showBugReport.value = false
  emit('bug-report-close')
}

function handleRules() {
  menuOpen.value = false
  emit('rules')
}
</script>

<style scoped lang="scss">
.game-hud {
  position: absolute;
  top: 10px;
  left: max(10px, env(safe-area-inset-left));
  z-index: 500;
}

.hud-btn {
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
  
  &:hover {
    background: var(--color-dark-surface-elevated);
  }
  
  svg {
    width: 24px;
    height: 24px;
  }
}

.menu-dropdown {
  position: absolute;
  top: 48px;
  left: 0;
  min-width: 160px;
  background: var(--color-dark-surface);
  border: 1px solid var(--color-dark-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  z-index: 600; // Above dealer chip (550)
}

.menu-item {
  width: 100%;
  padding: 12px 16px;
  background: none;
  border: none;
  color: var(--color-dark-text);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  
  svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  &:not(:last-child) {
    border-bottom: 1px solid var(--color-dark-border);
  }
}

.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
}

// Dropdown animation
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
