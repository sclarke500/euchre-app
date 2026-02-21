<script setup lang="ts">
/**
 * Banner shown when a player disconnects from a multiplayer game.
 * Displays the player's name and a boot button.
 * Auto-hides when player reconnects or is booted.
 */

defineProps<{
  playerName: string
  canBoot?: boolean
}>()

const emit = defineEmits<{
  boot: []
}>()
</script>

<template>
  <Transition name="banner-slide">
    <div class="disconnected-banner">
      <div class="banner-content">
        <span class="wifi-icon">📡</span>
        <span class="message">
          <strong>{{ playerName }}</strong> lost connection
        </span>
        <span class="waiting">Waiting to reconnect...</span>
      </div>
      <button
        v-if="canBoot"
        class="boot-btn"
        @click="emit('boot')"
      >
        Boot
      </button>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.disconnected-banner {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  
  display: flex;
  align-items: center;
  gap: 16px;
  
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 180, 0, 0.4);
  border-radius: 12px;
  padding: 12px 20px;
  
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wifi-icon {
  font-size: 1.2em;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.message {
  color: #fff;
  font-size: 0.95rem;
  
  strong {
    color: #ffb400;
  }
}

.waiting {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
  font-style: italic;
}

.boot-btn {
  background: linear-gradient(135deg, #c0392b 0%, #96281b 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    transform: scale(1.05);
  }
  
  &:active {
    transform: scale(0.98);
  }
}

// Slide animation
.banner-slide-enter-active,
.banner-slide-leave-active {
  transition: all 0.3s ease;
}

.banner-slide-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

.banner-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}
</style>
