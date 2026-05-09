import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1100 });

await page.goto('http://127.0.0.1:4200/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.deleteDatabase('schleifer');
  r.onsuccess = r.onerror = r.onblocked = () => res();
}));
await page.evaluate(() => localStorage.clear());

await page.goto('http://127.0.0.1:4200/#/rules', { waitUntil: 'networkidle2' });
await page.waitForSelector('.pinned-section', { timeout: 15000 });
await new Promise(r => setTimeout(r, 1500));

const pinnedTitles = await page.$$eval('.pinned-section h2', els => els.map(e => e.textContent.trim()));
const collapsedSummaries = await page.$$eval('.more-section > summary', els => els.map(e => e.textContent.trim()));
console.log('pinned at top:', JSON.stringify(pinnedTitles));
console.log('collapsibles:', JSON.stringify(collapsedSummaries));

await page.screenshot({ path: '/tmp/.verify/rules-restructured.png', fullPage: true });

// Tight crop of just the top
const rect = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.pinned-section')];
  if (els.length === 0) return null;
  const first = els[0].getBoundingClientRect();
  const last = els[els.length - 1].getBoundingClientRect();
  return { x: first.left, y: window.scrollY + first.top, w: first.width, h: last.bottom - first.top };
});
if (rect) {
  await page.screenshot({
    path: '/tmp/.verify/rules-pinned-top.png',
    clip: { x: rect.x - 20, y: rect.y - 60, width: rect.w + 40, height: rect.h + 80 },
  });
}

await browser.close();
