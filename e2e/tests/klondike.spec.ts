import { test, expect } from '@playwright/test'

test.describe('Klondike Solitaire', () => {
  test.beforeEach(async ({ page }) => {
    // Set a portrait viewport (most phones)
    await page.setViewportSize({ width: 390, height: 844 })
    
    await page.goto('/')
    
    // Navigate to Klondike and start a game
    await page.locator('.game-tab', { hasText: 'Klondike' }).click()
    await page.locator('.menu-btn.single-player').click()
    
    // Wait for game board to load
    await expect(page.locator('.klondike-board')).toBeVisible({ timeout: 10000 })
  })

  test('deals tableau cards on start', async ({ page }) => {
    // Tableau has 28 cards (7 columns: 1+2+3+4+5+6+7)
    // Stock cards are NOT in the card layer (shown in stock slot)
    const cards = page.locator('.klondike-card')
    await expect(cards).toHaveCount(28, { timeout: 5000 })
    
    // 7 should be face-up (one per tableau column)
    const faceUpCards = page.locator('.klondike-card.face-up')
    await expect(faceUpCards).toHaveCount(7)
    
    // 21 should be face-down (in tableau)
    const faceDownCards = page.locator('.klondike-card.face-down')
    await expect(faceDownCards).toHaveCount(21)
    
    // Stock slot should show a card back (indicating cards are there)
    const stockCardBack = page.locator('.stock-slot .card-back')
    await expect(stockCardBack.first()).toBeVisible()
  })

  test('can draw cards from stock', async ({ page }) => {
    // Get initial face-up count (7 from tableau)
    const initialFaceUp = await page.locator('.klondike-card.face-up').count()
    expect(initialFaceUp).toBe(7)
    
    // Click stock slot to draw cards
    const stockSlot = page.locator('.stock-slot').first()
    await stockSlot.click()
    await page.waitForTimeout(300)
    
    // After draw, we should have more face-up cards (waste cards are face-up)
    const afterDrawFaceUp = await page.locator('.klondike-card.face-up').count()
    expect(afterDrawFaceUp).toBeGreaterThan(initialFaceUp)
  })

  test('undo reverses a draw from stock', async ({ page }) => {
    // Get initial face-up count
    const initialFaceUp = await page.locator('.klondike-card.face-up').count()
    
    // Draw from stock
    const stockSlot = page.locator('.stock-slot').first()
    await stockSlot.click()
    await page.waitForTimeout(300)
    
    // Should have more face-up cards now
    const afterDrawFaceUp = await page.locator('.klondike-card.face-up').count()
    expect(afterDrawFaceUp).toBeGreaterThan(initialFaceUp)
    
    // Click undo button
    const undoButton = page.locator('button[title="Undo"]')
    await undoButton.click()
    await page.waitForTimeout(300)
    
    // Should be back to initial
    const afterUndoFaceUp = await page.locator('.klondike-card.face-up').count()
    expect(afterUndoFaceUp).toBe(initialFaceUp)
  })

  test('move count increases on draw', async ({ page }) => {
    // Find the moves display in the toolbar
    const movesText = page.getByText(/\d+ moves/)
    await expect(movesText).toBeVisible()
    
    // Get initial move count
    const initialText = await movesText.textContent()
    const initialMoves = parseInt(initialText?.match(/\d+/)?.[0] || '0')
    
    // Draw from stock
    const stockSlot = page.locator('.stock-slot').first()
    await stockSlot.click()
    await page.waitForTimeout(300)
    
    // Move count should increase
    const afterText = await movesText.textContent()
    const afterMoves = parseInt(afterText?.match(/\d+/)?.[0] || '0')
    expect(afterMoves).toBe(initialMoves + 1)
  })
})
