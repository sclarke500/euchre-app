import { test, expect, type Page } from '@playwright/test'

const LAYOUT_SMOKE_PATH = '/dev/layout'

/** Navigate to an empty CardTable (dev smoke) or start Euchre SP as fallback. */
async function gotoLayoutBoard(page: Page): Promise<void> {
  const baseURL = process.env.BASE_URL || 'https://67cardgames.com'
  const canUseSmoke = baseURL.includes('localhost') || baseURL.includes('127.0.0.1')

  if (canUseSmoke) {
    await page.goto(LAYOUT_SMOKE_PATH)
    await expect(page.locator('.card-table-root')).toBeVisible({ timeout: 15000 })
    return
  }

  await page.goto('/')
  await page.locator('.game-card', { hasText: 'Euchre' }).click()
  await page.locator('.menu-btn.single-player').click()
  await expect(page.locator('.card-table-root')).toBeVisible({ timeout: 15000 })
}

async function waitForLayoutStable(page: Page): Promise<void> {
  await page.locator('.table-surface').waitFor({ state: 'visible' })
  // Let ScaledContainer + CardTable finish initial layout passes
  await page.waitForTimeout(400)
}

test.describe('Layout matrix', () => {
  test('table surface renders at current viewport', async ({ page }, testInfo) => {
    await gotoLayoutBoard(page)
    await waitForLayoutStable(page)

    const board = page.locator('.card-table-root')
    await expect(board).toBeVisible()

    await expect(board).toHaveScreenshot(`layout-${testInfo.project.name}.png`, {
      maxDiffPixelRatio: 0.03,
      animations: 'disabled',
    })
  })

  test('orientation change re-layouts table', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'desktop-chrome' || testInfo.project.name === 'ipad-landscape',
      'Orientation test targets phone-class viewports'
    )

    await gotoLayoutBoard(page)
    await waitForLayoutStable(page)

    const portrait = page.viewportSize()
    if (!portrait) return

    const landscape = { width: Math.max(portrait.width, portrait.height), height: Math.min(portrait.width, portrait.height) }
    await page.setViewportSize(landscape)
    await waitForLayoutStable(page)

    await expect(page.locator('.card-table-root')).toHaveScreenshot(
      `layout-${testInfo.project.name}-landscape.png`,
      { maxDiffPixelRatio: 0.03, animations: 'disabled' }
    )
  })
})