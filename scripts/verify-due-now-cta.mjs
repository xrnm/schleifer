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

await page.goto('http://127.0.0.1:4200/', { waitUntil: 'networkidle2' });
await page.waitForSelector('.btn--primary');

// Seed 6 due-now states (overdue by 1-6 days)
await page.evaluate(async () => {
  const open = indexedDB.open('schleifer');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
  const cards = await new Promise((res) => { const tx = db.transaction('cards', 'readonly').objectStore('cards').getAll(); tx.onsuccess = () => res(tx.result); });
  const now = Date.now();
  const dayMs = 86400000;
  const samples = cards.filter(c => ['tisch','frau','haus'].includes(c.nounId)).slice(0, 6);
  await new Promise((res) => {
    const tx = db.transaction('cardStates', 'readwrite');
    samples.forEach((c, i) => {
      tx.objectStore('cardStates').put({
        cardId: c.id,
        ease: 2.5, intervalDays: 1, reps: 1, lapses: 0,
        due: now - (i + 1) * dayMs,
        lastShownAt: now - (i + 2) * dayMs,
        lastResult: 'incorrect',
      });
    });
    tx.oncomplete = () => res();
  });
  db.close();
});

// Reload home so the new states show in stats
await page.reload({ waitUntil: 'networkidle2' });
await page.waitForSelector('.col-card');
await new Promise(r => setTimeout(r, 500));

const dueBtn = await page.$$eval('.cta-row .btn', els => els.map(b => b.textContent.replace(/\s+/g,' ').trim()));
console.log('home cta-row buttons:', JSON.stringify(dueBtn));

const dueText = await page.$eval(
  '.col-card .word-pill__times .due-now, .col-card .word-pill__times span:nth-child(3)',
  el => el.textContent.replace(/\s+/g, ' ').trim(),
);
console.log('home due text:', dueText);

await page.screenshot({
  path: '/tmp/.verify/home-with-due-cta.png',
  clip: { x: 0, y: 0, width: 1280, height: 700 },
});

// Click "Drill due now"
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.cta-row .btn')].find(b => b.textContent.includes('drillen') || b.textContent.includes('Drill'));
  btn?.click();
});
await page.waitForSelector('input.qinput', { timeout: 10000 });
const drilledTotal = await page.$eval('.quiz-bar__count', el => el.textContent.trim());
console.log('drilled session size:', drilledTotal);

await browser.close();
