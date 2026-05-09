import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1024 });

await page.goto('http://127.0.0.1:4200/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.deleteDatabase('schleifer');
  r.onsuccess = r.onerror = r.onblocked = () => res();
}));
await page.evaluate(() => localStorage.clear());

await page.goto('http://127.0.0.1:4200/#/rules', { waitUntil: 'networkidle2' });
await page.waitForSelector('.case-tables', { timeout: 15000 });
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: '/tmp/.verify/rules-with-tables.png' });
// Also a top-of-page tight crop for clarity
const topRect = await page.evaluate(() => {
  const el = document.querySelector('.case-tables');
  const r = el.getBoundingClientRect();
  return { x: r.left, y: window.scrollY + r.top, w: r.width, h: Math.min(800, r.height) };
});
await page.screenshot({
  path: '/tmp/.verify/rules-tables-top.png',
  clip: { x: topRect.x - 20, y: topRect.y - 20, width: topRect.w + 40, height: topRect.h + 40 },
});
console.log('rules with case tables screenshotted');

const numTables = await page.$$eval('.case-tables__body .ct-table', els => els.length);
console.log('tables rendered:', numTables);

await browser.close();
