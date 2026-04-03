<script setup lang="ts">
import { useSettingsStore } from '@/stores/settingsStore'

const settings = useSettingsStore()
</script>

<template>
  <div class="compact-options">
    <div class="option-row">
      <span class="option-label">Draw Count</span>
      <div class="toggle-group">
        <button
          :class="['toggle-btn', { active: settings.klondikeDrawCount === 1 }]"
          @click="settings.setKlondikeDrawCount(1)"
        >
          1
        </button>
        <button
          :class="['toggle-btn', { active: settings.klondikeDrawCount === 3 }]"
          @click="settings.setKlondikeDrawCount(3)"
        >
          3
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/compact-options';
</style>
