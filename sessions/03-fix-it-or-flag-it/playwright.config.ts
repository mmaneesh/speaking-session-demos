import { defineConfig, devices } from '@playwright/test';

// Two projects:
//   app        the shop's regression tests (page objects + fixtures). Must always be green.
//   scenarios  the four demo tests. Flat on purpose, red by design for 1, 3 and 4. See README.md.
export default defineConfig({
  outputDir: './test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3456',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'app',
      testDir: './tests',
      fullyParallel: true,
      timeout: 15_000,
      expect: { timeout: 5000 },
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // The loop reruns these, so they fail fast and never retry.
      name: 'scenarios',
      testDir: './scenarios',
      retries: 0,
      timeout: 6000,
      expect: { timeout: 2500 },
      use: { ...devices['Desktop Chrome'], actionTimeout: 2500 },
    },
  ],
  webServer: {
    command: 'npx tsx shop-app/server.ts',
    url: 'http://localhost:3456/cart',
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
