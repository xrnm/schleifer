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
await page.screenshot({ path: '/tmp/.verify/prompt-line-card.png' });
console.log('CARD:', await page.$eval('.prompt-line', el => el.innerText.replace(/\s+/g, ' ').trim()));

// Test Enter-to-advance after feedback.
const noun1 = await page.$eval('.noun-text', el => el.textContent.trim());
await page.type('input[name="answer"]', 'wrong');
await page.click('button[type="submit"]');
await page.waitForSelector('.feedback', { timeout: 5000 });
console.log('FEEDBACK SHOWN');

// Press Enter — should advance without clicking.
await page.keyboard.press('Enter');
await page.waitForFunction((prev) => {
  const t = document.querySelector('.noun-text');
  const fb = document.querySelector('.feedback');
  return t && t.textContent.trim() !== prev && !fb;
}, { timeout: 5000 }, noun1);
const noun2 = await page.$eval('.noun-text', el => el.textContent.trim());
console.log(`ENTER ADVANCED: ${noun1} -> ${noun2}`);
await page.screenshot({ path: '/tmp/.verify/prompt-line-after-enter.png' });

await browser.close();
