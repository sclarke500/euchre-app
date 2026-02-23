<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
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

// Track if we're ready to render the game board (WebSocket connected)
const isReady = ref(false)

// Track if user confirmed leaving (to skip prompt on intentional leave)
const confirmedLeave = ref(false)

// Warn on page refresh/close
function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (lobbyStore.gameId && !confirmedLeave.value) {
    e.preventDefault()
    e.returnValue = 'Leave game?'
    return e.returnValue
  }
}

// Handle reconnect/validation on mount
onMounted(async () => {
  // Add refresh warning
  window.addEventListener('beforeunload', handleBeforeUnload)
  
  if (!isValidGameType.value) {
    router.replace('/play')
    return
  }
  
  // Ensure WebSocket is connected (handles direct URL navigation)
  if (!lobbyStore.isConnected) {
    console.log('[GameView] WebSocket not connected, connecting...')
    await lobbyStore.connect()
    
    // If we have a nickname, re-join lobby to establish identity
    if (lobbyStore.hasNickname) {
      lobbyStore.joinLobby()
    } else {
      // No identity - redirect to lobby to set nickname
      console.log('[GameView] No nickname set, redirecting to lobby')
      router.replace('/lobby')
      return
    }
  }
  
  // If we had to reconnect WebSocket (page reload scenario) and don't have an active game, redirect
  // Normal navigation from lobby will have gameId already set
  if (!lobbyStore.gameId) {
    console.log('[GameView] No active game in store, redirecting to menu')
    router.replace('/play')
    return
  }
  
  isReady.value = true
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

// Navigation guard - prompt before leaving game via back button
onBeforeRouteLeave((to, from) => {
  // Skip prompt if user already confirmed via leave button
  if (confirmedLeave.value) {
    return true
  }
  
  // Skip prompt if game is over or not in progress
  if (!lobbyStore.gameId) {
    return true
  }
  
  // Prompt user
  const confirmed = window.confirm('Leave game? You\'ll forfeit the current game.')
  if (confirmed) {
    lobbyStore.leaveGame()
    return true
  }
  
  // Cancel navigation
  return false
})

function leaveGame() {
  confirmedLeave.value = true
  lobbyStore.leaveGame()
  router.push('/lobby')
}
</script>

<template>
  <div v-if="isValidGameType && isReady" class="game-view">
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
  </div>
  <div v-else-if="!isReady" class="loading-state">
    Connecting...
  </div>
</template>

<style scoped>
.game-view {
  width: 100%;
  height: 100%;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
  font-size: 18px;
}
</style>
