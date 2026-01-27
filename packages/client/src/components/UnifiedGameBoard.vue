<template>
  <div class="game-board">
    <!-- Top row: back button | partner plaque | scoreboard -->
    <div class="cell-back">
      <button class="back-button" @click="$emit('leaveGame')">← Back</button>
    </div>
    <div class="cell-partner">
      <UnifiedOpponentHand
        :player="getPlayerAtPosition(2)"
        :is-current="currentPlayer === getPlayerAtPosition(2)?.id"
        position="top"
      />
    </div>
    <div class="cell-score">
      <ScoreBoard :scores="scores" />
    </div>

    <!-- Middle row: left player | play area | right player -->
    <div class="cell-left">
      <UnifiedOpponentHand
        :player="getPlayerAtPosition(1)"
        :is-current="currentPlayer === getPlayerAtPosition(1)?.id"
        position="left"
      />
    </div>
    <div class="cell-play">
      <UnifiedPlayArea />
    </div>
    <div class="cell-right">
      <UnifiedOpponentHand
        :player="getPlayerAtPosition(3)"
        :is-current="currentPlayer === getPlayerAtPosition(3)?.id"
        position="right"
      />
    </div>

    <!-- Bottom row: user plaque | user hand (spans 2 columns on mobile) -->
    <div class="cell-user-plaque">
      <UnifiedPlayerPlaque />
    </div>
    <div class="cell-hand">
      <UnifiedPlayerHand />
    </div>

    <Teleport to="body">
      <TrumpSelection v-if="showBidding" />
      <GameOver v-if="gameOver" :winner="winner" @leave-game="$emit('leaveGame')" />
      <div v-if="showDiscardPrompt" class="discard-modal-overlay">
        <div class="discard-modal">
          <span class="discard-text">Select a card to discard</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, provide, onMounted, onUnmounted } from 'vue'
import { useGameAdapter, type GameAdapter, type UnifiedPlayer } from '@/composables/useGameAdapter'
import { useMultiplayerGameStore } from '@/stores/multiplayerGameStore'
import { GamePhase } from '@euchre/shared'
import ScoreBoard from './ScoreBoard.vue'
import UnifiedPlayerHand from './UnifiedPlayerHand.vue'
import UnifiedOpponentHand from './UnifiedOpponentHand.vue'
import UnifiedPlayerPlaque from './UnifiedPlayerPlaque.vue'
import UnifiedPlayArea from './UnifiedPlayArea.vue'
import TrumpSelection from './TrumpSelection.vue'
import GameOver from './GameOver.vue'

const props = defineProps<{
  mode: 'singleplayer' | 'multiplayer'
}>()

defineEmits<{
  leaveGame: []
}>()

// Create the appropriate adapter based on mode
const game = useGameAdapter(props.mode)

// Provide the adapter to all child components
provide<GameAdapter>('game', game)

// Destructure commonly used values for template
const currentPlayer = computed(() => game.currentPlayer.value)
const scores = computed(() => game.scores.value)
const phase = computed(() => game.phase.value)
const gameOver = computed(() => game.gameOver.value)
const winner = computed(() => game.winner.value)
const myPlayerId = computed(() => game.myPlayerId.value)
const isMyTurn = computed(() => game.isMyTurn.value)
const players = computed(() => game.players.value)

// Get player at a specific visual position (relative to the human player)
// Human player is always at the bottom (position 0 visually)
function getPlayerAtPosition(visualPosition: number): UnifiedPlayer | null {
  const myId = myPlayerId.value
  if (myId === -1) return players.value[visualPosition] ?? null

  // Calculate actual seat index for this visual position
  const actualSeatIndex = (myId + visualPosition) % 4
  return players.value.find((p) => p.id === actualSeatIndex) ?? null
}

const showBidding = computed(() => {
  const isBiddingPhase = phase.value === GamePhase.BiddingRound1 || phase.value === GamePhase.BiddingRound2
  return isBiddingPhase && isMyTurn.value
})

const showDiscardPrompt = computed(() => {
  const isDealer = myPlayerId.value === game.dealer.value
  return phase.value === GamePhase.DealerDiscard && isDealer
})

// Multiplayer-specific lifecycle
onMounted(() => {
  if (props.mode === 'multiplayer') {
    const mpStore = useMultiplayerGameStore()
    mpStore.initialize()
  }
})

onUnmounted(() => {
  if (props.mode === 'multiplayer') {
    const mpStore = useMultiplayerGameStore()
    mpStore.cleanup()
  }
})
</script>

<style scoped lang="scss">
.game-board {
  width: 100%;
  height: 100%;
  background: 
    linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%),
    url('@/assets/ChatGPTLogo.png');
  background-size: 
    cover,
    contain;
  background-position: 
    center,
    center;
  background-repeat: 
    no-repeat,
    no-repeat;
  background-blend-mode: normal;
  // Logo opacity overlay
  position: relative;
  
  // Add pseudo-element for logo opacity
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: url('@/assets/ChatGPTLogo.png');
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
    opacity: 0.15;
    pointer-events: none; // Allow clicks to pass through
    z-index: 0;
  }
  
  // Ensure content is above the background logo
  // But modals should be positioned relative to viewport, not this container
  > *:not(.trump-selection):not(.game-over) {
    position: relative;
    z-index: 1;
  }
  
  display: grid;
  // Use 12 columns for flexible splits
  // Original proportions: back(1) partner(2) score(1) = 3:6:3, left(1) play(2) right(1) = 3:6:3
  // Bottom: plaque(1/3) hand(2/3) = 4:8
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "back back back partner partner partner partner partner partner score score score"
    "left left left play play play play play play right right right"
    "plaque plaque plaque plaque hand hand hand hand hand hand hand hand";
}

.cell-back {
  grid-area: back;
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm;
}


.back-button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: $spacing-xs $spacing-sm;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

.cell-partner {
  grid-area: partner;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: $spacing-sm;
}

.cell-score {
  grid-area: score;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: $spacing-sm;
}

.cell-left {
  grid-area: left;
  display: flex;
  justify-content: center;
  align-items: center;
}

.cell-play {
  grid-area: play;
  display: flex;
  justify-content: center;
  align-items: center;
}

.cell-right {
  grid-area: right;
  display: flex;
  justify-content: center;
  align-items: center;
}

.cell-hand {
  grid-area: hand;
  display: flex;
  justify-content: center;
  align-items: center;
}

.cell-user-plaque {
  grid-area: plaque;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: $spacing-xs;
  padding-bottom: 20px;
}

.discard-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  pointer-events: none;
}

.discard-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 12px;
  padding: $spacing-md $spacing-lg;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  animation: discard-modal-appear 0.2s ease-out;
}

.discard-text {
  color: #333;
  font-size: 1rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
}

@keyframes discard-modal-appear {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
</style>
