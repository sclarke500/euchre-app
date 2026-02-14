import { test, expect, Browser, Page } from '@playwright/test'

/**
 * Turn Timer E2E Tests
 * 
 * These tests verify the turn timer behavior in multiplayer games.
 * Uses ?timerSpeed=fast to reduce timer from 60s to 5s for faster testing.
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

  test.describe('Euchre multiplayer timeout', () => {
    test('player is returned to lobby when turn timer expires', async ({ browser }) => {
      // Create two browser contexts (two players)
      const context1 = await browser.newContext()
      const context2 = await browser.newContext()
      const player1 = await context1.newPage()
      const player2 = await context2.newPage()

      try {
        // Player 1: Set nickname and create a table
        await player1.goto('/?timerSpeed=fast')
        await player1.fill('#nickname', 'TestPlayer1')
        await player1.click('.save-btn')
        await player1.click('.game-tab:has-text("Euchre")')
        await player1.click('.menu-btn.multiplayer')
        
        // Wait for lobby to load
        await expect(player1.locator('h1:has-text("Lobby")')).toBeVisible({ timeout: 10000 })
        
        // Create a table
        await player1.click('.create-btn')
        await player1.click('.confirm-create-btn')
        
        // Wait for table card to appear
        await expect(player1.locator('.table-card')).toBeVisible({ timeout: 5000 })

        // Player 2: Join the same table
        await player2.goto('/?timerSpeed=fast')
        await player2.fill('#nickname', 'TestPlayer2')
        await player2.click('.save-btn')
        await player2.click('.game-tab:has-text("Euchre")')
        await player2.click('.menu-btn.multiplayer')
        
        // Wait for lobby
        await expect(player2.locator('h1:has-text("Lobby")')).toBeVisible({ timeout: 10000 })
        
        // Join the table (click an empty seat)
        await player2.click('.seat.empty.clickable')
        
        // Player 1 (host): Start the game
        await player1.click('.start-btn')
        
        // Both players should see the game board
        await expect(player1.locator('.board')).toBeVisible({ timeout: 15000 })
        await expect(player2.locator('.board')).toBeVisible({ timeout: 15000 })
        
        // Find which player's turn it is and let them time out
        // The turn timer should appear after 2s grace period (fast mode)
        // and count down for 3s, total 5s
        
        // Wait for turn timer to appear on one of the players
        const p1HasTimer = await player1.locator('.turn-timer').isVisible({ timeout: 3000 }).catch(() => false)
        const p2HasTimer = await player2.locator('.turn-timer').isVisible({ timeout: 3000 }).catch(() => false)
        
        const activePlayer = p1HasTimer ? player1 : p2
        const playerName = p1HasTimer ? 'TestPlayer1' : 'TestPlayer2'
        
        // If neither has timer yet, wait for it (might be during dealing animation)
        if (!p1HasTimer && !p2HasTimer) {
          // Wait for either to get the timer
          await Promise.race([
            player1.locator('.turn-timer').waitFor({ timeout: 10000 }),
            player2.locator('.turn-timer').waitFor({ timeout: 10000 })
          ])
        }
        
        // Wait for the timer to turn yellow (warning phase)
        const timerPage = p1HasTimer ? player1 : player2
        await expect(timerPage.locator('.turn-timer.yellow')).toBeVisible({ timeout: 4000 })
        
        // Wait for the timer to turn red
        await expect(timerPage.locator('.turn-timer.red')).toBeVisible({ timeout: 3000 })
        
        // Wait for timeout and return to lobby
        // After timeout, player should be back at lobby
        await expect(timerPage.locator('h1:has-text("Lobby")')).toBeVisible({ timeout: 8000 })
        
      } finally {
        await context1.close()
        await context2.close()
      }
    })
  })

  test.describe('Timer visual states', () => {
    test('timer shows green, yellow, red phases', async ({ browser }) => {
      // This test just verifies the timer phases work - doesn't need full game
      const context1 = await browser.newContext()
      const context2 = await browser.newContext()
      const player1 = await context1.newPage()
      const player2 = await context2.newPage()

      try {
        // Quick setup - just need to get into a game where timer is visible
        await player1.goto('/?timerSpeed=fast')
        await player1.fill('#nickname', 'TimerTest1')
        await player1.click('.save-btn')
        await player1.click('.menu-btn.multiplayer')
        await expect(player1.locator('h1:has-text("Lobby")')).toBeVisible({ timeout: 10000 })
        await player1.click('.create-btn')
        await player1.click('.confirm-create-btn')
        await expect(player1.locator('.table-card')).toBeVisible({ timeout: 5000 })

        await player2.goto('/?timerSpeed=fast')
        await player2.fill('#nickname', 'TimerTest2')
        await player2.click('.save-btn')
        await player2.click('.menu-btn.multiplayer')
        await expect(player2.locator('h1:has-text("Lobby")')).toBeVisible({ timeout: 10000 })
        await player2.click('.seat.empty.clickable')
        await player1.click('.start-btn')
        
        // Wait for game to start
        await expect(player1.locator('.board')).toBeVisible({ timeout: 15000 })
        
        // Find the player with the timer
        await player1.waitForTimeout(3000) // Wait for deal + grace period
        
        const timerPage = await player1.locator('.turn-timer').isVisible() ? player1 : player2
        
        // Timer should start green
        await expect(timerPage.locator('.turn-timer.green')).toBeVisible({ timeout: 1000 })
        
        // Should transition to yellow
        await expect(timerPage.locator('.turn-timer.yellow')).toBeVisible({ timeout: 3000 })
        
        // Should transition to red
        await expect(timerPage.locator('.turn-timer.red')).toBeVisible({ timeout: 3000 })
        
      } finally {
        await context1.close()
        await context2.close()
      }
    })
  })
})
