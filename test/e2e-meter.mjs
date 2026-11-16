// Token + context meter: known site (model detected), generic registry site, limits, off switch, popup + settings UI.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const EXT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = '/tmp/cv-out/e2e-meter'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const ctx = await chromium.launchPersistentContext('/tmp/cv-profile-m-' + Date.now(), { channel: 'chromium', headless: true, viewport: { width: 1300, height: 800 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const extId = sw.url().split('/')[2];
const errors = [];
const watch = (p, l) => { p.on('pageerror', (e) => errors.push(l + ': ' + e)); p.on('console', (m) => m.type() === 'error' && errors.push(l + ' console: ' + m.text())); };
const long = 'The quick brown fox jumps over the lazy dog. '.repeat(40);   // ~400 tokens
const claude = `<!doctype html><title>Meter test - Claude</title><body><header><button>Claude Sonnet 4.6</button></header><main>
<div data-testid="user-message">Please explain something. ${long}</div><div class="font-claude-response"><p>Sure. ${long}</p></div></main></body>`;
await ctx.route('https://claude.ai/chat/m1', (r) => r.fulfill({ contentType: 'text/html', body: claude }));
await ctx.route('https://www.genspark.ai/c/m', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Maths - Genspark AI Chat</title><body><main><div data-role="human">What is 2+2?</div><div data-role="assistant"><p>It is <b>4</b>.</p></div></main></body>' }));
const ask = (type) => sw.evaluate(async (t) => { const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return chrome.tabs.sendMessage(tab.id, { type: t }); }, type);
const overlay = (p) => p.evaluate(() => { const h = [...document.documentElement.children].find((e) => e.tagName === 'DIV' && /bottom:\s*148px/.test(e.getAttribute('style') || '')); return h ? getComputedStyle(h).display : 'none'; });

// 1. known site, model named on the page
const p = await ctx.newPage(); watch(p, 'claude');
await p.goto('https://claude.ai/chat/m1'); await p.bringToFront(); await p.waitForTimeout(1500);
let m = await ask('meter');
assert.equal(m.count, 2); assert.equal(m.window, 1000000, 'Sonnet 4.6 from page'); assert.match(m.source, /Detected/);
assert.ok(m.total > 600 && m.total < 1200, 'tokens ' + m.total); assert.equal(m.level, 'green');
assert.equal(await overlay(p), 'block', 'chip is on the page');
await p.screenshot({ path: path.join(OUT, 'chip.png') });
console.log('known site ok', m.total, 'of', m.window);

// 2. user limit changes level
await sw.evaluate(() => chrome.storage.sync.set({ meterLimits: { claude: 1000 } }));
m = await ask('meter'); assert.equal(m.window, 1000); assert.equal(m.userSite, 1000); assert.ok(m.pct > 60); assert.notEqual(m.level, 'green');
await sw.evaluate(() => chrome.storage.sync.set({ meterLimits: { claude: 600 } }));
m = await ask('meter'); assert.equal(m.level, 'red'); assert.equal(m.left, 0);
await p.waitForTimeout(2600);   // watcher must not have broken anything
console.log('limits ok');

// 3. generic registry site: no selectors, no model name -> default guess, still counts
const g = await ctx.newPage(); watch(g, 'genspark');
await g.goto('https://www.genspark.ai/c/m'); await g.bringToFront(); await g.waitForTimeout(1500);
m = await ask('meter'); assert.equal(m.siteName, 'Genspark AI Chat'); assert.equal(m.count, 2); assert.equal(m.window, 128000); assert.match(m.source, /guess/);
assert.equal(await overlay(g), 'block');
console.log('generic site ok');

// 4. off switch
await sw.evaluate(() => chrome.storage.sync.set({ meter: false }));
const off = await ctx.newPage(); watch(off, 'off');
await off.goto('https://claude.ai/chat/m1'); await off.bringToFront(); await off.waitForTimeout(1200);
assert.equal(await overlay(off), 'none', 'no chip when switched off');
assert.equal((await ask('meter')).count, 2, 'popup can still read it');
await sw.evaluate(() => chrome.storage.sync.set({ meter: true, meterLimits: {} }));
console.log('off switch ok');

// 5. popup shows the meter (active-tab lookup stubbed to the claude tab)
await off.bringToFront(); const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0].id);
const pop = await ctx.newPage(); watch(pop, 'popup');
await pop.addInitScript(([id]) => { chrome.tabs.query = async () => [{ id, url: 'https://claude.ai/chat/m1' }]; }, [tabId]);
await pop.goto(`chrome-extension://${extId}/popup.html`);
await pop.waitForSelector('#meter:not([hidden])', { timeout: 8000 });
const txt = await pop.locator('#meter').innerText();
assert.match(txt, /context used/i); assert.match(txt, /1M tokens/); assert.match(txt, /Detected/);
await pop.selectOption('#mWin', '200000'); await pop.waitForTimeout(500);
assert.match(await pop.locator('#mOf').innerText(), /200K/);
await pop.screenshot({ path: path.join(OUT, 'popup.png') });
await pop.click('#mShow').catch(() => {});
await sw.evaluate(() => chrome.storage.sync.set({ meterLimits: {} }));
console.log('popup ok');

// 6. settings card
const d = await ctx.newPage(); watch(d, 'dash');
await d.goto(`chrome-extension://${extId}/dashboard.html#settings`); await d.waitForSelector('#meterOn');
assert.equal(await d.isChecked('#meterOn'), true);
await d.selectOption('#meterDef', '64000'); await d.uncheck('#meterOn'); await d.waitForTimeout(300);
const st = await sw.evaluate(() => chrome.storage.sync.get(['meter', 'meterDefault']));
assert.equal(st.meter, false); assert.equal(st.meterDefault, 64000);
console.log('settings ok');
assert.deepEqual(errors, [], errors.join('\n'));
console.log('METER E2E PASSED'); await ctx.close();
