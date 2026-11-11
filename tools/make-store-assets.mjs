import { toExportPage } from '../test/helper.mjs';
// Captures real extension pages and composes Chrome Web Store images.
// Output: store/assets/  (screenshots 1280x800, promo 440x280, marquee 1400x560)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const EXT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = path.join(EXT, 'store/assets'); const RAW = '/tmp/cv-out/store-raw';
fs.mkdirSync(OUT, { recursive: true }); fs.rmSync(RAW, { recursive: true, force: true }); fs.mkdirSync(RAW, { recursive: true });

const ctx = await chromium.launchPersistentContext('/tmp/cv-profile-s-' + Date.now(), {
  channel: 'chromium', headless: true, viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`]
});
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = sw.url().split('/')[2];
const U = (p) => `chrome-extension://${id}/${p}`;
const setTheme = (p, m) => p.evaluate((x) => window.ArchivAiTheme.apply(x), m);

const chat = `<!doctype html><meta charset="utf-8"><title>Plan a 3-day Rome trip - ChatGPT</title><body>
<div data-message-author-role="user"><div class="whitespace-pre-wrap">Plan a relaxed 3-day trip to Rome. Include a budget table and one script to split costs.</div></div>
<div data-message-author-role="assistant"><div class="markdown"><h2>3 days in Rome</h2><p>Here is a <strong>relaxed plan</strong> with the main sights spread out:</p>
<ol><li>Day 1: Colosseum and Forum<ul><li>book the combined ticket ahead</li></ul></li><li>Day 2: Vatican Museums</li><li>Day 3: Trastevere and Pantheon</li></ol>
<table><thead><tr><th>Item</th><th>Per day</th></tr></thead><tbody><tr><td>Food</td><td>€55</td></tr><tr><td>Transport</td><td>€12</td></tr><tr><td>Tickets</td><td>€40</td></tr></tbody></table>
<pre><code class="language-python">costs = {"food": 55, "transport": 12, "tickets": 40}\nprint(sum(costs.values()) * 3 / 2)  # per person, 2 people</code></pre></div></div>
<div data-message-author-role="user"><div class="whitespace-pre-wrap">Great, make day 3 shorter.</div></div>
<div data-message-author-role="assistant"><div class="markdown"><p>Done: Day 3 is now a <em>half day</em> around Trastevere, with the Pantheon at sunset.</p></div></div></body>`;
await ctx.route('https://chatgpt.com/c/1', (r) => r.fulfill({ contentType: 'text/html', body: chat }));

// seed the vault
const d = await ctx.newPage();
await d.goto(U('dashboard.html#settings')); await d.waitForSelector('#addSamples'); await d.click('#addSamples'); await d.waitForTimeout(800);
await d.goto(U('dashboard.html')); await d.waitForSelector('.rc');
await d.setViewportSize({ width: 1420, height: 900 });
for (const m of ['light', 'dark']) { await setTheme(d, m); await d.waitForTimeout(300); await d.screenshot({ path: `${RAW}/dash-${m}.png` }); }
await d.goto(U('dashboard.html#sites')); await d.waitForSelector('.sitecard');
for (const m of ['light', 'dark']) { await setTheme(d, m); await d.waitForTimeout(300); await d.screenshot({ path: `${RAW}/sites-${m}.png` }); }
await d.goto(U('dashboard.html#library')); await d.waitForTimeout(500);
await setTheme(d, 'light'); await d.screenshot({ path: `${RAW}/lib-light.png` });

// export page from a real mock chat
const p = await ctx.newPage(); await p.goto('https://chatgpt.com/c/1'); await p.bringToFront(); await p.waitForTimeout(400);
await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return chrome.tabs.sendMessage(t.id, { type: 'export', autoload: false }); });
const ep = await toExportPage(ctx); await ep.setViewportSize({ width: 1360, height: 860 });
await ep.click('.theme[data-theme=sakura]').catch(() => {});
for (const m of ['light', 'dark']) { await setTheme(ep, m); await ep.waitForTimeout(300); await ep.screenshot({ path: `${RAW}/export-${m}.png` }); }

// popup with the state a real scan gives (same DOM the popup script fills)
const pop = await ctx.newPage(); await pop.setViewportSize({ width: 340, height: 372 });
await pop.goto(U('popup.html')); await pop.waitForSelector('#sname');
await pop.evaluate(() => {
  document.getElementById('sname').textContent = 'ChatGPT';
  document.getElementById('stitle').textContent = 'Plan a 3-day Rome trip';
  document.getElementById('count').textContent = '4'; document.getElementById('countLbl').textContent = 'messages found';
  document.getElementById('avatar').textContent = 'C'; document.getElementById('avatar').style.background = '#10a37f';
  document.getElementById('status').textContent = '';
  document.getElementById('export').disabled = false; document.getElementById('teach').disabled = false;
});
for (const m of ['light', 'dark']) { await setTheme(pop, m); await pop.waitForTimeout(250); await pop.screenshot({ path: `${RAW}/popup-${m}.png` }); }
await ctx.close();

// ---------- compose ----------
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const logo = b64(path.join(EXT, 'icons/128.png'));
const base = `*{box-sizing:border-box;margin:0}body{font-family:'Plus Jakarta Sans',Inter,system-ui,'Segoe UI',sans-serif;color:#fff;overflow:hidden}
.bg{position:absolute;inset:0;background:radial-gradient(700px 420px at 90% -10%,rgba(255,150,90,.35),transparent 60%),radial-gradient(800px 500px at 0 110%,rgba(167,139,250,.5),transparent 60%),linear-gradient(135deg,#1b1157,#3a22c7 55%,#5b37f0)}
.win{position:absolute;border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(10,5,50,.55);border:1px solid rgba(255,255,255,.25)}
.win img{display:block;width:100%}
h1{position:absolute;left:56px;top:44px;font-size:44px;line-height:1.1;letter-spacing:-.02em;max-width:640px;font-weight:800}
p.sub{position:absolute;left:56px;font-size:20px;opacity:.85;max-width:520px;line-height:1.4}
.brand{position:absolute;display:flex;align-items:center;gap:12px;font-weight:800;font-size:26px}.brand img{width:44px;height:44px;border-radius:12px}`;
const shots = [
  ['01-export-anywhere', 'Export any AI chat in one click', 'PDF, Word, PNG, Markdown, Notion or Obsidian. Secrets redacted first.', 'export-dark.png', 1280],
  ['02-dashboard-dark', 'A private library for every chat', 'Search, tag and folder your saved chats. Stored on your device only.', 'dash-dark.png', 1280],
  ['03-dashboard-light', 'Light and dark, one click', 'Switch themes from any Archiv AI page.', 'dash-light.png', 1280],
  ['04-sites', 'Works across the AI tools you use', 'Built-in support for major chat sites. Any other page: just teach it.', 'sites-light.png', 1280],
  ['05-export-light', 'Pick what goes in the document', 'Choose messages, themes and fonts. Preview before you save.', 'export-light.png', 1280]
];
const br = await chromium.launch({ channel: 'chromium' });
const pg = await br.newPage({ viewport: { width: 1280, height: 800 } });
for (const [name, h, s, file] of shots) {
  await pg.setContent(`<style>${base}</style><div class="bg"></div><h1>${h}</h1><p class="sub" style="top:${h.length > 34 ? 176 : 124}px">${s}</p>
  <div class="win" style="left:56px;top:${h.length > 34 ? 290 : 240}px;width:1168px"><img src="${b64(path.join(RAW, file))}"></div>`);
  await pg.screenshot({ path: path.join(OUT, name + '.png') });
}
// popup shot
await pg.setContent(`<style>${base}</style><div class="bg"></div><h1>Light or dark, your call</h1><p class="sub" style="top:124px">A small sun/moon switch lives in the popup, dashboard and export page.</p>
 <div class="win" style="left:150px;top:260px;width:340px"><img src="${b64(path.join(RAW, 'popup-light.png'))}"></div>
 <div class="win" style="left:560px;top:260px;width:340px"><img src="${b64(path.join(RAW, 'popup-dark.png'))}"></div>`);
await pg.screenshot({ path: path.join(OUT, '06-popup.png') });
// promo tiles
const pt = await br.newPage({ viewport: { width: 440, height: 280 } });
await pt.setContent(`<style>${base}</style><div class="bg"></div><div class="brand" style="left:32px;top:34px"><img src="${logo}">Archiv AI</div>
 <h1 style="left:32px;top:112px;font-size:30px;max-width:380px">Save any AI chat. Keep it private.</h1><p class="sub" style="left:32px;top:200px;font-size:15px;max-width:380px">PDF · Word · PNG · Markdown · Notion · Obsidian</p>`);
await pt.screenshot({ path: path.join(OUT, 'promo-small-440x280.png') });
const mq = await br.newPage({ viewport: { width: 1400, height: 560 } });
await mq.setContent(`<style>${base}</style><div class="bg"></div><div class="brand" style="left:80px;top:70px;font-size:34px"><img src="${logo}" style="width:56px;height:56px">Archiv AI</div>
 <h1 style="left:80px;top:170px;font-size:60px;max-width:720px">Save any AI chat.<br>Keep it private.</h1><p class="sub" style="left:80px;top:370px;font-size:24px;max-width:640px">Export to PDF, Word, PNG, Markdown, Notion or Obsidian. No account. Nothing leaves your device.</p>
 <div class="win" style="left:760px;top:60px;width:560px;transform:rotate(2deg)"><img src="${b64(path.join(RAW, 'dash-dark.png'))}"></div>`);
await mq.screenshot({ path: path.join(OUT, 'promo-marquee-1400x560.png') });
await br.close();
console.log(fs.readdirSync(OUT).join('\n'));
