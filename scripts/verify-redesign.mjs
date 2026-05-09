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

await page.goto('http://127.0.0.1:4200/', { waitUntil: 'networkidle2' });
await page.waitForSelector('.hero h1', { timeout: 15000 });
// Give fonts a moment to load
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: '/tmp/.verify/redesign-home.png', fullPage: true });
console.log('home screenshotted');

// Quiz card
await page.click('.btn--primary');
await page.waitForSelector('.qcard', { timeout: 10000 });
await new Promise(r => setTimeout(r, 600));
await page.screenshot({ path: '/tmp/.verify/redesign-quiz.png', fullPage: true });
console.log('quiz screenshotted');

// Submit wrong to see feedback
await page.type('input.qinput', 'totally-wrong');
await page.keyboard.press('Enter');
await page.waitForSelector('.feedback', { timeout: 5000 });
await new Promise(r => setTimeout(r, 600));
await page.screenshot({ path: '/tmp/.verify/redesign-feedback.png', fullPage: true });
console.log('feedback screenshotted');

// /rules
await page.evaluate(() => { location.hash = '#/rules'; });
await page.waitForSelector('.rule-card', { timeout: 10000 });
await new Promise(r => setTimeout(r, 600));
await page.screenshot({ path: '/tmp/.verify/redesign-rules.png', fullPage: true });
console.log('rules screenshotted');

// /data
await page.evaluate(() => { location.hash = '#/data'; });
await page.waitForSelector('.stat-strip', { timeout: 10000 });
await new Promise(r => setTimeout(r, 600));
await page.screenshot({ path: '/tmp/.verify/redesign-data.png', fullPage: true });
console.log('data screenshotted');

await browser.close();
