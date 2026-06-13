<script setup lang="ts">
import { useRouter } from 'vue-router'
import SupportContent from '@/components/legal/SupportContent.vue'

const router = useRouter()

// Return to wherever the user came from; fall back to home if there's no
// in-app history (e.g. opened via a direct/External URL).
function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}
</script>

<template>
  <div class="support">
    <div class="support-content">
      <button class="back-link" @click="goBack">← Back</button>
      <SupportContent />
    </div>
  </div>
</template>

<style scoped lang="scss">
.support {
  min-height: 100vh;
  min-height: 100dvh;
  background: #181820;
  color: #e8e8ec;
  padding: $spacing-xl;
  overflow-y: auto;
}

.support-content {
  max-width: 720px;
  margin: 0 auto;
}

.back-link {
  background: none;
  border: none;
  color: #9aa0b5;
  font-size: 0.95rem;
  cursor: pointer;
  padding: 0;
  margin-bottom: $spacing-lg;

  &:hover {
    color: #fff;
  }
}
</style>
