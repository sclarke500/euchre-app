import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/play/:game',
    name: 'play',
    component: () => import('@/views/PlayView.vue'),
    props: true,
  },
  {
    path: '/lobby/:code?',
    name: 'lobby',
    component: () => import('@/views/LobbyView.vue'),
    props: true,
  },
  {
    path: '/game/:gameType/:gameId',
    name: 'game',
    component: () => import('@/views/GameView.vue'),
    props: true,
  },
  // Catch-all redirect to home
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
