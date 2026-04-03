<script setup lang="ts">
import { useSettingsStore } from '@/stores/settingsStore'
import type { TurnStyleRule } from '@67cards/shared'

const settings = useSettingsStore()

const turnStyleOptions: { value: TurnStyleRule; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: 'passLockout', label: 'Pass Lockout' },
  { value: 'singleRound', label: 'Single Round' },
]

function handleTurnStyleChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as TurnStyleRule
  settings.setPresidentTurnStyle(value)
}
</script>

<template>
  <div class="compact-options">
    <div class="option-row">
      <span class="option-label">Players</span>
      <div class="count-group">
        <button
          v-for="n in [4, 5, 6, 7, 8]"
          :key="n"
          :class="['count-pill', { active: settings.presidentPlayerCount === n }]"
          @click="settings.setPresidentPlayerCount(n)"
        >
          {{ n }}
        </button>
      </div>
    </div>
    <div class="option-row">
      <span class="option-label">Turn Style</span>
      <select 
        class="turn-style-select"
        :value="settings.presidentTurnStyle"
        @change="handleTurnStyleChange"
      >
        <option v-for="opt in turnStyleOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>
    <div class="option-row">
      <span class="option-label">Super 2s & Jokers</span>
      <div class="toggle-group">
        <button
          :class="['toggle-btn', { active: !settings.superTwosAndJokers }]"
          @click="settings.setSuperTwosAndJokers(false)"
        >
          Off
        </button>
        <button
          :class="['toggle-btn', { active: settings.superTwosAndJokers }]"
          @click="settings.setSuperTwosAndJokers(true)"
        >
          On
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/compact-options';

.turn-style-select {
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
