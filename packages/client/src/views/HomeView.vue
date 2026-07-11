<script setup lang="ts">
import { useRouter } from 'vue-router'
import MainMenu, { type GameType } from '@/components/MainMenu.vue'
import { useLobbyStore } from '@/stores/lobbyStore'
import type { GameType as MultiplayerGameType } from '@67cards/shared'

const router = useRouter()
const lobbyStore = useLobbyStore()

const MULTIPLAYER_GAMES: MultiplayerGameType[] = ['euchre', 'spades', 'president']

function isMultiplayerGame(game: GameType): game is MultiplayerGameType {
  return (MULTIPLAYER_GAMES as string[]).includes(game)
}

function startSinglePlayer(game: GameType) {
  router.push(`/play/${game}`)
}

function enterMultiplayer(game: GameType, preferCreate = false) {
  if (isMultiplayerGame(game)) {
    lobbyStore.setGameType(game)
    localStorage.setItem('createTable.lastGameType', game)
    localStorage.setItem('selectedGame', game)
  }

  // Game card → Friends: jump straight to create with that game selected.
  // Global Play with Friends: lobby browser (join existing / create from there).
  if (preferCreate && isMultiplayerGame(game)) {
    router.push('/lobby/create')
    return
  }

  router.push({ name: 'lobby' })
}
</script>

<template>
  <MainMenu
    @start-single-player="startSinglePlayer"
    @enter-multiplayer="enterMultiplayer"
  />
</template>
