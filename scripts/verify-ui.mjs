import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4317');
  await page.locator('.card').first().waitFor();
  const source = page.locator('#sources .source').first();
  const sourceName = await source.getAttribute('data-source');
  await source.click();
  assert((await page.locator('#result-count').textContent()).includes(sourceName));
  await page.locator('#all-sources').click();
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 740]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `artifacts/gallery-${width}.png`, fullPage: false });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`);
  }
  await page.getByLabel('Search images').fill('nothing-matches-this-123456');
  await page.getByText('No matching images').waitFor();
  await page.getByLabel('Search images').fill('');
  await page.locator('.card button').first().click();
  await page.locator('dialog[open]').waitFor();
  assert(await page.locator('#original').getAttribute('href'));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Favorites', exact: true }).click();
  await page.getByText('No matching images').waitFor();
  await page.getByRole('button', { name: 'All photos', exact: true }).click();
  await page.locator('.favorite').first().click();
  await page.getByRole('button', { name: 'Favorites', exact: true }).click();
  assert.equal(await page.locator('.card').count(), 1);
  await page.reload();
  await page.getByRole('button', { name: 'Favorites', exact: true }).click();
  assert.equal(await page.locator('.card').count(), 1);
  await page.locator('.favorite').first().click();
  await page.getByText('No matching images').waitFor();
  await page.route('**/api/library', route => route.fulfill({ status: 500, body: 'failed' }));
  await page.reload();
  await page.getByText('Could not load the library. Reload to try again.').waitFor();
  await page.unroute('**/api/library');
  await page.route('**/api/library', route => route.fulfill({ contentType: 'application/json', body: '{"images":[],"sources":[]}' }));
  await page.reload();
  await page.getByText('Your library is empty').waitFor();
  await page.unroute('**/api/library');
  await page.route('**/api/library', async route => {
    await new Promise(resolve => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('#gallery').getAttribute('aria-busy'), 'true');
  await page.locator('.card').first().waitFor();
  assert.deepEqual(errors, []);
  console.log('UI verified: wide/narrow layouts, search, preview, favorites persistence, empty/error states.');
} finally { await browser.close(); }
