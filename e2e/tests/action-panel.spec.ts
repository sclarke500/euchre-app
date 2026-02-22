import { test, expect } from '@playwright/test'

test.describe('Action Panel Styling', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto('/')
  })

  test('action panel has subtle glow on user turn (Euchre)', async ({ page }) => {
    // Start a Euchre game
    await page.locator('.game-card', { hasText: 'Euchre' }).click()
    await page.locator('.menu-btn.single-player').click()
    
    // Wait for the action panel to appear (bidding phase)
    const actionPanel = page.locator('.action-panel-container')
    await expect(actionPanel).toBeVisible({ timeout: 10000 })
    
    // Get the computed box-shadow style
    const boxShadow = await actionPanel.evaluate((el) => {
      return window.getComputedStyle(el).boxShadow
    })
    
    // Should have a gold glow (rgba with gold color ~255, 215, 0)
    // But it should be subtle (small spread, low opacity)
    expect(boxShadow).toContain('rgba')
    
    // Verify the glow size is reasonable (not too large)
    // The CSS vars set --panel-glow-size: 10px, --panel-glow-size-pulse: 16px
    // Box-shadow spread should be in that range
    const shadowMatch = boxShadow.match(/(\d+)px\s+rgba/)
    if (shadowMatch) {
      const glowSize = parseInt(shadowMatch[1])
      expect(glowSize).toBeLessThanOrEqual(20) // Should be subtle, not blaring
    }
  })

  test('action panel has subtle glow on user turn (President)', async ({ page }) => {
    // Start a President game
    await page.locator('.game-card', { hasText: 'President' }).click()
    await page.locator('.menu-btn.single-player').click()
    
    // Wait for game to load and action panel to appear
    const actionPanel = page.locator('.action-panel-container')
    await expect(actionPanel).toBeVisible({ timeout: 10000 })
    
    // Get the computed box-shadow style
    const boxShadow = await actionPanel.evaluate((el) => {
      return window.getComputedStyle(el).boxShadow
    })
    
    // Should have a glow effect
    expect(boxShadow).not.toBe('none')
    expect(boxShadow).toContain('rgba')
  })

  test('CSS variables for panel glow are set correctly', async ({ page }) => {
    await page.goto('/')
    
    // Check the CSS custom properties on :root
    const cssVars = await page.evaluate(() => {
      const root = document.documentElement
      const style = getComputedStyle(root)
      return {
        glowColor: style.getPropertyValue('--panel-glow-color').trim(),
        glowSize: style.getPropertyValue('--panel-glow-size').trim(),
        glowSizePulse: style.getPropertyValue('--panel-glow-size-pulse').trim(),
      }
    })
    
    // Verify glow is subtle (10px base, 16px pulse)
    expect(cssVars.glowSize).toBe('10px')
    expect(cssVars.glowSizePulse).toBe('16px')
    
    // Verify color is gold-ish with low opacity (0.3 or .3)
    expect(cssVars.glowColor).toContain('255')  // red component of gold
    expect(cssVars.glowColor).toMatch(/\.3\)?$/)  // opacity ends with .3 or .3)
  })
})
