<template>
  <div class="game-board">
    <div class="player-position-top">
      <OpponentHand :player="players[2]" position="top" />
    </div>

    <div class="player-position-left">
      <OpponentHand :player="players[1]" position="left" />
    </div>

    <div class="play-area">
      <PlayArea />
    </div>

    <div class="player-position-right">
      <OpponentHand :player="players[3]" position="right" />
    </div>

    <div class="player-position-bottom">
      <PlayerHand :player="players[0]" />
    </div>

    <ScoreBoard :scores="scores" />

    <TrumpSelection v-if="showBidding" />
    <div v-if="showDiscardPrompt" class="discard-prompt-overlay">
      <div class="discard-prompt">Select a card to discard</div>
    </div>
    <GameOver v-if="gameOver" :winner="winner" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { GamePhase } from '@/models/types'
import ScoreBoard from './ScoreBoard.vue'
import PlayerHand from './PlayerHand.vue'
import OpponentHand from './OpponentHand.vue'
import PlayArea from './PlayArea.vue'
import TrumpSelection from './TrumpSelection.vue'
import GameOver from './GameOver.vue'

const gameStore = useGameStore()

const players = computed(() => gameStore.players)
const scores = computed(() => gameStore.scores)
const trump = computed(() => gameStore.trump)
const gameOver = computed(() => gameStore.gameOver)
const winner = computed(() => gameStore.winner)
const phase = computed(() => gameStore.phase)

const currentPlayer = computed(() => gameStore.currentPlayer)

const showBidding = computed(() => {
  const isBiddingPhase = phase.value === GamePhase.BiddingRound1 || phase.value === GamePhase.BiddingRound2
  const isHumanTurn = players.value[0]?.id === currentPlayer.value
  return isBiddingPhase && isHumanTurn
})

const showDiscardPrompt = computed(() => {
  return phase.value === GamePhase.DealerDiscard
})
</script>

<style scoped lang="scss">
.game-board {
  position: relative;
}

.discard-prompt-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  pointer-events: none;
}

.discard-prompt {
  background: linear-gradient(135deg, #2d5f3f 0%, #1a3d28 100%);
  border: 2px solid rgba(255, 255, 255, 0.4);
  padding: $spacing-sm $spacing-lg;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  text-align: center;
  color: #f39c12;
  font-weight: bold;
  font-size: 1rem;
  backdrop-filter: blur(10px);
  animation: pulse 1.5s ease-in-out infinite;

  @media (max-height: 500px) {
    padding: $spacing-xs $spacing-md;
    font-size: 0.875rem;
    border-radius: 8px;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>
