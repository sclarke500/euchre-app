<template>
  <div class="play-area" :class="`players-${playerCount}`">
    <div 
      v-for="card in cards" 
      :key="card.id"
      class="played-card"
      :class="getCardPositionClass(card)"
    >
      <SandboxCard :card="card" />
    </div>
    
    <!-- Position markers (debug) -->
    <div v-if="showGuides" class="position-guides">
      <div class="guide guide-top">Top</div>
      <div class="guide guide-left">Left</div>
      <div class="guide guide-right">Right</div>
      <div class="guide guide-bottom">Bottom</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card } from '@/engine'
import SandboxCard from './SandboxCard.vue'

interface PlayedCard extends Card {
  position?: string
}

const props = withDefaults(defineProps<{
  cards: PlayedCard[]
  playerCount: number
  showGuides?: boolean
}>(), {
  showGuides: false
})

// Get the CSS class for card positioning based on who played it
function getCardPositionClass(card: PlayedCard): string {
  // For now, we'll use the card's stored position
  // In a real implementation, this would come from the game state
  const location = (card as any)._location
  if (location?.position) {
    return `from-${location.position}`
  }
  return ''
}
</script>

<style scoped lang="scss">
.play-area {
  position: relative;
  width: 250px;
  height: 200px;
  
  // Visual boundary (optional)
  border: 2px dashed rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

.played-card {
  position: absolute;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  
  // Default center position
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  
  // Position offsets based on who played
  &.from-bottom {
    top: auto;
    bottom: 10px;
    transform: translateX(-50%);
  }
  
  &.from-top {
    top: 10px;
    bottom: auto;
    transform: translateX(-50%);
  }
  
  &.from-left {
    left: 10px;
    right: auto;
    transform: translateY(-50%);
  }
  
  &.from-right {
    left: auto;
    right: 10px;
    transform: translateY(-50%);
  }
  
  &.from-top-left {
    top: 20px;
    left: 20px;
    transform: none;
  }
  
  &.from-top-right {
    top: 20px;
    right: 20px;
    left: auto;
    transform: none;
  }
}

// Different arrangements for different player counts
.play-area.players-2 {
  .played-card {
    &:nth-child(1) { top: 10px; transform: translateX(-50%); }
    &:nth-child(2) { bottom: 10px; top: auto; transform: translateX(-50%); }
  }
}

.play-area.players-4 {
  .played-card {
    // Tighter cluster in center
    &:nth-child(1) { transform: translate(-50%, -50%) translate(0, -30px); }  // top
    &:nth-child(2) { transform: translate(-50%, -50%) translate(-40px, 0); }  // left
    &:nth-child(3) { transform: translate(-50%, -50%) translate(40px, 0); }   // right
    &:nth-child(4) { transform: translate(-50%, -50%) translate(0, 30px); }   // bottom
  }
}

// Debug guides
.position-guides {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.guide {
  position: absolute;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  text-transform: uppercase;
  
  &-top { top: 5px; left: 50%; transform: translateX(-50%); }
  &-bottom { bottom: 5px; left: 50%; transform: translateX(-50%); }
  &-left { left: 5px; top: 50%; transform: translateY(-50%); }
  &-right { right: 5px; top: 50%; transform: translateY(-50%); }
}
</style>
