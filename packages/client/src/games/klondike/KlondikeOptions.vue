<script setup lang="ts">
import { useSettingsStore } from '@/stores/settingsStore'

const settings = useSettingsStore()
</script>

<template>
  <div class="compact-options">
    <div class="option-row">
      <span class="option-label">Draw Type</span>
      <div class="toggle-group">
        <button
          :class="['toggle-btn', { active: settings.klondikeDrawMode === 'single' }]"
          @click="settings.setKlondikeDrawMode('single')"
        >
          Single
        </button>
        <button
          :class="['toggle-btn', { active: settings.klondikeDrawMode === 'strict' }]"
          @click="settings.setKlondikeDrawMode('strict')"
        >
          3 - Strict
        </button>
        <button
          :class="['toggle-btn', { active: settings.klondikeDrawMode === 'wrap' }]"
          @click="settings.setKlondikeDrawMode('wrap')"
        >
          3 - Wrap
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/compact-options';
</style>
