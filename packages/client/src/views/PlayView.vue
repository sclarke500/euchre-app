<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { EuchreEngineBoard } from '@/games/euchre'
import { PresidentEngineBoard } from '@/games/president'
import { SpadesEngineBoard } from '@/games/spades'
import { KlondikeGameBoard } from '@/games/klondike'

const props = defineProps<{
  game: string
}>()

const router = useRouter()

const validGames = ['euchre', 'president', 'spades', 'klondike'] as const
type ValidGame = typeof validGames[number]

const isValidGame = computed(() => validGames.includes(props.game as ValidGame))

// Redirect invalid games to menu
if (!isValidGame.value) {
  router.replace('/play')
}

function leaveGame() {
  router.push('/play')
}
</script>

<template>
  <div v-if="isValidGame" class="play-view">
    <EuchreEngineBoard
      v-if="game === 'euchre'"
      mode="singleplayer"
      @leave-game="leaveGame"
    />
    <PresidentEngineBoard
      v-else-if="game === 'president'"
      mode="singleplayer"
      @leave-game="leaveGame"
    />
    <SpadesEngineBoard
      v-else-if="game === 'spades'"
      mode="singleplayer"
      @leave-game="leaveGame"
    />
    <KlondikeGameBoard
      v-else-if="game === 'klondike'"
      @leave-game="leaveGame"
    />
  </div>
</template>

<style scoped>
.play-view {
  width: 100%;
  height: 100%;
}
</style>
