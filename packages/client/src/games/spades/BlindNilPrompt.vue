<template>
  <Transition name="prompt-fade">
    <div v-if="visible" class="blind-nil-prompt">
      <button class="prompt-btn blind-nil" @click="$emit('blind-nil')">
        Blind Nil
      </button>
      <button class="prompt-btn show-cards" @click="$emit('show-cards')">
        Show Cards
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

defineEmits<{
  'blind-nil': []
  'show-cards': []
}>()
</script>

<style scoped lang="scss">
.blind-nil-prompt {
  position: fixed;
  bottom: calc(20% + 20px); // Just above user's hand area
  left: 50%;
  transform: translateX(-50%);
  z-index: 600;
  display: flex;
  gap: 12px;
}

.prompt-btn {
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
  
  &.blind-nil {
    background: rgba(139, 92, 246, 0.85);
    color: #fff;
    
    &:hover {
      background: rgba(139, 92, 246, 0.95);
    }
  }
  
  &.show-cards {
    background: rgba(255, 255, 255, 0.9);
    color: #1a1a2e;
    
    &:hover {
      background: rgba(255, 255, 255, 1);
    }
  }
  
  &:active {
    transform: scale(0.96);
  }
}

// Fade transition
.prompt-fade-enter-active,
.prompt-fade-leave-active {
  transition: opacity 0.25s ease;
}

.prompt-fade-enter-from,
.prompt-fade-leave-to {
  opacity: 0;
}
</style>
