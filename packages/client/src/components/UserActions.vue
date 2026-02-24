<template>
  <Transition name="actions-fade">
    <div 
      v-if="hasContent" 
      class="user-actions" 
      :class="{ active }"
    >
      <div class="actions-content">
        <slot />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useSlots, computed } from 'vue'

defineProps<{
  active?: boolean
}>()

const slots = useSlots()
const hasContent = computed(() => !!slots.default)
</script>

<style scoped lang="scss">
.user-actions {
  position: fixed;
  bottom: 12px; // ScaledContainer handles safe areas now
  right: 12px;
  z-index: 600;
  // No background - floating buttons only

  &.active {
    // Subtle glow when it's user's turn
    filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.2));
  }
}

.actions-content {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

/* Transition */
.actions-fade-enter-active,
.actions-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.actions-fade-enter-from,
.actions-fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* Button styles for slotted content */
:slotted(.action-btn) {
  padding: 10px 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-dark-border);
  background: var(--color-dark-surface);
  backdrop-filter: blur(8px);
  color: var(--color-dark-text);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  box-shadow: var(--shadow-md);

  &:hover {
    background: var(--color-dark-surface-elevated);
    border-color: rgba(255, 255, 255, 0.2);
  }

  &:active {
    transform: scale(0.97);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.primary {
    background: var(--color-success);
    border-color: transparent;

    &:hover {
      background: var(--color-success-hover);
    }
  }

  &.danger {
    background: var(--color-danger);
    border-color: transparent;

    &:hover {
      background: var(--color-danger-hover);
    }
  }
}

:slotted(.action-select) {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(240, 240, 245, 0.95);
  color: $surface-800;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

:slotted(.action-checkbox) {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-dark-text-secondary);
  font-size: 13px;
  cursor: pointer;
  user-select: none;

  input {
    accent-color: var(--color-primary);
  }
}

:slotted(.action-divider) {
  width: 1px;
  height: 24px;
  background: var(--color-dark-border);
  margin: 0 4px;
}

:slotted(.action-label) {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}
</style>
