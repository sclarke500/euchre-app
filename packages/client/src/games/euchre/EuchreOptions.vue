<script setup lang="ts">
import { useSettingsStore } from '@/stores/settingsStore'

const settings = useSettingsStore()
</script>

<template>
  <div class="compact-options">
    <div class="option-row">
      <span class="option-label">Stick the Dealer</span>
      <div class="toggle-group">
        <button
          :class="['toggle-btn', { active: settings.dealerPassRule === 'canPass' }]"
          @click="settings.setDealerPassRule('canPass')"
        >
          Off
        </button>
        <button
          :class="['toggle-btn', { active: settings.dealerPassRule === 'stickTheDealer' }]"
          @click="settings.setDealerPassRule('stickTheDealer')"
        >
          On
        </button>
      </div>
    </div>
    <div class="option-row">
      <span class="option-label">Canadian Loner</span>
      <div class="toggle-group">
        <button
          :class="['toggle-btn', { active: !settings.canadianLoner }]"
          @click="settings.setCanadianLoner(false)"
        >
          Off
        </button>
        <button
          :class="['toggle-btn', { active: settings.canadianLoner }]"
          @click="settings.setCanadianLoner(true)"
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
