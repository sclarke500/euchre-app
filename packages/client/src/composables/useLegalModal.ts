import { ref } from 'vue'

/**
 * Global state for the in-app Support/Privacy popup.
 *
 * In-app entry points (Settings, menu footer) open these as an overlay instead
 * of navigating to the /support or /privacy routes, so closing returns the user
 * exactly where they were (e.g. with the Settings modal still open) rather than
 * dumping them on the marketing home page. The routes still exist for direct
 * URLs (App Store support URL, marketing links).
 */
export type LegalPage = 'privacy' | 'support'

// Module-level singleton — shared across every component that imports this.
const activePage = ref<LegalPage | null>(null)

export function useLegalModal() {
  return {
    activePage,
    openLegal: (page: LegalPage) => {
      activePage.value = page
    },
    close: () => {
      activePage.value = null
    },
  }
}
