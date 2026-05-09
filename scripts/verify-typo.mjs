import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 600 });

await page.goto('http://127.0.0.1:4200/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.deleteDatabase('schleifer');
  r.onsuccess = r.onerror = r.onblocked = () => res();
}));
await page.goto('http://127.0.0.1:4200/', { waitUntil: 'networkidle2' });
await page.waitForSelector('button.primary.big');
await page.click('button.primary.big');
await page.waitForSelector('.prompt-line');

// Look up correct answer for the current card.
const expected = await page.evaluate(async () => {
  const noun = document.querySelector('.noun-text').textContent.trim();
  const meta = document.querySelector('.prompt-meta').textContent.trim();
  const tags = meta.split('·').map(s => s.trim());
  const map = { Nominativ: 'nom', Akkusativ: 'acc', Dativ: 'dat', Singular: 'sg', Plural: 'pl', bestimmt: 'def', unbestimmt: 'indef' };
  const c = map[tags[0]], n = map[tags[1]], a = map[tags[2]];
  const open = indexedDB.open('schleifer');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
  const nouns = await new Promise((res, rej) => { const tx = db.transaction('nouns', 'readonly').objectStore('nouns').getAll(); tx.onsuccess = () => res(tx.result); tx.onerror = () => rej(tx.error); });
  const cards = await new Promise((res, rej) => { const tx = db.transaction('cards', 'readonly').objectStore('cards').getAll(); tx.onsuccess = () => res(tx.result); tx.onerror = () => rej(tx.error); });
  db.close();
  for (const m of nouns.filter(x => x.singular === noun)) {
    const f = cards.find(card => card.nounId === m.id && card.case === c && card.number === n && card.articleType === a);
    if (f) return f.expected;
  }
  return null;
});
console.log('expected:', expected);

// Construct a one-letter-off variant: drop the last char of the noun.
const typoAnswer = expected.slice(0, -1);
console.log('typing typo:', typoAnswer);
await page.type('input[name="answer"]', typoAnswer);
await page.click('button[type="submit"]');
await page.waitForSelector('.feedback', { timeout: 5000 });
const cls = await page.$eval('.feedback', el => el.className);
const resultLine = await page.$eval('.result-line', el => el.textContent.trim());
const noteEl = await page.$('.typo-note');
const noteText = noteEl ? await noteEl.evaluate(el => el.textContent.trim()) : null;
console.log('feedback class:', cls);
console.log('result line:', resultLine);
console.log('typo-note:', noteText);
await page.screenshot({ path: '/tmp/.verify/typo-feedback.png' });

// Verify activity event recorded with typo: true
const lastEv = await page.evaluate(async () => {
  const open = indexedDB.open('schleifer');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
  const evs = await new Promise((res, rej) => { const tx = db.transaction('events', 'readonly').objectStore('events').getAll(); tx.onsuccess = () => res(tx.result); tx.onerror = () => rej(tx.error); });
  db.close();
  return evs[evs.length - 1];
});
console.log('last event:', JSON.stringify(lastEv, null, 2));

await browser.close();
