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
  gap: $spacing-md;
  justify-content: center;
}

.action-btn {
  padding: $spacing-md $spacing-lg;
  font-size: 1rem;
  font-weight: bold;
  background: white;
  color: #667eea;
  border: 2px solid white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 100px;

  &:hover {
    background: rgba(255, 255, 255, 0.9);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: translateY(0);
  }
}
</style>
