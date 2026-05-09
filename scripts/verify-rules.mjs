import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 900 });

await page.goto('http://127.0.0.1:4200/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.deleteDatabase('schleifer');
  r.onsuccess = r.onerror = r.onblocked = () => res();
}));
await page.goto('http://127.0.0.1:4200/', { waitUntil: 'networkidle2' });
await page.waitForSelector('button.primary.big');

// Visit /rules page (hash router → href is "#/rules")
await page.evaluate(() => { location.hash = '#/rules'; });
await page.waitForSelector('section.rule', { timeout: 10000 });
const ruleCount = await page.$$eval('section.rule', els => els.length);
const firstRuleTitle = await page.$eval('section.rule .rule-title', el => el.innerText.trim());
const rule18Catalog = await page.evaluate(() => {
  const sections = [...document.querySelectorAll('section.rule')];
  const r18 = sections.find(s => s.querySelector('h2')?.innerText === 'Rule 18');
  if (!r18) return null;
  const items = [...r18.querySelectorAll('.catalog-matches li')].map(li => li.innerText.trim());
  return items;
});
console.log('rules rendered:', ruleCount);
console.log('first rule:', firstRuleTitle);
console.log('rule 18 catalog matches:', rule18Catalog);
await page.screenshot({ path: '/tmp/.verify/rules-page.png', fullPage: true });

// Now seed a session targeting a noun with a rule (e.g. Tisch).
await page.goto('http://127.0.0.1:4200/', { waitUntil: 'networkidle2' });
// Inject a synthetic session containing only a Tisch card so we can deterministically test the rule note.
await page.evaluate(async () => {
  const open = indexedDB.open('schleifer');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
  const sessionId = 'test-session-rules';
  await new Promise((res) => {
    const tx = db.transaction(['sessions','meta'], 'readwrite');
    tx.objectStore('sessions').put({
      id: sessionId, startedAt: Date.now(), endedAt: null,
      targetCount: 1, presented: 0, correct: 0, incorrect: 0, idk: 0, skipped: 0,
    });
    tx.objectStore('meta').put({ key: `session:${sessionId}:cards`, value: ['tisch|sg|nom|def'] });
    tx.oncomplete = () => res();
  });
  db.close();
  location.hash = `#/session/${sessionId}`;
});
await page.waitForSelector('input[name="answer"]', { timeout: 10000 });
await page.type('input[name="answer"]', 'totally-wrong');
await page.keyboard.press('Enter');
await page.waitForSelector('.feedback', { timeout: 5000 });
const ruleNote = await page.evaluate(() => {
  const note = document.querySelector('.rule-note');
  return note ? note.innerText.trim() : null;
});
console.log('rule note on Tisch miss:', ruleNote);
await page.screenshot({ path: '/tmp/.verify/feedback-with-rule.png' });

await browser.close();
