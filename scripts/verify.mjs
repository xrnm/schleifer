import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:4200';
const TRACE = [];
const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); TRACE.push(s); };

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
page.on('console', (m) => {
  const type = m.type();
  if (type === 'error' || type === 'warning') log(`[console.${type}]`, m.text());
});
page.on('pageerror', (e) => log('[pageerror]', e.message));
page.on('requestfailed', (r) => log('[reqfail]', r.url(), r.failure()?.errorText));

async function shot(name) {
  await page.screenshot({ path: `/tmp/.verify/${name}.png`, fullPage: false });
  log('shot', name);
}

async function dom(selector, prop = 'innerText') {
  return page.$eval(selector, (el, p) => el[p], prop).catch(() => null);
}

async function dbCounts() {
  return page.evaluate(async () => {
    const open = indexedDB.open('schleifer');
    const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
    const stores = ['nouns','cards','cardStates','sessions','events'];
    const out = {};
    for (const s of stores) {
      out[s] = await new Promise((res, rej) => {
        const tx = db.transaction(s, 'readonly').objectStore(s).count();
        tx.onsuccess = () => res(tx.result); tx.onerror = () => rej(tx.error);
      });
    }
    db.close();
    return out;
  });
}

async function lastEvents(n = 5) {
  return page.evaluate(async (n) => {
    const open = indexedDB.open('schleifer');
    const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
    const all = await new Promise((res, rej) => {
      const tx = db.transaction('events', 'readonly').objectStore('events').getAll();
      tx.onsuccess = () => res(tx.result); tx.onerror = () => rej(tx.error);
    });
    db.close();
    return all.slice(-n);
  }, n);
}

try {
  log('--- wipe DB ---');
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => new Promise((res) => {
    const r = indexedDB.deleteDatabase('schleifer');
    r.onsuccess = r.onerror = r.onblocked = () => res();
  }));

  log('--- HOME load ---');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('button.primary.big', { timeout: 15000 });
  await shot('01-home');
  const lead = await dom('p.lead');
  log('home lead:', lead);
  log('counts after home load:', await dbCounts());

  log('--- start session ---');
  await page.click('button.primary.big');
  await page.waitForSelector('.prompt-noun', { timeout: 15000 });
  await shot('02-session-1');
  const noun1 = await dom('.noun-text');
  const tags1 = await page.$$eval('.prompt-tags span', els => els.map(e => e.innerText));
  log('card 1 noun:', noun1, 'tags:', tags1.join('|'));

  log('--- submit a deliberately wrong answer ---');
  await page.type('input[name="answer"]', 'totally-wrong');
  await page.click('button[type="submit"]');
  await page.waitForSelector('.feedback.bad', { timeout: 5000 });
  await shot('03-feedback-wrong');
  const expected1 = await dom('.expected');
  log('expected line:', expected1);

  log('--- next & submit the correct answer to card 2 ---');
  const noun1Text = await dom('.noun-text');
  await page.click('button.primary[type="button"]');
  await page.waitForFunction((prev) => {
    const t = document.querySelector('.noun-text');
    const fb = document.querySelector('.feedback');
    return t && t.textContent.trim() !== prev && !fb;
  }, { timeout: 5000 }, noun1Text);
  // Look up the expected answer from IndexedDB (we know the noun + tags).
  const expected2 = await page.evaluate(async () => {
    const noun = document.querySelector('.noun-text').textContent.trim();
    const tags = [...document.querySelectorAll('.prompt-tags span')].map(t => t.textContent.trim());
    const open = indexedDB.open('schleifer');
    const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
    const nouns = await new Promise((res, rej) => {
      const tx = db.transaction('nouns', 'readonly').objectStore('nouns').getAll();
      tx.onsuccess = () => res(tx.result); tx.onerror = () => rej(tx.error);
    });
    const cards = await new Promise((res, rej) => {
      const tx = db.transaction('cards', 'readonly').objectStore('cards').getAll();
      tx.onsuccess = () => res(tx.result); tx.onerror = () => rej(tx.error);
    });
    db.close();
    const map = { NOMINATIVE: 'nom', ACCUSATIVE: 'acc', DATIVE: 'dat', SINGULAR: 'sg', PLURAL: 'pl', DEFINITE: 'def', INDEFINITE: 'indef' };
    const c = map[tags[0]], n = map[tags[1]], a = map[tags[2]];
    const matches = nouns.filter(x => x.singular === noun);
    for (const m of matches) {
      const found = cards.find(card => card.nounId === m.id && card.case === c && card.number === n && card.articleType === a);
      if (found) return found.expected;
    }
    return null;
  });
  log('correct answer for card 2 should be:', expected2);
  await page.type('input[name="answer"]', expected2);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.feedback.ok', { timeout: 5000 });
  await shot('04-feedback-correct');
  const noun2Text = await dom('.noun-text');
  await page.click('button.primary[type="button"]'); // next
  await page.waitForFunction((prev) => {
    const t = document.querySelector('.noun-text');
    const fb = document.querySelector('.feedback');
    return t && t.textContent.trim() !== prev && !fb;
  }, { timeout: 5000 }, noun2Text);

  log('--- I dont know on card 3 ---');
  await page.waitForSelector('.actions button', { timeout: 5000 });
  const idkClicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.actions button')].find(x => x.textContent.trim().toLowerCase().includes("don't"));
    if (b) { b.click(); return true; }
    return false;
  });
  if (!idkClicked) throw new Error("I don't know button not found");
  await page.waitForSelector('.feedback.bad', { timeout: 5000 });
  await shot('05-idk-feedback');
  log('counts mid-session:', await dbCounts());
  log('last events:', JSON.stringify(await lastEvents(4), null, 2));

  log('--- skip card 4 ---');
  const noun3Text = await dom('.noun-text');
  await page.click('button.primary[type="button"]'); // next
  await page.waitForFunction((prev) => {
    const t = document.querySelector('.noun-text');
    const fb = document.querySelector('.feedback');
    return t && t.textContent.trim() !== prev && !fb;
  }, { timeout: 5000 }, noun3Text);
  const noun3 = await dom('.noun-text');
  await page.waitForSelector('.actions button', { timeout: 5000 });
  const skipClicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.actions button')].find(x => x.textContent.trim() === 'Skip');
    if (b) { b.click(); return true; }
    return false;
  });
  if (!skipClicked) throw new Error('Skip button not found');
  await page.waitForFunction((prev) => {
    const t = document.querySelector('.noun-text');
    return t && t.textContent.trim() !== prev;
  }, { timeout: 5000 }, noun3);
  await shot('06-after-skip');
  log('skipped from', noun3, 'to', await dom('.noun-text'));

  log('--- end session ---');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.session-head button')].find(x => x.textContent.includes('End'));
    b?.click();
  });
  await page.waitForSelector('button.primary.big', { timeout: 10000 });
  await shot('07-back-home');
  log('counts after end:', await dbCounts());
  log('last events post-end:', JSON.stringify(await lastEvents(3), null, 2));

  log('--- export round trip ---');
  await page.evaluate(() => location.hash = '#/data');
  await page.waitForSelector('ul.counts', { timeout: 10000 });
  await shot('08-data');
  // Trigger export, capture blob via override
  const exportText = await page.evaluate(async () => {
    const realCreate = URL.createObjectURL;
    let captured = null;
    URL.createObjectURL = (b) => { captured = b; return realCreate.call(URL, b); };
    document.querySelector('button.primary').click();
    // Wait a tick for export to complete
    await new Promise(r => setTimeout(r, 800));
    URL.createObjectURL = realCreate;
    return captured ? await captured.text() : null;
  });
  log('export bytes:', exportText?.length);
  const parsed = JSON.parse(exportText);
  log('export keys:', Object.keys(parsed).join(','), 'schema:', parsed.schema, 'cardStates:', parsed.cardStates.length, 'events:', parsed.events.length);

  log('--- declension spot checks ---');
  const checks = await page.evaluate(() => {
    const results = [];
    // Pick known nouns from catalog
    const targets = ['tisch','frau','haus','auto','leute','deutsch'];
    return fetch('/assets/nouns.json').then(r => r.json()).then(file => {
      const byId = Object.fromEntries(file.nouns.map(n => [n.id, n]));
      for (const id of targets) results.push({ id, noun: byId[id] || null });
      return results;
    });
  });
  log('lookups:', JSON.stringify(checks.map(c => ({ id: c.id, found: !!c.noun, plural: c.noun?.plural, gender: c.noun?.gender, pluralOnly: c.noun?.pluralOnly })), null, 2));

  log('OK ALL DONE');
} catch (e) {
  log('FAILED:', e.message);
  log(e.stack);
  await shot('failure');
} finally {
  writeFileSync('/tmp/.verify/trace.log', TRACE.join('\n'));
  await browser.close();
}
