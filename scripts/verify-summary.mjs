import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 900 });

await page.goto('http://127.0.0.1:4200/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.deleteDatabase('schleifer');
  r.onsuccess = r.onerror = r.onblocked = () => res();
}));
await page.goto('http://127.0.0.1:4200/', { waitUntil: 'networkidle2' });
await page.waitForSelector('button.primary.big');
await page.click('button.primary.big');
await page.waitForSelector('input[name="answer"]');

// Look up expected answer for current card via IndexedDB.
async function expected() {
  return page.evaluate(async () => {
    const noun = document.querySelector('.noun-text').textContent.trim();
    const tags = [...document.querySelectorAll('.prompt-meta')][0].textContent.trim().split('·').map(s => s.trim()).filter(Boolean);
    const map = { Nominativ: 'nom', Akkusativ: 'acc', Dativ: 'dat', Singular: 'sg', Plural: 'pl', bestimmt: 'def', unbestimmt: 'indef' };
    const c = map[tags[0]], n = map[tags[1]], a = map[tags[2]];
    const open = indexedDB.open('schleifer');
    const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
    const nouns = await new Promise((res) => { const tx = db.transaction('nouns', 'readonly').objectStore('nouns').getAll(); tx.onsuccess = () => res(tx.result); });
    const cards = await new Promise((res) => { const tx = db.transaction('cards', 'readonly').objectStore('cards').getAll(); tx.onsuccess = () => res(tx.result); });
    db.close();
    for (const m of nouns.filter(x => x.singular === noun)) {
      const f = cards.find(card => card.nounId === m.id && card.case === c && card.number === n && card.articleType === a);
      if (f) return f.expected;
    }
    return null;
  });
}

// Run 50 cards. Alternate: correct, wrong, idk, correct, ... etc.
const total = 50;
for (let i = 0; i < total; i++) {
  await page.waitForSelector('.prompt-line', { timeout: 5000 });
  const exp = await expected();
  const mode = i % 4;
  if (mode === 0) {
    await page.keyboard.type(exp);
    await page.keyboard.press('Enter');
  } else if (mode === 1) {
    await page.keyboard.type('totally-wrong');
    await page.keyboard.press('Enter');
  } else if (mode === 2) {
    // I don't know — click the button
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.actions button')].find(x => x.textContent.trim().toLowerCase().includes("don't"));
      b?.click();
    });
  } else {
    // Type a typo (1 char short of expected noun) — should still be correct
    const typo = exp.slice(0, -1);
    await page.keyboard.type(typo);
    await page.keyboard.press('Enter');
  }
  // Wait for feedback then advance
  await page.waitForSelector('.feedback', { timeout: 5000 });
  await page.keyboard.press('Enter');
  // Wait either for next card or for summary
  await page.waitForFunction(() => {
    const summary = document.querySelector('.summary');
    const noText = document.querySelector('.noun-text');
    return summary || (noText && !document.querySelector('.feedback'));
  }, { timeout: 5000 });
  if (await page.$('.summary')) break;
}

await page.waitForSelector('.summary', { timeout: 10000 });
const stats = await page.$eval('.summary-stats', el => el.innerText.replace(/\s+/g, ' ').trim());
const correctCount = await page.$$eval('.ok-h', els => els[0]?.innerText || 'none');
const missedCount = await page.$$eval('.bad-h', els => els[0]?.innerText || 'none');
const correctRows = await page.$$eval('.summary h2.ok-h + .answer-list li', els => els.length);
const missedRows = await page.$$eval('.summary h2.bad-h + .answer-list li', els => els.length);
console.log('stats:', stats);
console.log('correct heading:', correctCount, '— rows:', correctRows);
console.log('missed heading:', missedCount, '— rows:', missedRows);

await page.screenshot({ path: '/tmp/.verify/summary-top.png' });

// Confirm the focused element is the back button so Enter goes home.
const focused = await page.evaluate(() => ({ tag: document.activeElement.tagName, text: document.activeElement.innerText }));
console.log('focus on summary:', focused);

// Press Enter — should navigate home.
await page.keyboard.press('Enter');
await page.waitForFunction(() => !!document.querySelector('button.primary.big'), { timeout: 5000 });
console.log('returned to home OK');

await browser.close();
