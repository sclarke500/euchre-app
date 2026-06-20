/**
 * Single source of truth for which layout/render path a route uses.
 * See docs/PLATFORM_CONTRACT.md.
 */
import { computed, type ComputedRef } from 'vue'
import { useRoute } from 'vue-router'
import { isMobile } from '@/utils/deviceMode'

export type AppRenderMode =
  | 'canonical'      // ScaledContainer + board viewport (trick-taking games, lobby, MP)
  | 'responsive-shell' // Full-viewport CSS (main menu)
  | 'scrollable'     // Marketing / legal docs
  | 'solitaire'      // Klondike — own layout engine

export const SCROLLABLE_ROUTE_NAMES = ['landing', 'privacy', 'support'] as const
export const FULLSCREEN_ROUTE_NAMES = ['home'] as const
export const LANDSCAPE_ROUTE_PREFIXES = ['/play/', '/lobby', '/game'] as const
export const SOLITAIRE_PATH = '/play/klondike'

export function getAppRenderMode(path: string, routeName?: string | symbol | null): AppRenderMode {
  if (path === '/' || SCROLLABLE_ROUTE_NAMES.includes(routeName as (typeof SCROLLABLE_ROUTE_NAMES)[number])) {
    return 'scrollable'
  }
  if (FULLSCREEN_ROUTE_NAMES.includes(routeName as (typeof FULLSCREEN_ROUTE_NAMES)[number])) {
    return 'responsive-shell'
  }
  if (path === SOLITAIRE_PATH || path.startsWith(`${SOLITAIRE_PATH}/`)) {
    return 'solitaire'
  }
  return 'canonical'
}

export function routeUsesScaledContainer(mode: AppRenderMode): boolean {
  return mode === 'canonical'
}

export function routeRequiresLandscape(path: string): boolean {
  if (!isMobile()) return false
  if (path === SOLITAIRE_PATH || path.startsWith(`${SOLITAIRE_PATH}/`)) return false
  return LANDSCAPE_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix))
}

export interface AppRenderModeState {
  mode: ComputedRef<AppRenderMode>
  useScaledContainer: ComputedRef<boolean>
  isScrollable: ComputedRef<boolean>
  isResponsiveShell: ComputedRef<boolean>
  isCanonical: ComputedRef<boolean>
  isSolitaire: ComputedRef<boolean>
  requiresLandscape: ComputedRef<boolean>
}

export function useAppRenderMode(): AppRenderModeState {
  const route = useRoute()

  const mode = computed(() => getAppRenderMode(route.path, route.name))
  const useScaledContainer = computed(() => routeUsesScaledContainer(mode.value))
  const isScrollable = computed(() => mode.value === 'scrollable')
  const isResponsiveShell = computed(() => mode.value === 'responsive-shell')
  const isCanonical = computed(() => mode.value === 'canonical')
  const isSolitaire = computed(() => mode.value === 'solitaire')
  const requiresLandscape = computed(() => routeRequiresLandscape(route.path))

  return {
    mode,
    useScaledContainer,
    isScrollable,
    isResponsiveShell,
    isCanonical,
    isSolitaire,
    requiresLandscape,
  }
}