#!/usr/bin/env node
/**
 * Probe the DEPLOYED app (Cloudflare Pages) for the sign-card submission API.
 * Local curl is sandbox-blocked, so fetch the deployed JS via Playwright.
 * Usage: node tools/probe-deployed-sign.js
 */
const { chromium } = require('@playwright/test');
const { BASE_URL } = require('../helpers/env');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const files = ['js/sign-card.js', 'js/real-game-nav.js', 'js/card-submit.js'];
  for (const f of files) {
    const url = `${BASE_URL}/${f}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const text = await page.evaluate(() => document.body ? document.body.innerText : '');
      console.log(`\n=== ${url} (${text.length} chars) ===`);
      console.log('  submitSignature occurrences:', (text.match(/submitSignature/g) || []).length);
      console.log('  submitCard occurrences:', (text.match(/submitCard/g) || []).length);
      if (text.includes('submitSignature')) {
        const i = text.indexOf('submitSignature');
        console.log('  context:', text.slice(Math.max(0, i - 80), i + 60).replace(/\n/g, ' '));
      }
    } catch (e) {
      console.log(`\n=== ${url} === ERROR: ${e.message}`);
    }
  }
  await browser.close();
})();
