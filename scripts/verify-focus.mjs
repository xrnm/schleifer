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
await page.waitForSelector('input[name="answer"]');

async function activeTagAndAttrs() {
  return page.evaluate(() => {
    const a = document.activeElement;
    return { tag: a?.tagName, name: a?.getAttribute('name'), text: a?.innerText?.slice(0, 20) };
  });
}

console.log('after start:', await activeTagAndAttrs());

// Type wrong answer and submit (Enter key on the input).
await page.keyboard.type('wrong');
await page.keyboard.press('Enter');
await page.waitForSelector('.feedback', { timeout: 5000 });
console.log('after submit:', await activeTagAndAttrs());

// Press Enter to advance — should land focus back on the input.
const noun1 = await page.$eval('.noun-text', el => el.textContent.trim());
await page.keyboard.press('Enter');
await page.waitForFunction((prev) => {
  const t = document.querySelector('.noun-text');
  const fb = document.querySelector('.feedback');
  return t && t.textContent.trim() !== prev && !fb;
}, { timeout: 5000 }, noun1);
// Give setTimeout(0) a moment to fire
await new Promise(r => setTimeout(r, 100));
console.log('after enter-advance:', await activeTagAndAttrs());

// Verify we can fully drive without mouse: type wrong on this card, press enter, expect feedback
await page.keyboard.type('xx');
await page.keyboard.press('Enter');
await page.waitForSelector('.feedback', { timeout: 5000 });
console.log('after second submit (typed via kbd):', await activeTagAndAttrs());
const inputValue = await page.$eval('input[name="answer"]', el => el.value);
console.log('input value still showing:', inputValue);

await browser.close();
