<template>
  <div class="game-hud">
    <!-- Leave button -->
    <button class="hud-btn leave-btn" @click="$emit('leave')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>

    <!-- Bug report button -->
    <button class="hud-btn bug-btn" title="Report a bug" @click="showBugReport = true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      </svg>
    </button>

    <!-- Bug Report Modal -->
    <BugReportModal
      :show="showBugReport"
      :game-type="gameType"
      :build-payload="buildPayload"
      :show-resync="showResync"
      @close="showBugReport = false"
      @resync="$emit('resync')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BugReportModal from './BugReportModal.vue'

defineProps<{
  gameType: string
  buildPayload: () => Record<string, unknown>
  showResync?: boolean
}>()

defineEmits<{
  leave: []
  resync: []
}>()

const showBugReport = ref(false)
</script>

<style scoped lang="scss">
.game-hud {
  position: absolute;
  top: 10px;
  left: max(10px, env(safe-area-inset-left));
  z-index: 500;
  display: flex;
  gap: 8px;
}

.hud-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid #444;
  background: rgba(20, 20, 30, 0.8);
  color: #ccc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(40, 40, 50, 0.9);
  }
  
  svg {
    width: 24px;
    height: 24px;
  }
}
</style>
