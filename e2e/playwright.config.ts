import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.BASE_URL || 'https://67cardgames.com'
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(baseURL)

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  // Chromium + explicit viewports (avoids WebKit install; tests layout math not browser engine)
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'iphone-se-landscape',
      use: { ...devices['Desktop Chrome'], viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'iphone-15-pro-landscape',
      use: { ...devices['Desktop Chrome'], viewport: { width: 852, height: 393 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'pixel-7-landscape',
      use: { ...devices['Desktop Chrome'], viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'ipad-landscape',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 } },
    },
  ],
  webServer: isLocal
    ? {
        command: 'npm run dev',
        url: baseURL,
        cwd: '..',
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
})