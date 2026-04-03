<script setup lang="ts">
import { useSettingsStore } from '@/stores/settingsStore'

type DrawMode = 'single' | 'strict' | 'wrap'

const settings = useSettingsStore()

const drawModeOptions: { value: DrawMode; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'strict', label: '3 - Strict' },
  { value: 'wrap', label: '3 - Wrap' },
]

function handleDrawModeChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as DrawMode
  settings.setKlondikeDrawMode(value)
}
</script>

<template>
  <div class="compact-options">
    <div class="option-row">
      <span class="option-label">Draw Type</span>
      <select 
        class="draw-mode-select"
        :value="settings.klondikeDrawMode"
        @change="handleDrawModeChange"
      >
        <option v-for="opt in drawModeOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/compact-options';

.draw-mode-select {
  padding: 6px 28px 6px 10px;
  border-radius: 6px;
  background: #2a2d35;
  color: #e0e0e0;
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid #3a3d45;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  
  &:hover {
    border-color: #4a9eff;
  }
  
  &:focus {
    outline: none;
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
  }
  
  option {
    background: #2a2d35;
    color: #e0e0e0;
  }
}
</style>
