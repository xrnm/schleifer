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
await page.waitForSelector('.tabs button.is-active', { timeout: 15000 });
await new Promise(r => setTimeout(r, 1000));

const labels = await page.$$eval('.tabs button', els => els.map(b => ({
  text: b.textContent.trim(),
  active: b.classList.contains('is-active'),
})));
console.log('tab labels:', JSON.stringify(labels));

await page.screenshot({ path: '/tmp/.verify/tabs-cases.png', fullPage: false });

// Click each tab and screenshot
for (const id of ['articles', 'adjectives', 'gender', 'cases']) {
  await page.evaluate((tabId) => {
    const btns = [...document.querySelectorAll('.tabs button')];
    const map = ['cases','articles','adjectives','gender'];
    const idx = map.indexOf(tabId);
    btns[idx]?.click();
  }, id);
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: `/tmp/.verify/tabs-${id}.png` });
  const heading = await page.evaluate(() => {
    const el = document.querySelector('.tabpanel h2, .tabpanel .rule-card h4');
    return el?.textContent.trim();
  });
  console.log(`tab=${id} first heading: ${heading}`);
}

// Test keyboard navigation
await page.focus('.tabs button.is-active');
await page.keyboard.press('ArrowLeft');
await new Promise(r => setTimeout(r, 200));
const afterArrow = await page.$eval('.tabs button.is-active', el => el.textContent.trim());
console.log('after ArrowLeft from cases (should wrap):', afterArrow);

// Test persistence
await page.evaluate(() => { localStorage.setItem('schleifer.rulesTab', 'adjectives'); });
await page.reload({ waitUntil: 'networkidle2' });
await page.waitForSelector('.tabs button.is-active');
const persisted = await page.$eval('.tabs button.is-active', el => el.textContent.trim());
console.log('persisted tab after reload:', persisted);

await browser.close();
