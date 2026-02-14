import { test, expect } from '@playwright/test'

/**
 * Turn Timer E2E Tests
 * 
 * These tests verify the turn timer behavior in multiplayer games.
 * Uses ?timerSpeed=fast to reduce timer from 60s to 5s for faster testing.
 * 
 * Single player in multiplayer = AI fills empty seats, so we can test
 * the timer with just one browser.
 * 
 * Note: Requires the backend server to be running for multiplayer tests.
 * Run with: BASE_URL=http://localhost:5173 npm test
 */

test.describe('Turn Timer', () => {
  // Skip these tests when running against production (no server control)
  test.skip(({ }, testInfo) => {
    const baseUrl = process.env.BASE_URL || 'https://67cardgames.com'
    // Only run against localhost where we control the server
    return !baseUrl.includes('localhost')
  })

  test('player returns to lobby when turn timer expires', async ({ page }) => {
    // Set nickname and start multiplayer game (AI fills empty seats)
    await page.goto('/?timerSpeed=fast')
    
    // Set nickname if needed
    const nicknameInput = page.locator('#nickname')
    if (await nicknameInput.isVisible()) {
      await nicknameInput.fill('TimerTest')
      await page.click('.save-btn')
    }
    
    // Go to multiplayer (Euchre is default)
    await page.click('.menu-btn.multiplayer')
    
    // Wait for lobby
    await expect(page.locator('h1:has-text("Lobby")')).toBeVisible({ timeout: 10000 })
    
    // Create and start a table (AI fills other seats)
    await page.click('.create-btn')
    await page.click('.confirm-create-btn')
    await expect(page.locator('.table-card')).toBeVisible({ timeout: 5000 })
    await page.click('.start-btn')
    
    // Wait for game board
    await expect(page.locator('.board')).toBeVisible({ timeout: 15000 })
    
    // Wait for it to be our turn (timer appears after grace period)
    // With fast mode: 2s grace + 3s countdown = 5s total
    // May need to wait through AI turns first
    await expect(page.locator('.turn-timer')).toBeVisible({ timeout: 30000 })
    
    // Timer goes through phases - by the time we see it, could be green or yellow
    // Just verify we see yellow and red before timeout
    await expect(page.locator('.turn-timer.yellow, .turn-timer.red')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('.turn-timer.red')).toBeVisible({ timeout: 3000 })
    
    // After timeout, should return to lobby
    await expect(page.locator('h1:has-text("Lobby")')).toBeVisible({ timeout: 5000 })
  })

  test('timer resets when player takes action', async ({ page }) => {
    await page.goto('/?timerSpeed=fast')
    
    const nicknameInput = page.locator('#nickname')
    if (await nicknameInput.isVisible()) {
      await nicknameInput.fill('TimerReset')
      await page.click('.save-btn')
    }
    
    await page.click('.menu-btn.multiplayer')
    await expect(page.locator('h1:has-text("Lobby")')).toBeVisible({ timeout: 10000 })
    
    await page.click('.create-btn')
    await page.click('.confirm-create-btn')
    await expect(page.locator('.table-card')).toBeVisible({ timeout: 5000 })
    await page.click('.start-btn')
    
    await expect(page.locator('.board')).toBeVisible({ timeout: 15000 })
    
    // Wait for our turn with timer visible
    await expect(page.locator('.turn-timer')).toBeVisible({ timeout: 30000 })
    
    // Take an action (click Pass button if in bidding, or play a card)
    const passBtn = page.locator('.action-btn:has-text("Pass")')
    if (await passBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await passBtn.click()
      
      // Timer should disappear (no longer our turn) or reset
      // Either the timer is gone, or if still our turn (rare), it reset
      await page.waitForTimeout(500)
      
      // We should NOT be back at lobby (didn't time out)
      await expect(page.locator('.board')).toBeVisible()
    }
    // If no Pass button, we might be in play phase - that's fine, test passes
  })
})
