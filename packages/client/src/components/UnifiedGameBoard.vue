<template>
  <Teleport to="body">
    <button class="back-button" @click="showLeaveConfirm = true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>
  </Teleport>
  <div class="game-board">
    <!-- Top row: partner plaque | scoreboard -->
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

    <TrumpSelection :show="showBidding" />
    <GameOver v-if="gameOver" :winner="winner" :mode="props.mode === 'singleplayer' ? 'singlePlayer' : 'multiplayer'" :is-host="isHost" @exit="emit('leaveGame')" />

    <Modal :show="showDiscardPrompt" non-blocking>
      <span class="discard-text">Select a card to discard</span>
    </Modal>

    <Modal :show="showLeaveConfirm" :priority="10" @close="showLeaveConfirm = false">
      <p class="leave-text">Leave this game?</p>
      <div class="leave-buttons">
        <button class="leave-btn cancel" @click="showLeaveConfirm = false">Cancel</button>
        <button class="leave-btn confirm" @click="confirmLeave">Leave</button>
      </div>
    </Modal>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, provide, onMounted, onUnmounted } from 'vue'
import { useGameAdapter, type GameAdapter, type UnifiedPlayer } from '@/composables/useGameAdapter'
import { useMultiplayerGameStore } from '@/stores/multiplayerGameStore'
import { useLobbyStore } from '@/stores/lobbyStore'
import { GamePhase } from '@euchre/shared'
import ScoreBoard from './ScoreBoard.vue'
import UnifiedPlayerHand from './UnifiedPlayerHand.vue'
import UnifiedOpponentHand from './UnifiedOpponentHand.vue'
import UnifiedPlayerPlaque from './UnifiedPlayerPlaque.vue'
import UnifiedPlayArea from './UnifiedPlayArea.vue'
import TrumpSelection from './TrumpSelection.vue'
import GameOver from './GameOver.vue'
import Modal from './Modal.vue'

const props = defineProps<{
  mode: 'singleplayer' | 'multiplayer'
}>()

const emit = defineEmits<{
  leaveGame: []
}>()

const showLeaveConfirm = ref(false)

function confirmLeave() {
  showLeaveConfirm.value = false
  emit('leaveGame')
}

// Create the appropriate adapter based on mode
const game = useGameAdapter(props.mode)
const lobbyStore = useLobbyStore()

// Host status for multiplayer games
const isHost = computed(() => lobbyStore.isHost)

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
    url('@/assets/AppLogo.png');
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
    background-image: url('@/assets/AppLogo.png');
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
  // Top row: empty(3) partner(6) score(3), left(3) play(6) right(3) middle, plaque(4) hand(8) bottom
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    ". . . partner partner partner partner partner partner score score score"
    "left left left play play play play play play right right right"
    "plaque plaque plaque plaque hand hand hand hand hand hand hand hand";
}

.back-button {
  position: fixed;
  top: $spacing-md;
  left: $spacing-md;
  z-index: 10100;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
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

.discard-text {
  color: #333;
  font-size: 1rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.leave-text {
  color: #333;
  font-size: 1.1rem;
  font-weight: bold;
  margin: 0 0 $spacing-lg 0;
}

.leave-buttons {
  display: flex;
  gap: $spacing-md;
  justify-content: center;
}

.leave-btn {
  padding: $spacing-sm $spacing-lg;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;

  &.cancel {
    background: #e0e0e0;
    color: #333;
    border: none;
  }

  &.confirm {
    background: #e74c3c;
    color: white;
    border: none;
  }
}
</style>
