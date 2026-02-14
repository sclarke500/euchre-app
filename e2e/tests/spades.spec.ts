import { test, expect } from '@playwright/test'

test.describe('Spades', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto('/')
  })

  test('Spades tab appears in main menu', async ({ page }) => {
    await expect(page.locator('.game-tab', { hasText: 'Spades' })).toBeVisible()
  })

  test('can start single player Spades game', async ({ page }) => {
    // Select Spades tab
    await page.locator('.game-tab', { hasText: 'Spades' }).click()
    
    // Start single player
    await page.locator('.menu-btn.single-player').click()
    
    // Should see game board with cards
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 10000 })
  })

  test('bidding phase shows bid selector', async ({ page }) => {
    await page.locator('.game-tab', { hasText: 'Spades' }).click()
    await page.locator('.menu-btn.single-player').click()
    
    // Should see bidding UI (bid selector with numbers 0-13)
    // The exact selector depends on implementation
    await expect(
      page.locator('[class*="bid"]').or(page.getByText(/Bid:/i))
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows team scores', async ({ page }) => {
    await page.locator('.game-tab', { hasText: 'Spades' }).click()
    await page.locator('.menu-btn.single-player').click()
    
    // Should display scores for both teams
    await expect(page.getByText(/Team|Score/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('spades are always trump', async ({ page }) => {
    // This is more of a game logic test, but we can verify
    // the UI shows spades as trump or doesn't have trump selection
    await page.locator('.game-tab', { hasText: 'Spades' }).click()
    await page.locator('.menu-btn.single-player').click()
    
    // Should NOT have trump selection (unlike Euchre)
    // After game loads, there shouldn't be a "call trump" or "order up" UI
    await page.waitForTimeout(2000) // Let game settle
    await expect(page.getByText(/call trump/i)).not.toBeVisible()
    await expect(page.getByText(/order up/i)).not.toBeVisible()
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
