import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1000 });

await page.goto('http://127.0.0.1:4200/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.deleteDatabase('schleifer');
  r.onsuccess = r.onerror = r.onblocked = () => res();
}));
await page.goto('http://127.0.0.1:4200/', { waitUntil: 'networkidle2' });
await page.waitForSelector('button.primary.big');

// Run a quick session of ~6 cards mixing right/wrong/idk to seed state.
await page.click('button.primary.big');
await page.waitForSelector('input[name="answer"]');

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

// Drive 6 cards
for (let i = 0; i < 6; i++) {
  const exp = await expected();
  const mode = i % 3;
  if (mode === 0) {
    await page.keyboard.type(exp);
    await page.keyboard.press('Enter');
  } else if (mode === 1) {
    await page.keyboard.type('totally-wrong');
    await page.keyboard.press('Enter');
  } else {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.actions button')].find(x => x.textContent.trim().toLowerCase().includes("don't"));
      b?.click();
    });
  }
  await page.waitForSelector('.feedback', { timeout: 5000 });
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 80));
}

// End the session manually
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.session-head button')].find(x => x.textContent.includes('End'));
  b?.click();
});
await page.waitForSelector('.summary', { timeout: 5000 });
// Click Back to home
await page.click('button.primary');
await page.waitForSelector('.session-list', { timeout: 5000 });
await page.screenshot({ path: '/tmp/.verify/home-with-session.png', fullPage: true });

const sessionRows = await page.$$eval('.session-list li', els => els.length);
const inProgress = await page.$$eval('.info-card:nth-of-type(1) .word-list li', els => els.length);
const recentMissed = await page.$$eval('.info-card:nth-of-type(2) .word-list li', els => els.length);
console.log('home shows', sessionRows, 'sessions,', inProgress, 'in-progress,', recentMissed, 'recently-missed');

// Click the first session to view its summary
await page.click('.session-list li');
await page.waitForSelector('.summary', { timeout: 5000 });
const summaryStats = await page.$eval('.summary-stats', el => el.innerText.replace(/\s+/g, ' ').trim());
console.log('opened past summary:', summaryStats);
await page.screenshot({ path: '/tmp/.verify/past-summary.png', fullPage: true });

await browser.close();
