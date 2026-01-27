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
  background-color: transparent;

  &.non-blocking {
    pointer-events: none;

    .modal-content {
      pointer-events: auto;
    }
  }
}

.modal-content {
  background: rgba(245, 245, 245, 0.85);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  padding: $spacing-lg;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  text-align: center;
}

// Transition styles
.modal-enter-active {
  transition: opacity 0.25s ease-out;

  .modal-content {
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease-out;
  }
}

.modal-leave-active {
  transition: opacity 0.2s ease-in;

  .modal-content {
    transition: transform 0.2s ease-in, opacity 0.2s ease-in;
  }
}

.modal-enter-from {
  opacity: 0;

  .modal-content {
    opacity: 0;
    transform: scale(0.9) translateY(15px);
  }
}

.modal-leave-to {
  opacity: 0;

  .modal-content {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
}
</style>
