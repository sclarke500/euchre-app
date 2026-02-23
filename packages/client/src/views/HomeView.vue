<script setup lang="ts">
import { useRouter } from 'vue-router'
import MainMenu, { type GameType } from '@/components/MainMenu.vue'

const router = useRouter()

function startSinglePlayer(game: GameType) {
  router.push(`/play/${game}`)
}

function enterMultiplayer(game: GameType) {
  // Go to lobby (game selection happens in lobby)
  router.push({ name: 'lobby' })
}
</script>

<template>
  <MainMenu
    @start-single-player="startSinglePlayer"
    @enter-multiplayer="enterMultiplayer"
  />
</template>
