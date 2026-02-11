<script setup lang="ts">
defineEmits<{
  click: []
}>()
</script>

<template>
  <Teleport to="body">
    <button class="back-button" @click="$emit('click')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>
  </Teleport>
</template>

<style scoped lang="scss">
.back-button {
  position: fixed;
  top: $spacing-md;
  left: $spacing-md;
  z-index: 10100;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--anim-fast) ease;

  &:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  &:active {
    transform: scale(0.95);
  }

  svg {
    width: 16px;
    height: 16px;
  }
}
</style>
