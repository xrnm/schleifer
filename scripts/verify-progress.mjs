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

// Seed some realistic cardStates spanning all three buckets
await page.goto('http://127.0.0.1:4200/', { waitUntil: 'networkidle2' });
await page.waitForSelector('button.primary, button.btn--primary');
await page.evaluate(async () => {
  const open = indexedDB.open('schleifer');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
  const cards = await new Promise((res) => { const tx = db.transaction('cards', 'readonly').objectStore('cards').getAll(); tx.onsuccess = () => res(tx.result); });
  const now = Date.now();
  const dayMs = 86400000;
  // Take a handful of cards and put them into states across all buckets
  const samples = cards.filter(c => ['tisch','frau','haus','auto','jahr','wohnung','tag','arbeit','zeit','fall','recht','land'].includes(c.nounId));
  const updates = [];
  for (let i = 0; i < samples.length; i++) {
    const c = samples[i];
    const dueOffset = i < 4 ? -(i+1) * dayMs : (i < 8 ? (i-3) * dayMs : (10 + i) * dayMs);
    const lastShown = now - (i + 1) * dayMs;
    updates.push({
      cardId: c.id,
      ease: 2.5 + (i % 3) * 0.05,
      intervalDays: Math.max(1, i),
      reps: i % 5,
      lapses: i % 3,
      due: now + dueOffset,
      lastShownAt: lastShown,
      lastResult: ['correct','correct','incorrect','idk','correct'][i % 5],
    });
  }
  await new Promise((res) => {
    const tx = db.transaction('cardStates', 'readwrite');
    for (const u of updates) tx.objectStore('cardStates').put(u);
    tx.oncomplete = () => res();
  });
  db.close();
});

await page.evaluate(() => { location.hash = '#/progress'; });
await page.waitForSelector('.timeline', { timeout: 10000 });
await new Promise(r => setTimeout(r, 1000));

const stats = await page.$$eval('.stat-strip__num', els => els.map(e => e.textContent.trim()));
const groups = await page.$$eval('.group-h', els => els.map(e => e.textContent.replace(/\s+/g,' ').trim()));
const sampleRow = await page.$eval('.row', el => el.innerText.replace(/\s+/g, ' ').trim());
console.log('stats:', JSON.stringify(stats));
console.log('groups:', JSON.stringify(groups));
console.log('sample row:', sampleRow);

await page.screenshot({ path: '/tmp/.verify/progress-top.png' });

await browser.close();
