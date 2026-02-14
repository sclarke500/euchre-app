import { test, expect } from '@playwright/test'

test.describe('Spades Multiplayer Smoke', () => {
  test('host can create a spades table and start a multiplayer game', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    await page.goto('/')

    await page.locator('.game-tab', { hasText: 'Spades' }).click()

    const nicknameInput = page.locator('#nickname')
    if (await nicknameInput.isVisible()) {
      await nicknameInput.fill('SpadesHost')
      await page.locator('.save-btn').click()
    }

    await page.locator('.menu-btn.multiplayer').click()

    await expect(page.locator('.lobby-header')).toBeVisible({ timeout: 15000 })

    await page.locator('.create-btn').click()
    await expect(page.locator('.create-options')).toBeVisible()

    await page.locator('.game-type-btn', { hasText: 'Spades' }).click()
    await page.locator('.confirm-create-btn').click()

    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })

    await page.locator('.start-btn').click()

    await expect(page.locator('.spades-scoreboard')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.action-panel')).toBeVisible({ timeout: 10000 })

    await expect
      .poll(() => pageErrors, { timeout: 20000 })
      .toEqual([])
  })
})
