<template>
  <div class="action-buttons">
    <button
      v-for="action in actions"
      :key="action.value"
      class="action-btn"
      @click="handleClick(action.value)"
    >
      {{ action.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
interface Action {
  label: string
  value: string
}

interface Props {
  actions: Action[]
}

defineProps<Props>()

const emit = defineEmits<{
  action: [value: string]
}>()

function handleClick(value: string) {
  emit('action', value)
}
</script>

<style scoped lang="scss">
.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
  justify-content: center;
}

.action-btn {
  padding: 4px $spacing-md;
  font-size: 0.8rem;
  font-weight: bold;
  background: white;
  color: #2d5f3f;
  border: 2px solid white;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;

  @media (max-height: 500px) {
    padding: 2px $spacing-sm;
    font-size: 0.7rem;
    border-radius: 4px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.9);
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: scale(0.98);
  }
}
</style>
