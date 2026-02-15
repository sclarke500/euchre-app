<script setup lang="ts">
import { useSettingsStore } from '@/stores/settingsStore'

const settings = useSettingsStore()
</script>

<template>
  <div class="game-options">
    <div class="option-group">
      <h4>Players</h4>
      <p class="option-desc">Number of players (including AI)</p>
      <div class="player-count-selector">
        <button
          v-for="n in [4, 5, 6, 7, 8]"
          :key="n"
          :class="['count-btn', { active: settings.presidentPlayerCount === n }]"
          @click="settings.setPresidentPlayerCount(n)"
        >
          {{ n }}
        </button>
      </div>
    </div>

    <div class="option-group">
      <h4>Special Cards</h4>
      <p class="option-desc">Optional rules for 2s and Jokers</p>
      <div class="option-buttons">
        <button
          :class="['option-btn', { active: !settings.superTwosAndJokers }]"
          @click="settings.setSuperTwosAndJokers(false)"
        >
          <span class="option-title">Standard Rules</span>
          <span class="option-subtitle">2s are highest, no jokers</span>
        </button>
        <button
          :class="['option-btn', { active: settings.superTwosAndJokers }]"
          @click="settings.setSuperTwosAndJokers(true)"
        >
          <span class="option-title">Super 2s & Jokers</span>
          <span class="option-subtitle">Jokers beat all, 2 twos beat 3 aces</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/game-options';
</style>
