<template>
  <div class="play-area-container">
    <!-- Turn-up card during bidding -->
    <div v-if="showTurnUpCard || isDismissingKitty" class="turn-up-card" :class="{ 'dismissing': isDismissingKitty, 'flipping': isFlipping }">
      <div class="card-flipper">
        <div class="card-front">
          <Card v-if="turnUpCard" :card="turnUpCard" :selectable="false" />
        </div>
        <div class="card-back">
          <div class="card-back-pattern"></div>
        </div>
      </div>
      <span v-if="!isDismissingKitty" class="turn-up-label">Turn Up</span>
    </div>
    <!-- Played cards during trick -->
    <div v-else-if="currentTrickCards.length > 0" class="played-cards" :class="sweepClass">
      <div
        v-for="playedCard in currentTrickCards"
        :key="`${playedCard.playerId}-${playedCard.card.id}`"
        :class="['played-card', `position-${getCardPosition(playedCard.playerId)}`]"
      >
        <Card :card="playedCard.card" :selectable="false" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import type { GameAdapter } from '@/composables/useGameAdapter'
import { GamePhase } from '@euchre/shared'
import Card from '../Card.vue'

const game = inject<GameAdapter>('game')!

const phase = computed(() => game.phase.value)
const turnUpCard = computed(() => game.turnUpCard.value)
const currentTrick = computed(() => game.currentTrick.value)
const myPlayerId = computed(() => game.myPlayerId.value)

const isSweepingAway = ref(false)
const winnerPosition = ref<number | null>(null)
const isDismissingKitty = ref(false)
const isFlipping = ref(false)
let sweepTimeout: number | null = null

// Compute the sweep class based on winner position
const sweepClass = computed(() => {
  if (!isSweepingAway.value) return {}
  return {
    'sweeping-away': true,
    [`sweep-to-${winnerPosition.value}`]: winnerPosition.value !== null
  }
})

// Watch for TrickComplete or RoundComplete phase and trigger sweep animation
// Also watch for transition from BiddingRound1 to BiddingRound2 for kitty dismiss animation
watch(phase, (newPhase, oldPhase) => {
  // Clear any existing timeout
  if (sweepTimeout !== null) {
    clearTimeout(sweepTimeout)
    sweepTimeout = null
  }

  // Detect transition from bidding round 1 to round 2
  if (oldPhase === GamePhase.BiddingRound1 && newPhase === GamePhase.BiddingRound2) {
    // Start the flip animation
    isFlipping.value = true
    isDismissingKitty.value = true

    // After flip completes (600ms), slide off (800ms), then reset
    setTimeout(() => {
      setTimeout(() => {
        isDismissingKitty.value = false
        isFlipping.value = false
      }, 800) // Slide-off duration
    }, 600) // Flip duration
  }

  if (newPhase === GamePhase.TrickComplete || newPhase === GamePhase.RoundComplete) {
    // Capture the winner position before triggering animation
    const winnerId = game.lastTrickWinnerId.value
    if (winnerId !== null) {
      winnerPosition.value = getCardPosition(winnerId)
    }

    const delay = newPhase === GamePhase.TrickComplete ? 700 : 1000
    sweepTimeout = window.setTimeout(() => {
      isSweepingAway.value = true
    }, delay)
  } else {
    // Reset sweep state when phase changes
    isSweepingAway.value = false
    winnerPosition.value = null
  }
})

// Only show turn-up card in round 1 - in round 2 it's been turned over and removed
const showTurnUpCard = computed(() => {
  return phase.value === GamePhase.BiddingRound1 && turnUpCard.value
})

const currentTrickCards = computed(() => {
  return currentTrick.value?.cards ?? []
})

// Get visual position of a card based on player ID relative to human player
function getCardPosition(playerId: number): number {
  const myId = myPlayerId.value
  if (myId === -1) return playerId

  return (playerId - myId + 4) % 4
}
</script>

<style scoped lang="scss">
.play-area-container {
  position: relative;
  width: 200px;
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-height: 500px) {
    width: 150px;
    height: 110px;
  }
}

.played-cards {
  position: relative;
  width: 100%;
  height: 100%;

  // Sweep towards winner at position 0 (bottom/human player)
  &.sweeping-away.sweep-to-0 .played-card {
    &.position-0 { animation: sweep-0-to-0 0.4s ease-in forwards; }
    &.position-1 { animation: sweep-1-to-0 0.4s ease-in forwards; }
    &.position-2 { animation: sweep-2-to-0 0.4s ease-in forwards; }
    &.position-3 { animation: sweep-3-to-0 0.4s ease-in forwards; }
  }

  // Sweep towards winner at position 1 (left)
  &.sweeping-away.sweep-to-1 .played-card {
    &.position-0 { animation: sweep-0-to-1 0.4s ease-in forwards; }
    &.position-1 { animation: sweep-1-to-1 0.4s ease-in forwards; }
    &.position-2 { animation: sweep-2-to-1 0.4s ease-in forwards; }
    &.position-3 { animation: sweep-3-to-1 0.4s ease-in forwards; }
  }

  // Sweep towards winner at position 2 (top/partner)
  &.sweeping-away.sweep-to-2 .played-card {
    &.position-0 { animation: sweep-0-to-2 0.4s ease-in forwards; }
    &.position-1 { animation: sweep-1-to-2 0.4s ease-in forwards; }
    &.position-2 { animation: sweep-2-to-2 0.4s ease-in forwards; }
    &.position-3 { animation: sweep-3-to-2 0.4s ease-in forwards; }
  }

  // Sweep towards winner at position 3 (right)
  &.sweeping-away.sweep-to-3 .played-card {
    &.position-0 { animation: sweep-0-to-3 0.4s ease-in forwards; }
    &.position-1 { animation: sweep-1-to-3 0.4s ease-in forwards; }
    &.position-2 { animation: sweep-2-to-3 0.4s ease-in forwards; }
    &.position-3 { animation: sweep-3-to-3 0.4s ease-in forwards; }
  }
}

.played-card {
  position: absolute;

  // Bottom player (human)
  &.position-0 {
    bottom: -35px;
    left: 50%;
    transform: translateX(-50%);
    animation: play-card-bottom 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  // Left player
  &.position-1 {
    left: -40px;
    top: 50%;
    transform: translateY(-50%);
    animation: play-card-left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  // Top player (partner)
  &.position-2 {
    top: -35px;
    left: 50%;
    transform: translateX(-50%);
    animation: play-card-top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  // Right player
  &.position-3 {
    right: -40px;
    top: 50%;
    transform: translateY(-50%);
    animation: play-card-right 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @media (max-height: 500px) {

    &.position-1 {
      left: -30px;
    }

    &.position-3 {
      right: -30px;
    }
  }
}

.turn-up-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-xs;
  perspective: 600px;

  &:not(.dismissing):not(.flipping) {
    animation: turn-up-reveal 0.5s ease-out;
  }

  &.dismissing {
    animation: kitty-slide-off 0.8s ease-in 0.6s forwards;
  }

  .card-flipper {
    position: relative;
    width: 70px;
    height: 105px;
    transform-style: preserve-3d;
    transition: transform 0.6s ease-in-out;

    @media (max-height: 500px) {
      width: 52px;
      height: 78px;
    }
  }

  &.flipping .card-flipper {
    transform: rotateY(180deg);
  }

  .card-front,
  .card-back {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    border-radius: 6px;
  }

  .card-front {
    z-index: 2;
  }

  .card-back {
    transform: rotateY(180deg);
    background: linear-gradient(135deg, #2c5282 0%, #1a365d 100%);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .card-back-pattern {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    bottom: 8px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;

    &::before {
      content: '';
      position: absolute;
      top: 4px;
      left: 4px;
      right: 4px;
      bottom: 4px;
      background: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 4px,
        rgba(255, 255, 255, 0.05) 4px,
        rgba(255, 255, 255, 0.05) 8px
      );
    }
  }

  .turn-up-label {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: bold;
    animation: label-fade-in 0.4s ease-out 0.3s both;

    @media (max-height: 500px) {
      font-size: 0.625rem;
    }
  }
}

@keyframes kitty-slide-off {
  from {
    opacity: 1;
    transform: translateX(0) translateY(0);
  }
  to {
    opacity: 0;
    transform: translateX(150px) translateY(-50px) rotate(15deg);
  }
}

@keyframes turn-up-reveal {
  0% {
    opacity: 0;
    transform: scale(0.8) rotateY(-90deg);
  }
  50% {
    opacity: 1;
    transform: scale(1.05) rotateY(0deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotateY(0deg);
  }
}

@keyframes label-fade-in {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes play-card-bottom {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(100px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@keyframes play-card-left {
  from {
    opacity: 0;
    transform: translateY(-50%) translateX(-100px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) translateX(0) scale(1);
  }
}

@keyframes play-card-top {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-100px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@keyframes play-card-right {
  from {
    opacity: 0;
    transform: translateY(-50%) translateX(100px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) translateX(0) scale(1);
  }
}

// Sweep animations from each position to winner position 0 (bottom)
@keyframes sweep-0-to-0 {
  from { opacity: 1; transform: translateX(-50%); }
  to { opacity: 0; transform: translateX(-50%) translateY(80px) scale(0.5); }
}
@keyframes sweep-1-to-0 {
  from { opacity: 1; transform: translateY(-50%); }
  to { opacity: 0; transform: translateX(60px) translateY(80px) scale(0.5); }
}
@keyframes sweep-2-to-0 {
  from { opacity: 1; transform: translateX(-50%); }
  to { opacity: 0; transform: translateX(-50%) translateY(120px) scale(0.5); }
}
@keyframes sweep-3-to-0 {
  from { opacity: 1; transform: translateY(-50%); }
  to { opacity: 0; transform: translateX(-60px) translateY(80px) scale(0.5); }
}

// Sweep animations from each position to winner position 1 (left)
@keyframes sweep-0-to-1 {
  from { opacity: 1; transform: translateX(-50%); }
  to { opacity: 0; transform: translateX(-120px) translateY(-60px) scale(0.5); }
}
@keyframes sweep-1-to-1 {
  from { opacity: 1; transform: translateY(-50%); }
  to { opacity: 0; transform: translateX(-80px) translateY(-50%) scale(0.5); }
}
@keyframes sweep-2-to-1 {
  from { opacity: 1; transform: translateX(-50%); }
  to { opacity: 0; transform: translateX(-120px) translateY(60px) scale(0.5); }
}
@keyframes sweep-3-to-1 {
  from { opacity: 1; transform: translateY(-50%); }
  to { opacity: 0; transform: translateX(-120px) translateY(-50%) scale(0.5); }
}

// Sweep animations from each position to winner position 2 (top)
@keyframes sweep-0-to-2 {
  from { opacity: 1; transform: translateX(-50%); }
  to { opacity: 0; transform: translateX(-50%) translateY(-120px) scale(0.5); }
}
@keyframes sweep-1-to-2 {
  from { opacity: 1; transform: translateY(-50%); }
  to { opacity: 0; transform: translateX(60px) translateY(-80px) scale(0.5); }
}
@keyframes sweep-2-to-2 {
  from { opacity: 1; transform: translateX(-50%); }
  to { opacity: 0; transform: translateX(-50%) translateY(-80px) scale(0.5); }
}
@keyframes sweep-3-to-2 {
  from { opacity: 1; transform: translateY(-50%); }
  to { opacity: 0; transform: translateX(-60px) translateY(-80px) scale(0.5); }
}

// Sweep animations from each position to winner position 3 (right)
@keyframes sweep-0-to-3 {
  from { opacity: 1; transform: translateX(-50%); }
  to { opacity: 0; transform: translateX(60px) translateY(-60px) scale(0.5); }
}
@keyframes sweep-1-to-3 {
  from { opacity: 1; transform: translateY(-50%); }
  to { opacity: 0; transform: translateX(120px) translateY(-50%) scale(0.5); }
}
@keyframes sweep-2-to-3 {
  from { opacity: 1; transform: translateX(-50%); }
  to { opacity: 0; transform: translateX(60px) translateY(60px) scale(0.5); }
}
@keyframes sweep-3-to-3 {
  from { opacity: 1; transform: translateY(-50%); }
  to { opacity: 0; transform: translateX(80px) translateY(-50%) scale(0.5); }
}
</style>
