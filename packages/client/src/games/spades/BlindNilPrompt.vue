<template>
  <Transition name="prompt-slide">
    <div v-if="visible" class="blind-nil-prompt">
      <div class="shiny-overlay"></div>
      
      <div class="prompt-content">
        <div class="prompt-title">Blind Nil?</div>
        <div class="prompt-subtitle">Bid without seeing your cards</div>
        
        <div class="prompt-buttons">
          <button class="prompt-btn blind-nil" @click="$emit('blind-nil')">
            Blind Nil
          </button>
          <button class="prompt-btn show-cards" @click="$emit('show-cards')">
            Show Cards
          </button>
        </div>
      </div>
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
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 20px;
  padding-right: max(20px, env(safe-area-inset-right));
  background: rgba(20, 20, 30, 0.5);
  backdrop-filter: blur(20px);
  border-radius: 20px 0 0 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-right: none;
  box-shadow: -4px 0 30px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.shiny-overlay {
  position: absolute;
  inset: 0;
  border-radius: 20px 0 0 20px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.35) 0%,
    rgba(255, 255, 255, 0.15) 25%,
    rgba(255, 255, 255, 0.05) 50%,
    transparent 70%
  );
  pointer-events: none;
  z-index: 0;
}

.prompt-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.prompt-title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.prompt-subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
}

.prompt-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.prompt-btn {
  padding: 14px 24px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  min-width: 140px;
  
  &.blind-nil {
    background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
    color: #fff;
    box-shadow: 0 3px 12px rgba(139, 92, 246, 0.4);
    
    &:hover {
      transform: scale(1.02);
      box-shadow: 0 4px 16px rgba(139, 92, 246, 0.5);
    }
  }
  
  &.show-cards {
    background: rgba(245, 245, 248, 0.95);
    color: #1a1a2e;
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.2);
    
    &:hover {
      transform: scale(1.02);
    }
  }
  
  &:active {
    transform: scale(0.98);
  }
}

// Slide in from right transition
.prompt-slide-enter-active {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
}

.prompt-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease;
}

.prompt-slide-enter-from,
.prompt-slide-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(100%);
}
</style>
