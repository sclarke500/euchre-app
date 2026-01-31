<template>
  <div class="hand-container">
    <!-- Picked-up card shown separately during discard phase -->
    <div
      v-if="isDiscardPhase && pickedUpCard"
      class="picked-up-section"
      :class="{ 'discarding': isCardDiscarding(pickedUpCard) }"
    >
      <Card
        :card="pickedUpCard"
        :selectable="!isCardDiscarding(pickedUpCard)"
        @click="handleCardClick(pickedUpCard)"
      />
      <span class="picked-up-label">Picked Up</span>
    </div>

    <div class="player-hand" :class="{ 'dealing': isDealing, 'hidden': !showHand, 'discard-phase': isDiscardPhase, 'sliding-away': isSlidingAway }" :style="handContainerStyle">
      <div
        v-for="(card, index) in displayHand"
        :key="card.id"
        class="card-wrapper"
        :class="{ 'discarding': isCardDiscarding(card), 'playing': isCardPlaying(card) }"
        :style="getCardStyle(index, displayHand.length)"
      >
        <Card
          :card="card"
          :selectable="isCardSelectable(card) && !isCardDiscarding(card)"
          :dimmed="isCardDimmed(card)"
          @click="handleCardClick(card)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch, onMounted, onUnmounted } from 'vue'
import type { GameAdapter } from '@/composables/useGameAdapter'
import { GamePhase } from '@euchre/shared'
import type { Card as CardType } from '@euchre/shared'
import { sortCards } from '@/utils/cardSort'
import Card from './Card.vue'

const game = inject<GameAdapter>('game')!

const myHand = computed(() => game.myHand.value)
const isMyTurn = computed(() => game.isMyTurn.value)
const validCards = computed(() => game.validCards.value)
const phase = computed(() => game.phase.value)
const trump = computed(() => game.trump.value)
const dealer = computed(() => game.dealer.value)
const myPlayerId = computed(() => game.myPlayerId.value)
const turnUpCard = computed(() => game.turnUpCard.value)

const isDealing = ref(false)
const showHand = ref(false)
const discardingCardId = ref<string | null>(null)
const recentlyPlayedCard = ref<CardType | null>(null)
const dealAnimationInProgress = ref(false)
const isSlidingAway = ref(false)

// Check if user is sitting out (partner is going alone)
const isUserSittingOut = computed(() => {
  if (!trump.value?.goingAlone) return false
  const alonePlayer = trump.value.calledBy
  const partnerId = (alonePlayer + 2) % 4
  return myPlayerId.value === partnerId
})

// Watch for partner going alone and trigger slide-away animation
watch(isUserSittingOut, (sittingOut) => {
  if (sittingOut) {
    // Delay slightly so the trump announcement is visible first
    setTimeout(() => {
      isSlidingAway.value = true
    }, 500)
  } else {
    isSlidingAway.value = false
  }
})

// Watch for Dealing phase and trigger slide-up animation
watch(phase, (newPhase, oldPhase) => {
  if (newPhase === GamePhase.Dealing && oldPhase !== GamePhase.Dealing) {
    // Start deal animation sequence
    dealAnimationInProgress.value = true
    showHand.value = false
    isDealing.value = false

    // Wait half a second before starting animation
    setTimeout(() => {
      showHand.value = true
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        isDealing.value = true
        // Animation completes after 0.6s
        setTimeout(() => {
          isDealing.value = false
          dealAnimationInProgress.value = false
        }, 600)
      })
    }, 500)
  } else if (newPhase !== GamePhase.Dealing && !dealAnimationInProgress.value) {
    // Show hand normally when not dealing (and no animation in progress)
    showHand.value = true
    isDealing.value = false
  }
})

// Also check on mount if we're already in Dealing phase (for first hand)
onMounted(() => {
  if (phase.value === GamePhase.Dealing && displayHand.value.length > 0) {
    // Start deal animation sequence
    dealAnimationInProgress.value = true
    showHand.value = false
    isDealing.value = false

    setTimeout(() => {
      showHand.value = true
      requestAnimationFrame(() => {
        isDealing.value = true
        setTimeout(() => {
          isDealing.value = false
          dealAnimationInProgress.value = false
        }, 600)
      })
    }, 500)
  } else {
    // Show hand normally if not in Dealing phase
    showHand.value = true
  }
})

const isDealer = computed(() => {
  return myPlayerId.value === dealer.value
})

const isDiscardPhase = computed(() => {
  return phase.value === GamePhase.DealerDiscard && isDealer.value
})

// Find the picked-up card in hand (matches turn-up card)
const pickedUpCard = computed(() => {
  if (!isDiscardPhase.value || !turnUpCard.value) return null
  return myHand.value.find(c => c.id === turnUpCard.value!.id) ?? null
})

// Hand excluding the picked-up card during discard phase
const handWithoutPickedUp = computed(() => {
  if (!isDiscardPhase.value || !pickedUpCard.value) return myHand.value
  return myHand.value.filter(c => c.id !== pickedUpCard.value!.id)
})

const sortedHand = computed(() => {
  const trumpSuit = trump.value?.suit ?? null
  return sortCards(handWithoutPickedUp.value, trumpSuit)
})

// Display hand: during discard phase, exclude the picked-up card
// Include recently played card temporarily so it doesn't disappear instantly
const displayHand = computed(() => {
  if (recentlyPlayedCard.value) {
    // Keep the played card in the visual hand until animation completes
    const trumpSuit = trump.value?.suit ?? null
    const handWithPlayedCard = [...handWithoutPickedUp.value, recentlyPlayedCard.value]
    return sortCards(handWithPlayedCard, trumpSuit)
  }
  return sortedHand.value
})

// No dynamic container styling needed
const handContainerStyle = computed(() => ({}))

function isCardPlayable(card: CardType): boolean {
  if (!isMyTurn.value) return false
  if (phase.value === GamePhase.Playing) {
    return validCards.value.includes(card.id)
  }
  return false
}

function isCardSelectable(card: CardType): boolean {
  if (isDiscardPhase.value) return true
  return isCardPlayable(card)
}

function isCardDimmed(card: CardType): boolean {
  // Only dim cards during playing phase when it's my turn and the card isn't valid
  if (phase.value !== GamePhase.Playing) return false
  if (!isMyTurn.value) return false
  return !validCards.value.includes(card.id)
}

function isCardDiscarding(card: CardType): boolean {
  return discardingCardId.value === card.id
}

function isCardPlaying(card: CardType): boolean {
  return recentlyPlayedCard.value?.id === card.id
}

function getCardStyle(index: number, totalCards: number) {
  const FULL_HAND_SIZE = 5 // Euchre hand size
  const cardOffset = 38
  const maxRotation = 10
  const arcRadius = 340 // Cards arranged on arc of this radius

  // Map current card index to position in a full hand (0-4)
  // Cards should occupy the center positions to maintain constant spacing
  // Example: 3 cards → positions 1, 2, 3 (not 0, 2, 4)
  let positionInFullHand: number
  if (totalCards === 1) {
    positionInFullHand = (FULL_HAND_SIZE - 1) / 2 // Center position (2)
  } else {
    // Calculate the start position to center the cards
    const startPosition = (FULL_HAND_SIZE - totalCards) / 2
    positionInFullHand = startPosition + index
  }

  // Calculate angle offset based on position in full hand
  const position = positionInFullHand / (FULL_HAND_SIZE - 1)
  const angleOffset = (position - 0.5) * maxRotation * 2 // degrees from center
  const rotation = angleOffset

  // Calculate position on arc - middle cards higher, edge cards lower
  const angleRad = (angleOffset * Math.PI) / 180
  const x = (positionInFullHand - (FULL_HAND_SIZE - 1) / 2) * cardOffset
  const y = arcRadius * (1 - Math.cos(angleRad)) // 0 at center, positive at edges

  return {
    transform: `translateX(${x}px) translateY(${y}px) rotate(${rotation}deg)`,
    transformOrigin: 'center 300px', // Pivot point below card for natural fan
    zIndex: index,
  }
}


function handleCardClick(card: CardType) {
  if (isDiscardPhase.value) {
    // Animate the card flying away before actually discarding
    discardingCardId.value = card.id
    setTimeout(() => {
      game.discardCard(card)
      discardingCardId.value = null
    }, 400) // Match animation duration
    return
  }

  if (!isCardPlayable(card)) return

  // Store the card so it stays visible during animation
  recentlyPlayedCard.value = card

  // Play card immediately so it appears in the trick area
  game.playCard(card)

  // Delay removing from visual hand so it doesn't rearrange immediately
  setTimeout(() => {
    recentlyPlayedCard.value = null
  }, 400)
}
</script>

<style scoped lang="scss">
.hand-container {
  position: relative;
  display: flex;
  align-items: flex-end;
  width: 100%;
  justify-content: center;
}

.picked-up-section {
  position: absolute;
  left: $spacing-md;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-xs;
  animation: picked-up-appear 0.4s ease-out;

  &.discarding {
    animation: discard-fly-away 0.4s ease-in forwards;
    pointer-events: none;
  }

  .picked-up-label {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: bold;
  }

  :deep(.card.selectable) {
    cursor: pointer;
  }
}

@keyframes picked-up-appear {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.player-hand {
  position: relative;
  display: flex;
  justify-content: center;
  flex: 1;
  min-width: 250px;
  height: 80px; // Show ~75% of 105px card height
  overflow: hidden;

  &.hidden {
    visibility: hidden;
  }

  &.dealing {
    animation: slide-up-hand 0.6s ease-out;
  }

  &.sliding-away {
    animation: slide-down-hand 0.5s ease-in forwards;
    pointer-events: none;
  }

  &.discard-phase {
    overflow: visible; // Allow discard animation to extend beyond bounds
  }
}

.card-wrapper {
  position: absolute;
  top: 0;
  transition: transform 0.3s ease-out, opacity 0.3s ease-out;

  &.discarding {
    animation: discard-fly-away 0.4s ease-in forwards;
    pointer-events: none;
  }

  &.playing {
    opacity: 0;
    pointer-events: none;
  }
}

:deep(.player-hand .card.selectable) {
  cursor: pointer;
}

@keyframes discard-fly-away {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translateY(-250px) rotate(20deg) scale(0.6);
  }
}

@keyframes slide-up-hand {
  from {
    transform: translateY(150px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slide-down-hand {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(150px);
    opacity: 0;
  }
}
</style>
