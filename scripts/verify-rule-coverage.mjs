import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 800 });

await page.goto('http://127.0.0.1:4200/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.deleteDatabase('schleifer');
  r.onsuccess = r.onerror = r.onblocked = () => res();
}));
await page.goto('http://127.0.0.1:4200/', { waitUntil: 'networkidle2' });
await page.waitForSelector('button.primary.big');

// 1. Count how many catalog nouns now have ruleIds.
const stats = await page.evaluate(async () => {
  const open = indexedDB.open('schleifer');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
  const nouns = await new Promise((res) => { const tx = db.transaction('nouns', 'readonly').objectStore('nouns').getAll(); tx.onsuccess = () => res(tx.result); });
  db.close();
  const total = nouns.length;
  const tagged = nouns.filter(n => Array.isArray(n.ruleIds) && n.ruleIds.length > 0);
  const samples = tagged.slice(0, 6).map(n => ({ singular: n.singular, gender: n.gender, ruleIds: n.ruleIds }));
  return { total, tagged: tagged.length, samples };
});
console.log(`catalog: ${stats.tagged}/${stats.total} nouns have ruleIds`);
console.log('samples:', JSON.stringify(stats.samples, null, 2));

// 2. Force a session that includes a rule-tagged noun (Wohnung → rule 1, feminine).
const { sessionId } = await page.evaluate(async () => {
  const open = indexedDB.open('schleifer');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
  const nouns = await new Promise((res) => { const tx = db.transaction('nouns', 'readonly').objectStore('nouns').getAll(); tx.onsuccess = () => res(tx.result); });
  const target = nouns.find(n => n.singular === 'Wohnung');
  const cardId = `${target.id}|sg|acc|def`;
  const sessionId = 'test-rule-cov';
  await new Promise((res) => {
    const tx = db.transaction(['sessions','meta'], 'readwrite');
    tx.objectStore('sessions').put({
      id: sessionId, startedAt: Date.now(), endedAt: null,
      targetCount: 1, presented: 0, correct: 0, incorrect: 0, idk: 0, skipped: 0,
    });
    tx.objectStore('meta').put({ key: `session:${sessionId}:cards`, value: [cardId] });
    tx.oncomplete = () => res();
  });
  db.close();
  return { sessionId };
});

await page.evaluate((id) => { location.hash = `#/session/${id}`; }, sessionId);
await page.waitForSelector('input[name="answer"]', { timeout: 10000 });
await page.type('input[name="answer"]', 'totally-wrong');
await page.keyboard.press('Enter');
await page.waitForSelector('.feedback', { timeout: 5000 });
const ruleNote = await page.evaluate(() => {
  const note = document.querySelector('.rule-note');
  return note ? note.innerText.trim() : null;
});
console.log('Wohnung miss → rule note:', ruleNote);
await page.screenshot({ path: '/tmp/.verify/feedback-wohnung.png' });

await browser.close();
