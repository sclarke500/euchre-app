import { test, expect } from '@playwright/test'

test.describe('Klondike Solitaire', () => {
  test.beforeEach(async ({ page }) => {
    // Set a landscape viewport that will show the landscape layout
    await page.setViewportSize({ width: 1024, height: 768 })
    
    await page.goto('/')
    
    // Navigate to Klondike and start a game
    await page.locator('.game-tab', { hasText: 'Klondike' }).click()
    await page.locator('.menu-btn.single-player').click()
    
    // Wait for game board to load
    await expect(page.locator('.klondike-board')).toBeVisible({ timeout: 10000 })
  })

  test('can draw cards from stock', async ({ page }) => {
    // Target the visible stock pile (landscape layout at this viewport)
    const stockPile = page.locator('.landscape-layout .stock').or(page.locator('.portrait-layout:visible .stock'))
    await expect(stockPile.first()).toBeVisible()
    
    // Click stock to draw cards
    await stockPile.first().click()
    await page.waitForTimeout(300)
    
    // Waste pile should now have visible cards
    const wasteCard = page.locator('.waste-card:visible')
    await expect(wasteCard.first()).toBeVisible({ timeout: 5000 })
  })

  test('undo reverses a draw from stock', async ({ page }) => {
    // Get stock pile that's visible
    const stockPile = page.locator('.stock:visible').first()
    await expect(stockPile).toBeVisible()
    
    // Count initial visible waste cards (should be 0 at start)
    const initialWasteCount = await page.locator('.waste-card:visible').count()
    
    // Draw cards from stock
    await stockPile.click()
    await page.waitForTimeout(300)
    
    // Should have more cards in waste now
    const afterDrawWasteCount = await page.locator('.waste-card:visible').count()
    expect(afterDrawWasteCount).toBeGreaterThan(initialWasteCount)
    
    // Click undo button
    const undoButton = page.locator('button[title="Undo"]')
    await expect(undoButton).toBeVisible()
    await undoButton.click()
    await page.waitForTimeout(300)
    
    // Waste should be back to initial count
    const afterUndoWasteCount = await page.locator('.waste-card:visible').count()
    expect(afterUndoWasteCount).toBe(initialWasteCount)
  })

  test('undo reverses multiple draws', async ({ page }) => {
    const stockPile = page.locator('.stock:visible').first()
    const undoButton = page.locator('button[title="Undo"]')
    
    // In draw-3 mode, visible cards is always 0-3 regardless of total waste size
    // So we track state by checking move count instead
    const getMoveCount = async () => {
      const text = await page.getByText(/\d+ moves/).textContent()
      return parseInt(text?.match(/\d+/)?.[0] || '0')
    }
    
    // Initial state
    const initialMoves = await getMoveCount()
    const initialWasteCount = await page.locator('.waste-card:visible').count()
    expect(initialWasteCount).toBe(0) // Waste starts empty
    
    // Draw 3 times
    await stockPile.click()
    await page.waitForTimeout(200)
    expect(await getMoveCount()).toBe(initialMoves + 1)
    
    await stockPile.click()
    await page.waitForTimeout(200)
    expect(await getMoveCount()).toBe(initialMoves + 2)
    
    await stockPile.click()
    await page.waitForTimeout(200)
    expect(await getMoveCount()).toBe(initialMoves + 3)
    
    // Undo 3 times - should decrement move count each time
    await undoButton.click()
    await page.waitForTimeout(200)
    expect(await getMoveCount()).toBe(initialMoves + 2)
    
    await undoButton.click()
    await page.waitForTimeout(200)
    expect(await getMoveCount()).toBe(initialMoves + 1)
    
    await undoButton.click()
    await page.waitForTimeout(200)
    expect(await getMoveCount()).toBe(initialMoves)
    
    // And waste should be empty again
    expect(await page.locator('.waste-card:visible').count()).toBe(0)
  })

  test('move count increases on draw', async ({ page }) => {
    // Find the moves display in the toolbar
    const movesText = page.getByText(/\d+ moves/)
    await expect(movesText).toBeVisible()
    
    // Get initial move count
    const initialText = await movesText.textContent()
    const initialMoves = parseInt(initialText?.match(/\d+/)?.[0] || '0')
    
    // Draw from stock
    const stockPile = page.locator('.stock:visible').first()
    await stockPile.click()
    await page.waitForTimeout(300)
    
    // Move count should increase
    const afterText = await movesText.textContent()
    const afterMoves = parseInt(afterText?.match(/\d+/)?.[0] || '0')
    expect(afterMoves).toBe(initialMoves + 1)
  })
})
