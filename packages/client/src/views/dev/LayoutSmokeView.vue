<script setup lang="ts">
/**
 * Dev-only layout smoke page — empty CardTable with debug position dots.
 * Fast manual QA across viewports without starting a game.
 */
import CardTable from '@/components/CardTable.vue'

const playerNames = ['You', 'West', 'North', 'East']
</script>

<template>
  <div class="layout-smoke">
    <CardTable
      :player-count="4"
      :player-names="playerNames"
      layout="normal"
      game-name="LAYOUT SMOKE"
      debug-positions
    />
  </div>
</template>

<style scoped lang="scss">
.layout-smoke {
  width: 100%;
  height: 100%;
}
</style>