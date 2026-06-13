import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { isNativeApp } from '@/utils/native'

// Check if user has a nickname set
function hasNickname(): boolean {
  const nickname = localStorage.getItem('odusNickname')
  return !!nickname && nickname.trim().length >= 2
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'landing',
    component: () => import('@/views/LandingView.vue'),
  },
  {
    path: '/play',
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
    path: '/lobby/create',
    name: 'create-game',
    component: () => import('@/views/CreateGameView.vue'),
    beforeEnter: (to, _from, next) => {
      if (!hasNickname()) {
        next({ path: '/play', query: { needsNickname: 'true', redirect: to.fullPath } })
      } else {
        next()
      }
    },
  },
  {
    path: '/lobby/:code?',
    name: 'lobby',
    component: () => import('@/views/LobbyView.vue'),
    props: true,
    beforeEnter: (to, _from, next) => {
      if (!hasNickname()) {
        // Redirect to app menu with a query param to show multiplayer intent
        next({ path: '/play', query: { needsNickname: 'true', redirect: to.fullPath } })
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
  {
    path: '/privacy',
    name: 'privacy',
    component: () => import('@/views/PrivacyView.vue'),
  },
  {
    path: '/support',
    name: 'support',
    component: () => import('@/views/SupportView.vue'),
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
  // SPAs don't reset scroll on navigation by default. Scroll to top on a new
  // navigation; restore the previous position on back/forward.
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

// In the native app, skip the marketing landing page and go straight to the
// game menu. (The web build keeps the landing page at '/'.)
router.beforeEach((to) => {
  if (isNativeApp() && to.name === 'landing') {
    return { name: 'home' }
  }
})

export default router
