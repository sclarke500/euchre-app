import { test, expect } from '@playwright/test'

/**
 * App menu lives at /play (marketing landing is /).
 * Game cards start single-player immediately on click.
 */
test.describe('Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/play')
  })

  test('app menu loads with game cards', async ({ page }) => {
    await expect(page.locator('.logo-url')).toBeVisible()
    await expect(page.locator('.game-card', { hasText: 'Euchre' })).toBeVisible()
    await expect(page.locator('.game-card', { hasText: 'President' })).toBeVisible()
    await expect(page.locator('.game-card', { hasText: 'Spades' })).toBeVisible()
    await expect(page.locator('.game-card', { hasText: 'Klondike' })).toBeVisible()
  })

  test('can start a single player Euchre game', async ({ page }) => {
    await page.locator('.game-card', { hasText: 'Euchre' }).click()
    await expect(page).toHaveURL(/\/play\/euchre/)
    await expect(page.locator('.main-menu')).not.toBeVisible({ timeout: 10000 })
    await expect(
      page.locator('.table-surface, [class*="board"], [class*="card"]').first()
    ).toBeVisible({ timeout: 15000 })
  })

  test('can start a single player President game', async ({ page }) => {
    await page.locator('.game-card', { hasText: 'President' }).click()
    await expect(page).toHaveURL(/\/play\/president/)
    await expect(page.locator('.main-menu')).not.toBeVisible({ timeout: 10000 })
    await expect(
      page.locator('.table-surface, [class*="board"], [class*="card"]').first()
    ).toBeVisible({ timeout: 15000 })
  })

  test('can start a single player Spades game', async ({ page }) => {
    await page.locator('.game-card', { hasText: 'Spades' }).click()
    await expect(page).toHaveURL(/\/play\/spades/)
    await expect(page.locator('.main-menu')).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator('.spades-scoreboard')).toBeVisible({ timeout: 15000 })
  })

  test('can start a Klondike game', async ({ page }) => {
    await page.locator('.game-card', { hasText: 'Klondike' }).click()
    await expect(page).toHaveURL(/\/play\/klondike/)
    await expect(page.locator('.main-menu')).not.toBeVisible({ timeout: 10000 })
    await expect(
      page.locator('.klondike-layout, .klondike-board, [class*="klondike"]').first()
    ).toBeVisible({ timeout: 15000 })
  })

  test('settings modal opens', async ({ page }) => {
    await page.locator('.settings-btn').click()
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
    // Game sections visible in settings
    await expect(page.getByRole('heading', { name: 'Euchre', level: 2 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bots', level: 2 })).toBeVisible()
  })
})
