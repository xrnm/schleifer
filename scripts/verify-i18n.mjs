import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 900 });

await page.goto('http://127.0.0.1:4200/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.deleteDatabase('schleifer');
  r.onsuccess = r.onerror = r.onblocked = () => res();
}));
// Also clear localStorage so we get the default lang
await page.evaluate(() => localStorage.clear());

await page.goto('http://127.0.0.1:4200/', { waitUntil: 'networkidle2' });
await page.waitForSelector('button.primary.big', { timeout: 15000 });
await page.screenshot({ path: '/tmp/.verify/home-de.png', fullPage: true });

const homeDe = await page.evaluate(() => ({
  brand: document.querySelector('.brand')?.innerText,
  startBtn: document.querySelector('button.primary.big')?.innerText,
  lead: document.querySelector('.lead p')?.innerText,
  inProgressHeading: document.querySelectorAll('.info-card h2')[0]?.innerText,
  recentlyMissedHeading: document.querySelectorAll('.info-card h2')[1]?.innerText,
  langActive: document.querySelector('.lang-label.active')?.innerText,
}));
console.log('home (de default):', JSON.stringify(homeDe, null, 2));

// Toggle to English
await page.click('.lang-slider .track');
await new Promise(r => setTimeout(r, 100));
await page.screenshot({ path: '/tmp/.verify/home-en.png', fullPage: true });
const homeEn = await page.evaluate(() => ({
  startBtn: document.querySelector('button.primary.big')?.innerText,
  lead: document.querySelector('.lead p')?.innerText,
  langActive: document.querySelector('.lang-label.active')?.innerText,
}));
console.log('home (en after toggle):', JSON.stringify(homeEn, null, 2));

// Verify it persists across reload
await page.reload({ waitUntil: 'networkidle2' });
await page.waitForSelector('button.primary.big');
const persistedLang = await page.evaluate(() => document.querySelector('.lang-label.active')?.innerText);
console.log('lang after reload:', persistedLang);

// Toggle back to DE for the rest
await page.click('.lang-slider .track');
await new Promise(r => setTimeout(r, 100));

// Visit /rules
await page.evaluate(() => { location.hash = '#/rules'; });
await page.waitForSelector('section.rule', { timeout: 10000 });
const rulesPage = await page.evaluate(() => ({
  title: document.querySelector('h1')?.innerText,
  firstRuleHeader: document.querySelector('section.rule h2')?.innerText,
  firstRuleTitle: document.querySelector('section.rule .rule-title')?.innerText,
  firstRuleExpected: document.querySelector('section.rule .expected')?.innerText,
  firstRuleFeedback: document.querySelector('section.rule .feedback-msg')?.innerText,
}));
console.log('rules (de):', JSON.stringify(rulesPage, null, 2));
await page.screenshot({ path: '/tmp/.verify/rules-de.png' });

// /data
await page.evaluate(() => { location.hash = '#/data'; });
await page.waitForSelector('ul.counts', { timeout: 10000 });
const dataPage = await page.evaluate(() => ({
  title: document.querySelector('h1')?.innerText,
  exportBtn: document.querySelector('button.primary')?.innerText,
  wipeBtn: document.querySelector('button.danger')?.innerText,
}));
console.log('data (de):', JSON.stringify(dataPage, null, 2));

// Force a session card and look at session UI strings
await page.evaluate(async () => {
  const open = indexedDB.open('schleifer');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
  const sessionId = 'test-i18n-session';
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
const sessionShell = await page.evaluate(() => ({
  endSessionBtn: [...document.querySelectorAll('.session-head button')].map(b => b.innerText.trim()),
  submitBtn: [...document.querySelectorAll('.actions button')].map(b => b.innerText.trim()),
  placeholder: document.querySelector('input[name="answer"]')?.placeholder,
}));
console.log('session shell (de):', JSON.stringify(sessionShell, null, 2));

await page.type('input[name="answer"]', 'totally-wrong');
await page.keyboard.press('Enter');
await page.waitForSelector('.feedback', { timeout: 5000 });
const feedback = await page.evaluate(() => ({
  resultLine: document.querySelector('.result-line')?.innerText,
  answer: document.querySelector('.expected')?.innerText,
  nominativ: document.querySelector('.nominative')?.innerText,
  rule: document.querySelector('.rule-note')?.innerText,
  next: document.querySelector('.actions button.primary')?.innerText,
}));
console.log('session feedback (de):', JSON.stringify(feedback, null, 2));
await page.screenshot({ path: '/tmp/.verify/session-de.png' });

await browser.close();
