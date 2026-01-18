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

const showBidding = computed(() => {
  return phase.value === GamePhase.BiddingRound1 || phase.value === GamePhase.BiddingRound2
})
</script>

<style scoped lang="scss">
.game-board {
  position: relative;
}
</style>
