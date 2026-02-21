<script setup lang="ts">
import { useRouter } from 'vue-router'
import MainMenu, { type GameType } from '@/components/MainMenu.vue'

const router = useRouter()

function startSinglePlayer(game: GameType) {
  router.push(`/play/${game}`)
}

function enterMultiplayer(game: GameType) {
  // Store selected game type, then go to lobby
  router.push({ name: 'lobby', query: { game } })
}
</script>

<template>
  <MainMenu
    @start-single-player="startSinglePlayer"
    @enter-multiplayer="enterMultiplayer"
  />
</template>
