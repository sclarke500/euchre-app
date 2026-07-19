import { test, expect } from '@playwright/test'

test.describe('Spades', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto('/play')
  })

  test('Spades card appears in main menu', async ({ page }) => {
    await expect(page.locator('.game-card', { hasText: 'Spades' })).toBeVisible()
  })

  test('can start single player Spades game', async ({ page }) => {
    await page.locator('.game-card', { hasText: 'Spades' }).click()
    await expect(page).toHaveURL(/\/play\/spades/)
    await expect(page.locator('.spades-scoreboard')).toBeVisible({ timeout: 15000 })
  })

  test('bidding phase shows bid selector', async ({ page }) => {
    await page.locator('.game-card', { hasText: 'Spades' }).click()
    await expect(page).toHaveURL(/\/play\/spades/)
    // Bid wheel after deal animation
    await expect(
      page.locator('.bid-selector, .bid-wheel, [class*="bid"]').first()
    ).toBeVisible({ timeout: 15000 })
  })

  test('shows team scores', async ({ page }) => {
    await page.locator('.game-card', { hasText: 'Spades' }).click()
    await expect(page.locator('.score-label', { hasText: 'Us' })).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.score-label', { hasText: 'Them' })).toBeVisible({ timeout: 15000 })
  })

  test('spades board has no euchre trump UI', async ({ page }) => {
    await page.locator('.game-card', { hasText: 'Spades' }).click()
    await expect(page).toHaveURL(/\/play\/spades/)
    await expect(page.locator('.spades-scoreboard')).toBeVisible({ timeout: 15000 })
    // Board loaded — Euchre bid chrome should not be present
    await expect(page.locator('.order-up, .call-trump')).toHaveCount(0)
  })
})

test.describe('Spades Scoring', () => {
  // These tests verify the scoring logic by playing through scenarios
  // They may need adjustment based on actual UI implementation
  
  test.skip('making bid gives 10 points per trick bid', async ({ page }) => {
    // TODO: Implement when we can simulate a full round
  })

  test.skip('nil bid gives +100 when successful', async ({ page }) => {
    // TODO: Implement when we can simulate nil bidding
  })

  test.skip('bags accumulate and penalize at 10', async ({ page }) => {
    // TODO: Implement when we can simulate multiple rounds
  })
})
