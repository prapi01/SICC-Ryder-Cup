// @ts-check
const { defineConfig } = require('@playwright/test');
const path = require('path');

/**
 * Phase 1 config.
 * - Workers=1: Suite B shares ONE game across 4 browser contexts (F1/F2/V1/V2),
 *   so tests must run serially.
 * - HEADED=1 → headed mode (Step Runner usage); default headless (assert suite).
 */
module.exports = defineConfig({
  testDir: path.join(__dirname, 'specs'),
  timeout: 150000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }]
  ],
  use: {
    headless: process.env.HEADED ? false : true,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
});
