import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });

await page.goto('http://127.0.0.1:4200/', { waitUntil: 'networkidle2' });
await page.waitForSelector('img.brand__logomark', { timeout: 10000 });
await new Promise(r => setTimeout(r, 800));

const dims = await page.$eval('img.brand__logomark', el => ({
  natural: { w: el.naturalWidth, h: el.naturalHeight },
  rendered: { w: el.clientWidth, h: el.clientHeight },
  src: el.currentSrc.split('/').pop(),
}));
console.log('logo:', JSON.stringify(dims, null, 2));

// Tight crop of the top bar
await page.screenshot({
  path: '/tmp/.verify/logo-topbar.png',
  clip: { x: 0, y: 0, width: 1280, height: 70 },
});

// Verify favicon link resolved
const faviconStatus = await page.evaluate(async () => {
  const links = [...document.querySelectorAll('link[rel*="icon"]')].map(l => l.href);
  const checks = await Promise.all(links.map(async (h) => {
    const r = await fetch(h, { method: 'HEAD' });
    return { url: h.split('/').pop(), status: r.status };
  }));
  return checks;
});
console.log('favicons:', JSON.stringify(faviconStatus, null, 2));

await browser.close();
