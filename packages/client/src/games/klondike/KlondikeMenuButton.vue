<template>
  <div class="klondike-menu-button">
    <!-- Vertical ellipsis trigger -->
    <button class="menu-btn" title="Menu" aria-label="Menu" @click="open = !open">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="19" r="2" />
      </svg>
    </button>

    <Transition name="km-dropdown">
      <div v-if="open" class="km-dropdown" :class="direction">
        <button class="km-item" @click="select('back')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>
        <button class="km-item" @click="select('rules')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <path d="M8 7h8" />
            <path d="M8 11h8" />
            <path d="M8 15h4" />
          </svg>
          Game Rules
        </button>
        <button class="km-item" @click="select('bug')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
          Report Bug
        </button>
      </div>
    </Transition>

    <!-- Click-outside to close -->
    <div v-if="open" class="km-backdrop" @click="open = false" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

withDefaults(defineProps<{
  // 'down' for the top menu, 'up' for the bottom (mobile) menu
  direction?: 'down' | 'up'
}>(), { direction: 'down' })

const emit = defineEmits<{
  back: []
  rules: []
  bug: []
}>()

const open = ref(false)

function select(action: 'back' | 'rules' | 'bug') {
  open.value = false
  if (action === 'back') emit('back')
  else if (action === 'rules') emit('rules')
  else emit('bug')
}
</script>

<style scoped lang="scss">
.klondike-menu-button {
  position: relative;
}

// Match the existing Klondike .menu-btn appearance
.menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

.km-dropdown {
  position: absolute;
  left: 0;
  min-width: 168px;
  background: #2a2d35;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 20;

  &.down {
    top: calc(100% + 6px);
  }

  &.up {
    bottom: calc(100% + 6px);
  }
}

.km-item {
  width: 100%;
  padding: 12px 16px;
  background: none;
  border: none;
  color: white;
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
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
}

.km-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10;
}

.km-dropdown-enter-active,
.km-dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.km-dropdown-enter-from,
.km-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

// When opening upward, animate from below
.km-dropdown.up.km-dropdown-enter-from,
.km-dropdown.up.km-dropdown-leave-to {
  transform: translateY(8px);
}
</style>
