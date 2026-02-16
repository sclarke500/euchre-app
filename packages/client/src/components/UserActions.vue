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
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 500;
  padding: 12px 16px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  background: rgba(20, 20, 30, 0.85);
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  transition: background 0.2s ease, border-color 0.2s ease;

  &.active {
    background: rgba(40, 38, 20, 0.92);
    border-top-color: rgba(255, 215, 0, 0.3);
    box-shadow: 0 -4px 20px rgba(255, 215, 0, 0.1);
  }
}

.actions-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  max-width: 600px;
  margin: 0 auto;
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
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(60, 60, 80, 0.9);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  &:hover {
    background: rgba(80, 80, 100, 0.95);
    border-color: rgba(255, 255, 255, 0.3);
  }

  &:active {
    transform: scale(0.97);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.primary {
    background: rgba(42, 138, 106, 0.9);
    border-color: rgba(42, 138, 106, 0.6);

    &:hover {
      background: rgba(52, 158, 126, 0.95);
    }
  }

  &.danger {
    background: rgba(180, 60, 60, 0.9);
    border-color: rgba(180, 60, 60, 0.6);

    &:hover {
      background: rgba(200, 80, 80, 0.95);
    }
  }
}

:slotted(.action-select) {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(240, 240, 245, 0.95);
  color: #333;
  font-size: 14px;
  cursor: pointer;
}

:slotted(.action-checkbox) {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  cursor: pointer;
  user-select: none;

  input {
    accent-color: #2a8a6a;
  }
}

:slotted(.action-divider) {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 4px;
}

:slotted(.action-label) {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}
</style>
