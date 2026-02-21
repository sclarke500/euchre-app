<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { EuchreEngineBoard } from '@/games/euchre'
import { PresidentEngineBoard } from '@/games/president'
import { SpadesEngineBoard } from '@/games/spades'
import { useLobbyStore } from '@/stores/lobbyStore'

const props = defineProps<{
  gameType: string
  gameId: string
}>()

const router = useRouter()
const lobbyStore = useLobbyStore()

const validGameTypes = ['euchre', 'president', 'spades'] as const
type ValidGameType = typeof validGameTypes[number]

const isValidGameType = computed(() => validGameTypes.includes(props.gameType as ValidGameType))

// Handle reconnect/validation on mount
onMounted(async () => {
  if (!isValidGameType.value) {
    router.replace('/')
    return
  }
  
  // If we don't have an active game matching this ID, try to reconnect
  if (lobbyStore.gameId !== props.gameId) {
    // Store the game info for reconnect attempt
    lobbyStore.setGameType(props.gameType as ValidGameType)
    
    // The game board will handle reconnection via its multiplayer store
    // If reconnect fails, the store will clear gameId and we'll redirect
  }
})

function leaveGame() {
  lobbyStore.leaveGame()
  router.push('/lobby')
}
</script>

<template>
  <template v-if="isValidGameType">
    <EuchreEngineBoard
      v-if="gameType === 'euchre'"
      mode="multiplayer"
      @leave-game="leaveGame"
    />
    <PresidentEngineBoard
      v-else-if="gameType === 'president'"
      mode="multiplayer"
      @leave-game="leaveGame"
    />
    <SpadesEngineBoard
      v-else-if="gameType === 'spades'"
      mode="multiplayer"
      @leave-game="leaveGame"
    />
  </template>
</template>
