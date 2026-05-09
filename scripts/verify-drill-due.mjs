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

// Seed states with some due-now items
await page.goto('http://127.0.0.1:4200/', { waitUntil: 'networkidle2' });
await page.waitForSelector('.btn--primary');
await page.evaluate(async () => {
  const open = indexedDB.open('schleifer');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
  const cards = await new Promise((res) => { const tx = db.transaction('cards', 'readonly').objectStore('cards').getAll(); tx.onsuccess = () => res(tx.result); });
  const now = Date.now();
  const dayMs = 86400000;
  const samples = cards.filter(c => ['tisch','frau','haus','jahr'].includes(c.nounId)).slice(0, 8);
  await new Promise((res) => {
    const tx = db.transaction('cardStates', 'readwrite');
    samples.forEach((c, i) => {
      tx.objectStore('cardStates').put({
        cardId: c.id,
        ease: 2.5,
        intervalDays: 1,
        reps: 1,
        lapses: 0,
        due: now - (i + 1) * dayMs, // all due in the past
        lastShownAt: now - (i + 2) * dayMs,
        lastResult: 'incorrect',
      });
    });
    tx.oncomplete = () => res();
  });
  db.close();
});

// Verify nav no longer has "Progress"
const navLabels = await page.$$eval('nav.nav a', els => els.map(e => e.textContent.trim()));
console.log('top-nav labels:', JSON.stringify(navLabels));

// Visit /progress via URL
await page.evaluate(() => { location.hash = '#/progress'; });
await page.waitForSelector('.timeline', { timeout: 10000 });
await new Promise(r => setTimeout(r, 600));

const dueBtnLabel = await page.$eval('.group-h-row .btn--primary', el => el.textContent.replace(/\s+/g,' ').trim());
console.log('drill button on Due Now:', dueBtnLabel);
await page.screenshot({ path: '/tmp/.verify/progress-with-drill.png' });

// Click it
await page.click('.group-h-row .btn--primary');
await page.waitForSelector('input.qinput', { timeout: 10000 });
const sessionTotal = await page.$eval('.quiz-bar__count', el => el.textContent.trim());
console.log('drilled session size (X / N):', sessionTotal);
await new Promise(r => setTimeout(r, 400));
await page.screenshot({ path: '/tmp/.verify/drill-session.png' });

// Then check home cards now show review times + the timeline link
await page.goto('http://127.0.0.1:4200/', { waitUntil: 'networkidle2' });
await page.waitForSelector('.col-card', { timeout: 10000 });
await new Promise(r => setTimeout(r, 600));
const homePillSample = await page.$eval(
  '.col-card .word-pill__times',
  el => el.textContent.replace(/\s+/g, ' ').trim(),
);
const cardLinkText = await page.$eval('.col-card .card-link', el => el.textContent.trim());
console.log('home pill times:', homePillSample);
console.log('card link:', cardLinkText);
await page.screenshot({
  path: '/tmp/.verify/home-with-times.png',
  clip: { x: 0, y: 0, width: 1280, height: 1100 },
});

await browser.close();
