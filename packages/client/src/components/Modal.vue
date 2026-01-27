<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="modal-overlay"
        :class="{ 'non-blocking': nonBlocking }"
        :style="{ zIndex: 10000 + priority }"
        @click.self="$emit('close')"
      >
        <div class="modal-content">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  show: boolean
  nonBlocking?: boolean
  priority?: number
}>(), {
  nonBlocking: false,
  priority: 0
})

defineEmits<{
  close: []
}>()
</script>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  // z-index set via inline style based on priority prop
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;

  &.non-blocking {
    pointer-events: none;

    .modal-content {
      pointer-events: auto;
    }
  }
}

.modal-content {
  background: #f5f5f5;
  border-radius: 12px;
  padding: $spacing-lg;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  text-align: center;
}

// Transition styles
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  opacity: 0;
  transform: scale(0.9);
}
</style>
