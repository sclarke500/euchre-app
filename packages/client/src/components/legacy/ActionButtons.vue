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
  gap: $spacing-sm;
  justify-content: center;
}

.action-btn {
  padding: $spacing-sm $spacing-lg;
  font-size: 1rem;
  font-weight: bold;
  background: white;
  color: #2d5f3f;
  border: 2px solid white;
  border-radius: 8px;
  cursor: pointer;
  min-width: 100px;

  @media (max-height: 500px) {
    padding: $spacing-xs $spacing-md;
    font-size: 0.875rem;
    border-radius: 6px;
    min-width: 80px;
  }

  &:active {
    transform: scale(0.95);
  }
}
</style>
