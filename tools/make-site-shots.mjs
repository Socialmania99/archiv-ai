// Captures the real extension pages for the website gallery -> docs/assets/shot-*.webp (1360 wide).
// Needs playwright + python3 with Pillow. Run: node tools/make-site-shots.mjs
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const EXT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = path.join(EXT, 'docs/assets'); const RAW = '/tmp/cv-out/site-raw';
fs.rmSync(RAW, { recursive: true, force: true }); fs.mkdirSync(RAW, { recursive: true });
const ctx = await chromium.launchPersistentContext('/tmp/cv-profile-site-' + Date.now(), { channel: 'chromium', headless: true, viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = sw.url().split('/')[2]; const U = (p) => `chrome-extension://${id}/${p}`;
const theme = (p, m) => p.evaluate((x) => window.ArchivAiTheme.apply(x), m);
const chat = `<!doctype html><meta charset="utf-8"><title>Plan a 3-day Rome trip - ChatGPT</title><body>
<div data-message-author-role="user"><div class="whitespace-pre-wrap">Plan a relaxed 3-day trip to Rome. Include a budget table.</div></div>
<div data-message-author-role="assistant"><div class="markdown"><h2>3 days in Rome</h2><p>A <strong>relaxed plan</strong> with the main sights spread out:</p><ol><li>Day 1: Colosseum and Forum</li><li>Day 2: Vatican Museums</li><li>Day 3: Trastevere and Pantheon</li></ol><table><thead><tr><th>Item</th><th>Per day</th></tr></thead><tbody><tr><td>Food</td><td>€55</td></tr><tr><td>Transport</td><td>€12</td></tr></tbody></table></div></div>
<div data-message-author-role="user"><div class="whitespace-pre-wrap">Great, make day 3 shorter.</div></div>
<div data-message-author-role="assistant"><div class="markdown"><p>Done: Day 3 is now a <em>half day</em> around Trastevere.</p></div></div></body>`;
await ctx.route('https://chatgpt.com/c/1', (r) => r.fulfill({ contentType: 'text/html', body: chat }));
const snap = (p, n) => p.screenshot({ path: `${RAW}/${n}.png` });

const d = await ctx.newPage();
await d.goto(U('dashboard.html#settings')); await d.waitForSelector('#addSamples'); await d.click('#addSamples'); await d.waitForTimeout(800);
await d.goto(U('dashboard.html')); await d.waitForSelector('.rc'); await d.waitForTimeout(700);
for (const m of ['light', 'dark']) {
  await theme(d, m); await d.waitForTimeout(900);
  await d.mouse.move(700, 30);
  await d.locator('#sWordsBars i').nth(5).hover(); await d.waitForTimeout(1100);
  await snap(d, 'dash-' + m);
}
await d.goto(U('dashboard.html#library')); await d.waitForTimeout(600); await theme(d, 'light'); await d.waitForTimeout(700); await snap(d, 'library');
await d.goto(U('dashboard.html#sites')); await d.waitForSelector('.sitecard'); await d.waitForTimeout(600); await theme(d, 'light'); await d.waitForTimeout(700); await snap(d, 'sites');

// inbox with an open preview
const p = await ctx.newPage(); await p.goto('https://chatgpt.com/c/1'); await p.bringToFront(); await p.waitForTimeout(400);
await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return chrome.tabs.sendMessage(t.id, { type: 'export', autoload: false }); });
let ib = null; for (let i = 0; i < 100 && !ib; i++) { for (const pg of ctx.pages()) if (/dashboard\.html/.test(pg.url()) && await pg.locator('.ib [data-a=iexport]').first().isVisible().catch(() => false)) ib = pg; if (!ib) await new Promise((r) => setTimeout(r, 150)); }
await ib.bringToFront(); await ib.locator('.ib [data-a=ipreview]').first().click(); await ib.waitForTimeout(700); await theme(ib, 'light'); await ib.waitForTimeout(700); await snap(ib, 'inbox');
await ib.locator('.ib [data-a=iexport]').first().click(); await ib.waitForSelector('.msg'); await ib.waitForTimeout(500); await theme(ib, 'light'); await ib.waitForTimeout(700); await snap(ib, 'export');
await ctx.close();

fs.writeFileSync('/tmp/cv-out/conv.py', `from PIL import Image
import sys
for n,o in [('dash-light','shot-dashboard-light'),('dash-dark','shot-dashboard-dark'),('library','shot-library'),('sites','shot-sites'),('inbox','shot-inbox'),('export','shot-export')]:
    im=Image.open('${RAW}/'+n+'.png').convert('RGB'); im=im.resize((1360,int(im.height*1360/im.width)),Image.LANCZOS); im.save('${OUT}/'+o+'.webp','WEBP',quality=84,method=6)
`);
execFileSync('python3', ['/tmp/cv-out/conv.py'], { stdio: 'inherit' });
console.log('site shots written');
