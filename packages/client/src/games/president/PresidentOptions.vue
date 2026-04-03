<script setup lang="ts">
import { useSettingsStore } from '@/stores/settingsStore'
import type { TurnStyleRule } from '@67cards/shared'

const settings = useSettingsStore()

const turnStyleOptions: { value: TurnStyleRule; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: 'passLockout', label: 'Pass Lockout' },
  { value: 'singleRound', label: 'Single Round' },
]
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
      <div class="toggle-group">
        <button
          v-for="opt in turnStyleOptions"
          :key="opt.value"
          :class="['toggle-btn', { active: settings.presidentTurnStyle === opt.value }]"
          @click="settings.setPresidentTurnStyle(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
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
</style>
