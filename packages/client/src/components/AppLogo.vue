<script setup lang="ts">
import { ref, onMounted } from 'vue'

// Combined logo with jester image and URL text
// Use size prop to control overall size: 'sm', 'md', 'lg'
defineProps<{
  size?: 'sm' | 'md' | 'lg'
  wobble?: boolean
}>()

// Auto-wobble on mount
const isWobbling = ref(true)

onMounted(() => {
  // Stop wobble after animation completes (4 cycles × 0.5s)
  setTimeout(() => {
    isWobbling.value = false
  }, 2000)
})
</script>

<template>
  <div class="app-logo" :class="[size || 'md', { wobbling: isWobbling || wobble }]">
    <img src="@/assets/logo-jester-67.png" alt="6|7 Card Games" class="logo-img" />
    <span class="logo-url">67CardGames.com</span>
  </div>
</template>

<style scoped lang="scss">
// 67 wobble - seesaw effect like weighing 6 vs 7
@keyframes wobble-67 {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-2deg); }
  75% { transform: rotate(2deg); }
}

.app-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  
  &.wobbling {
    animation: wobble-67 0.5s ease-in-out 4;
    transform-origin: center center;
  }
  
  .logo-img {
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
  }
  
  .logo-url {
    font-family: 'Share Tech', sans-serif;
    color: white;
    letter-spacing: 2px;
    text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.6);
    margin-top: -8px; // Tuck up under logo
  }
  
  // Size variants
  &.sm {
    .logo-img {
      width: 100px;
    }
    .logo-url {
      font-size: 0.75rem;
      letter-spacing: 1px;
      margin-top: -4px;
    }
  }
  
  &.md {
    .logo-img {
      width: 160px;
    }
    .logo-url {
      font-size: 1rem;
      margin-top: -6px;
    }
  }
  
  &.lg {
    .logo-img {
      width: 240px;
    }
    .logo-url {
      font-size: 1.4rem;
      margin-top: -10px;
    }
  }
}
</style>
