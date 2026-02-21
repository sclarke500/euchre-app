import { test, expect } from '@playwright/test'

async function clickStockByTopmostTarget(page: Parameters<typeof test>[0]['page']) {
  const stockSlot = page.locator('.stock-slot').first()
  const box = await stockSlot.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.click(
    box!.x + box!.width / 2,
    box!.y + box!.height / 2
  )
}

test.describe('Klondike Solitaire', () => {
  test.beforeEach(async ({ page }) => {
    // Set a landscape viewport (required for game board)
    await page.setViewportSize({ width: 844, height: 390 })
    
    await page.goto('/')
    
    // Navigate to Klondike and start a game
    await page.locator('.game-card', { hasText: 'Klondike' }).click()
    await page.locator('.menu-btn.single-player').click()
    
    // Wait for game board to load
    await expect(page.locator('.klondike-board')).toBeVisible({ timeout: 10000 })
  })

  test('deals tableau cards on start', async ({ page }) => {
    // Tableau has 28 cards (7 columns: 1+2+3+4+5+6+7)
    // Plus extra stock cards rendered in card layer for draw animation.
    const cards = page.locator('.klondike-card')
    await expect(cards).toHaveCount(31, { timeout: 5000 })
    
    // 7 should be face-up (one per tableau column)
    const faceUpCards = page.locator('.klondike-card.face-up')
    await expect(faceUpCards).toHaveCount(7)
    
    // Face-down includes tableau backs plus rendered stock cards.
    const faceDownCards = page.locator('.klondike-card.face-down')
    await expect(faceDownCards).toHaveCount(24)
  })

  test('can draw cards from stock', async ({ page }) => {
    // Wait for deal animation to complete (7 face-up cards in tableau)
    await expect(page.locator('.klondike-card.face-up')).toHaveCount(7, { timeout: 5000 })
    
    // Click stock area (topmost element receives click)
    await clickStockByTopmostTarget(page)
    await page.waitForTimeout(500)
    
    // After draw, we should have more face-up cards (waste cards are face-up)
    const afterDrawFaceUp = await page.locator('.klondike-card.face-up').count()
    expect(afterDrawFaceUp).toBeGreaterThan(7)
  })

  test('undo reverses a draw from stock', { retries: 2 }, async ({ page }) => {
    // Wait for deal animation to complete (7 face-up cards in tableau)
    await expect(page.locator('.klondike-card.face-up')).toHaveCount(7, { timeout: 5000 })
    
    // Draw from stock
    const movesText = page.getByText(/\d+ moves/)
    const initialText = await movesText.textContent()
    const initialMoves = parseInt(initialText?.match(/\d+/)?.[0] || '0')

    await clickStockByTopmostTarget(page)
    await page.waitForTimeout(500)
    
    // Should have more face-up cards now (draw adds waste cards)
    const afterDrawFaceUp = await page.locator('.klondike-card.face-up').count()
    expect(afterDrawFaceUp).toBeGreaterThan(7)
    
    // Wait for undo button to become enabled
    const undoButton = page.locator('button[title="Undo"]:not(.disabled)')
    await expect(undoButton).toBeVisible({ timeout: 2000 })
    await undoButton.click()
    
    // Wait for undo animation and state update
    await page.waitForTimeout(800)
    
    // Undo should return move count to initial value
    const afterUndoText = await movesText.textContent()
    const afterUndoMoves = parseInt(afterUndoText?.match(/\d+/)?.[0] || '0')
    expect(afterUndoMoves).toBe(initialMoves)
  })

  test('move count increases on draw', async ({ page }) => {
    // Find the moves display in the toolbar
    const movesText = page.getByText(/\d+ moves/)
    await expect(movesText).toBeVisible()
    
    // Get initial move count
    const initialText = await movesText.textContent()
    const initialMoves = parseInt(initialText?.match(/\d+/)?.[0] || '0')
    
    // Draw from stock
    await clickStockByTopmostTarget(page)
    await page.waitForTimeout(300)
    
    // Move count should increase
    const afterText = await movesText.textContent()
    const afterMoves = parseInt(afterText?.match(/\d+/)?.[0] || '0')
    expect(afterMoves).toBe(initialMoves + 1)
  })

  test('clicking stock area always draws even with card layer on top', async ({ page }) => {
    // Wait for initial deal stabilization
    await expect(page.locator('.klondike-card.face-up')).toHaveCount(7, { timeout: 5000 })

    const movesText = page.getByText(/\d+ moves/)
    const initialText = await movesText.textContent()
    const initialMoves = parseInt(initialText?.match(/\d+/)?.[0] || '0')

    const stockSlot = page.locator('.stock-slot').first()
    const box = await stockSlot.boundingBox()
    expect(box).not.toBeNull()

    // Click by page coordinates so the topmost element receives the event
    await page.mouse.click(
      box!.x + box!.width / 2,
      box!.y + box!.height / 2
    )

    await page.waitForTimeout(600)

    const afterText = await movesText.textContent()
    const afterMoves = parseInt(afterText?.match(/\d+/)?.[0] || '0')
    expect(afterMoves).toBe(initialMoves + 1)
  })
})
