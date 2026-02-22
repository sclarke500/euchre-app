import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

// Check if user has a nickname set
function hasNickname(): boolean {
  const nickname = localStorage.getItem('odusNickname')
  return !!nickname && nickname.trim().length >= 2
}

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
    beforeEnter: (to, _from, next) => {
      if (!hasNickname()) {
        // Redirect to home with a query param to show multiplayer intent
        next({ path: '/', query: { needsNickname: 'true', redirect: to.fullPath } })
      } else {
        next()
      }
    },
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
