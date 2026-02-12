import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    // Default to live site, override with BASE_URL=http://localhost:5173 for local
    baseURL: process.env.BASE_URL || 'https://67cardgames.com',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer config - run against live site by default
  // For local dev: start server manually, then run BASE_URL=http://localhost:5173 npm test
})
