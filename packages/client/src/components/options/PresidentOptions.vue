<script setup lang="ts">
import { useSettingsStore } from '@/stores/settingsStore'

const settings = useSettingsStore()
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
      <span class="option-label">Rules</span>
      <div class="toggle-group">
        <button
          :class="['toggle-btn', { active: !settings.superTwosAndJokers }]"
          @click="settings.setSuperTwosAndJokers(false)"
        >
          Standard
        </button>
        <button
          :class="['toggle-btn', { active: settings.superTwosAndJokers }]"
          @click="settings.setSuperTwosAndJokers(true)"
        >
          Super 2s
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/compact-options';
</style>
