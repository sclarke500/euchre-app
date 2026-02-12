<template>
  <Transition name="toast-slide">
    <div
      v-if="toast.current.value"
      class="app-toast"
      :class="toast.current.value.type"
      @click="toast.dismiss()"
    >
      {{ toast.current.value.message }}
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast'
const toast = useToast()
</script>

<style scoped lang="scss">
.app-toast {
  position: fixed;
  top: $spacing-md;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  padding: $spacing-sm $spacing-lg;
  border-radius: 8px;
  font-size: 0.875rem;
  color: white;
  cursor: pointer;
  max-width: 90vw;
  text-align: center;
  pointer-events: auto;

  &.error {
    background: rgba(180, 40, 40, 0.95);
    backdrop-filter: blur(8px);
  }
  &.info {
    background: rgba(30, 77, 43, 0.95);
    backdrop-filter: blur(8px);
  }
  &.success {
    background: rgba(30, 120, 60, 0.95);
    backdrop-filter: blur(8px);
  }
}

.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.3s ease;
}
.toast-slide-enter-from,
.toast-slide-leave-to {
  transform: translateX(-50%) translateY(-20px);
  opacity: 0;
}
</style>
