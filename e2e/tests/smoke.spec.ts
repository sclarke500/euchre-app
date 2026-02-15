import { test, expect } from '@playwright/test'

test.describe('Smoke Tests', () => {
  test('home page loads with main menu', async ({ page }) => {
    await page.goto('/')
    
    // Should show the site branding
    await expect(page.locator('text=67CardGames.com')).toBeVisible()
    
    // Should have game selection cards
    await expect(page.locator('.game-card', { hasText: 'Euchre' })).toBeVisible()
    await expect(page.locator('.game-card', { hasText: 'President' })).toBeVisible()
    await expect(page.locator('.game-card', { hasText: 'Klondike' })).toBeVisible()
  })

  test('can start a single player Euchre game', async ({ page }) => {
    await page.goto('/')
    
    // Click Euchre card
    await page.locator('.game-card', { hasText: 'Euchre' }).click()
    
    // Start single player game
    await page.locator('.menu-btn.single-player').click()
    
    // Should show the game board (wait for cards to appear)
    await expect(page.locator('[class*="card"]').first()).toBeVisible({ timeout: 10000 })
  })

  test('can start a single player President game', async ({ page }) => {
    await page.goto('/')
    
    // Select President card
    await page.locator('.game-card', { hasText: 'President' }).click()
    
    // Start single player
    await page.locator('.menu-btn.single-player').click()
    
    // Should show the game board
    await expect(page.locator('[class*="card"]').first()).toBeVisible({ timeout: 10000 })
  })

  test('can start a Klondike game', async ({ page }) => {
    await page.goto('/')
    
    // Select Klondike card
    await page.locator('.game-card', { hasText: 'Klondike' }).click()
    
    // Start game
    await page.locator('.menu-btn.single-player').click()
    
    // Should show the game board (Klondike has piles, tableau, etc.)
    // The main-menu should be gone, replaced by game board
    await expect(page.locator('.main-menu')).not.toBeVisible({ timeout: 10000 })
  })

  test('settings modal opens', async ({ page }) => {
    await page.goto('/')
    
    // Click settings button (gear icon in top-right)
    await page.locator('.settings-btn').click()
    
    // Settings modal should appear with heading
    await expect(page.locator('.modal-content h2', { hasText: 'Settings' })).toBeVisible()
    
    // Should have AI difficulty section
    await expect(page.locator('text=AI Difficulty')).toBeVisible()
  })
})
