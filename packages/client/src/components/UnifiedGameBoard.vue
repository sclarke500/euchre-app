<template>
  <div class="game-board">
    <div class="player-position-top">
      <UnifiedOpponentHand
        :player="getPlayerAtPosition(2)"
        :is-current="currentPlayer === getPlayerAtPosition(2)?.id"
        position="top"
      />
    </div>

    <div class="player-position-left">
      <UnifiedOpponentHand
        :player="getPlayerAtPosition(1)"
        :is-current="currentPlayer === getPlayerAtPosition(1)?.id"
        position="left"
      />
    </div>

    <div class="play-area">
      <UnifiedPlayArea />
    </div>

    <div class="player-position-right">
      <UnifiedOpponentHand
        :player="getPlayerAtPosition(3)"
        :is-current="currentPlayer === getPlayerAtPosition(3)?.id"
        position="right"
      />
    </div>

    <div class="player-position-bottom">
      <UnifiedPlayerHand />
    </div>

    <ScoreBoard :scores="scores" />

    <TrumpSelection v-if="showBidding" />

    <GameOver v-if="gameOver" :winner="winner" @leave-game="$emit('leaveGame')" />
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
  position: relative;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%);
  display: grid;
  grid-template-areas:
    ". top ."
    "left play right"
    ". bottom .";
  grid-template-columns: 1fr 2fr 1fr;
  grid-template-rows: 1fr 2fr 1fr;
}

.player-position-top {
  grid-area: top;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: $spacing-md;

  @media (max-height: 500px) {
    justify-content: flex-start;
    padding-left: $spacing-md;
    padding-top: $spacing-xs;
  }
}

.player-position-left {
  grid-area: left;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding-left: $spacing-md;
}

.player-position-right {
  grid-area: right;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-right: $spacing-md;
}

.player-position-bottom {
  grid-area: bottom;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding-bottom: $spacing-md;

  @media (max-height: 500px) {
    padding-bottom: 0;
  }
}

.play-area {
  grid-area: play;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
