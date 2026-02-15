<script setup lang="ts">
import { useSettingsStore } from '@/stores/settingsStore'

const settings = useSettingsStore()
</script>

<template>
  <div class="game-options">
    <div class="option-group">
      <h4>Dealer Rules</h4>
      <p class="option-desc">What happens if no one calls trump in round 2</p>
      <div class="option-buttons">
        <button
          :class="['option-btn', { active: settings.dealerPassRule === 'canPass' }]"
          @click="settings.setDealerPassRule('canPass')"
        >
          <span class="option-title">Dealer Can Pass</span>
          <span class="option-subtitle">Hand is thrown in, cards redealt</span>
        </button>
        <button
          :class="['option-btn', { active: settings.dealerPassRule === 'stickTheDealer' }]"
          @click="settings.setDealerPassRule('stickTheDealer')"
        >
          <span class="option-title">Stick the Dealer</span>
          <span class="option-subtitle">Dealer must call a suit</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/game-options';
</style>
