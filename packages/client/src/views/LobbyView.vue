<script setup lang="ts">
import { watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Lobby from '@/components/Lobby.vue'
import { useLobbyStore } from '@/stores/lobbyStore'
import type { GameType } from '@67cards/shared'

const props = defineProps<{
  code?: string
}>()

const router = useRouter()
const route = useRoute()
const lobbyStore = useLobbyStore()

// Set game type from query param if provided
onMounted(() => {
  const gameFromQuery = route.query.game as GameType | undefined
  if (gameFromQuery && ['euchre', 'president', 'spades'].includes(gameFromQuery)) {
    lobbyStore.setGameType(gameFromQuery)
  }
})

// Update URL when user joins/leaves a table (use odusId as the code)
watch(() => lobbyStore.currentTable?.odusId, (tableId) => {
  if (tableId && route.params.code !== tableId) {
    router.replace(`/lobby/${tableId}`)
  } else if (!tableId && route.params.code) {
    router.replace('/lobby')
  }
})

// Navigate to game when it starts
watch(
  () => lobbyStore.gameId,
  async (gameId) => {
    if (gameId) {
      const gameType = lobbyStore.currentGameType || 'euchre'
      const path = `/game/${gameType}/${gameId}`
      console.log('[LobbyView] Game started, navigating to:', path)
      try {
        await router.push(path)
        console.log('[LobbyView] Navigation completed')
      } catch (err) {
        console.error('[LobbyView] Navigation failed:', err)
        // Force navigation via location if router fails
        window.location.href = path
      }
    }
  },
  { immediate: true }
)

function goBack() {
  lobbyStore.disconnect()
  router.push('/')
}
</script>

<template>
  <Lobby :initial-table-code="code" @back="goBack" />
</template>
