import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const EXT = path.resolve(new URL('..', import.meta.url).pathname);
const ctx = await chromium.launchPersistentContext('/tmp/cv-profile-7-' + Date.now(), { channel: 'chromium', headless: true, viewport: { width: 1400, height: 900 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = sw.url().split('/')[2]; const errs = [];
const d = await ctx.newPage(); d.on('pageerror', (e) => errs.push(e.message));
await d.goto(`chrome-extension://${id}/dashboard.html#dashboard`); await d.waitForSelector('#sb .panel');

// seed: 3 chats today, 1 two days ago, 2 four days ago, with different lengths
await d.evaluate(async () => {
  const { saveChat } = await import('./lib/db.js');
  const DAY = 86400000, now = Date.now();
  const mk = (n, ago, words) => saveChat({ title: 'Seed ' + n, site: 'chatgpt', siteName: 'ChatGPT', url: 'https://chatgpt.com/c/' + n, exportedAt: new Date().toISOString(), savedAt: now - ago * DAY, messages: [{ i: 0, role: 'user', markdown: 'q' }, { i: 1, role: 'assistant', markdown: Array(words).fill('word').join(' ') }] });
  await mk(1, 0, 100); await mk(2, 0, 50); await mk(3, 0, 25); await mk(4, 2, 400); await mk(5, 4, 10); await mk(6, 4, 20);
});
await d.reload(); await d.waitForSelector('#sChatsBars i');

// --- BMC + switch present, switch top-right
const sw0 = await d.locator('.topbar .tsw-host').boundingBox();
assert.ok(sw0 && sw0.x > 1000, 'switch top-right ' + JSON.stringify(sw0));
const wasDark = await d.evaluate(() => document.documentElement.dataset.ui);
await d.locator('.topbar .tsw input').click();
const now = await d.evaluate(() => document.documentElement.dataset.ui);
assert.notEqual(now, wasDark, 'theme flipped');
await d.reload(); await d.waitForSelector('.topbar .tsw input');
assert.equal(await d.evaluate(() => document.documentElement.dataset.ui), now, 'persists after reload');
assert.equal(await d.locator('.topbar .tsw input').isChecked(), now === 'dark');
await d.keyboard.press('Tab'); // keyboard reachable
await d.locator('.topbar .tsw input').focus(); await d.keyboard.press('Space');
assert.notEqual(await d.evaluate(() => document.documentElement.dataset.ui), now, 'keyboard toggles');

// --- count-up per bar uses each day's own value
const vals = await d.locator('#sChatsBars i').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
assert.equal(vals.length, 7);
const read = async (sel, i) => { await d.locator(`${sel} i`).nth(i).hover(); await d.waitForTimeout(1100); return d.locator(`${sel} .bt-n`).innerText(); };
assert.equal(await read('#sChatsBars', 6), '3', 'today = 3 chats');
assert.equal(await read('#sChatsBars', 4), '1', '2 days ago = 1');
assert.equal(await read('#sChatsBars', 2), '2', '4 days ago = 2');
assert.equal(await read('#sChatsBars', 5), '0', 'empty day = 0');
const w6 = await read('#sWordsBars', 6), w4 = await read('#sWordsBars', 4);
assert.ok(Number(w6.replace(/,/g, '')) > 150 && w6 !== w4, `words differ per day ${w6} vs ${w4}`);
// counts up from a small number, not instantly final
await d.locator('#sWordsBars i').nth(4).hover();
await d.locator('#sWordsBars i').nth(6).hover(); await d.waitForTimeout(60);
const mid = Number((await d.locator('#sWordsBars .bt-n').innerText()).replace(/,/g, ''));
await d.waitForTimeout(1100);
const fin = Number((await d.locator('#sWordsBars .bt-n').innerText()).replace(/,/g, ''));
assert.ok(mid < fin, `counting ${mid} -> ${fin}`);
// keyboard alternative
await d.locator('#sChatsBars i').nth(6).focus(); await d.waitForTimeout(1100);
assert.equal(await d.locator('#sChatsBars .bt-n').innerText(), '3'); assert.ok(await d.locator('#sChatsBars .bartip.on').count());

// --- activity line animates on hover
await d.mouse.move(5, 5);
assert.equal(await d.locator('#chart .ln').evaluate((e) => getComputedStyle(e).animationName), 'none');
await d.locator('#hero').hover();
assert.equal(await d.locator('#chart .ln').evaluate((e) => getComputedStyle(e).animationName), 'trace');

// --- BMC style
const b = await d.evaluate(() => { document.querySelector('[data-view-link="settings"], a[href="#settings"]')?.click(); const e = document.querySelector('.bmc'); const c = getComputedStyle(e); return { bg: c.backgroundColor, bw: c.borderTopWidth, bc: c.borderTopColor, out: c.outlineStyle }; });
assert.equal(b.bg, 'rgb(0, 0, 0)'); assert.equal(b.bw, '1px'); assert.ok(/rgba\(255, 255, 255, 0\.\d+\)/.test(b.bc), b.bc);
assert.deepEqual(errs, []);
console.log('V07 E2E PASSED'); await ctx.close();
