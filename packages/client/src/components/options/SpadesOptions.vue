<script setup lang="ts">
import { useSettingsStore } from '@/stores/settingsStore'

const settings = useSettingsStore()
</script>

<template>
  <div class="compact-options">
    <div class="option-row">
      <span class="option-label">Winning Score</span>
      <div class="toggle-group">
        <button
          v-for="score in [250, 500, 750]"
          :key="score"
          :class="['toggle-btn', { active: settings.spadesWinningScore === score }]"
          @click="settings.setSpadesWinningScore(score)"
        >
          {{ score }}
        </button>
      </div>
    </div>
    <div class="option-row disabled">
      <span class="option-label">Blind Nil</span>
      <div class="toggle-group">
        <button
          :class="['toggle-btn', { active: !settings.spadesBlindNil }]"
          disabled
        >
          Off
        </button>
        <button
          :class="['toggle-btn', { active: settings.spadesBlindNil }]"
          disabled
        >
          On
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/compact-options';

.option-row.disabled {
  opacity: 0.5;
  
  .toggle-btn {
    cursor: not-allowed;
  }
}
</style>
