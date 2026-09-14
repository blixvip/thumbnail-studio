import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// A separate disposable browser: never connects to or closes a user's browser.
const requested = process.argv[2];
const sources = JSON.parse(await readFile('sources.json', 'utf8')).filter(source => !requested || source.name === requested);
await mkdir('data/captures', { recursive: true });
await mkdir('data/captures/media', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const source of sources) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const images = new Map();
    const pending = [];
    page.on('response', response => {
      if (response.request().resourceType() === 'image' && response.ok()) {
        images.set(response.url(), { url: response.url(), alt: '' });
        pending.push((async () => {
          try {
            const body = await response.body();
            if (body.length > 25 * 1024 * 1024) return;
            const hash = createHash('sha256').update(response.url()).digest('hex');
            await writeFile(`data/captures/media/${hash}.bin`, body);
          } catch { /* Importer will attempt a normal HTTPS download. */ }
        })());
      }
    });
    try {
      await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.locator('body').waitFor();
      let stable = 0;
      let previous = 0;
      for (let step = 0; step < 60 && stable < 4; step++) {
        await page.evaluate(() => window.scrollBy(0, 850));
        await page.waitForTimeout(250);
        const bottom = await page.evaluate(() => window.scrollY + innerHeight >= document.documentElement.scrollHeight - 8);
        stable = bottom && images.size === previous ? stable + 1 : 0;
        previous = images.size;
      }
      const domImages = await page.evaluate(() => [...document.images].flatMap(img => {
        const candidates = [img.currentSrc, img.src, img.getAttribute('data-src')];
        const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
        if (srcset) candidates.push(...srcset.split(',').map(x => x.trim().split(/\s+/)[0]));
        return candidates.filter(Boolean).map(url => ({ url: new URL(url, location.href).href, alt: img.alt }));
      }));
      for (const item of domImages) if (item.url.startsWith('https:')) images.set(item.url, item);
      await Promise.allSettled(pending);
      const result = { source, images: [...images.values()], html: await page.content(), capturedAt: new Date().toISOString() };
      await writeFile(`data/captures/${new URL(source.url).hostname}.json`, JSON.stringify(result));
      console.log(`${source.name}: ${images.size} image URLs captured`);
    } catch (error) {
      console.error(`${source.name}: ${error.message.split('\n')[0]}`);
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
