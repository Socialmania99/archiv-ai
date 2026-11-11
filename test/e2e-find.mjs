import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const EXT = path.resolve(new URL('..', import.meta.url).pathname);
const ctx = await chromium.launchPersistentContext('/tmp/cv-profile-f-' + Date.now(), { channel: 'chromium', headless: true, viewport: { width: 1400, height: 900 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = sw.url().split('/')[2]; const errs = [];
const d = await ctx.newPage(); d.on('pageerror', (e) => errs.push(String(e)));
await d.goto(`chrome-extension://${id}/dashboard.html#settings`); await d.waitForSelector('#addSamples'); await d.click('#addSamples'); await d.waitForTimeout(600);
await d.goto(`chrome-extension://${id}/dashboard.html#library`); await d.waitForSelector('.card');
// open preview with a library search carried over
await d.fill('#q', 'effect'); await d.waitForTimeout(300);
const card = d.locator('.card').first();
await card.locator('[data-a=view]').click();
const pane = card.locator('.view-pane');
assert.equal(await pane.locator('.fq').inputValue(), 'effect', 'library search carried into preview');
const count = await pane.locator('.fcount').innerText(); console.log('count:', count);
assert.match(count, /^1 of \d+/);
const total = Number(count.match(/of (\d+)/)[1]); assert.ok(total >= 2);
assert.equal(await pane.locator('mark').count(), total);
assert.equal(await pane.locator('mark.cur').count(), 1);
// next / prev wrap
await pane.locator('[data-a=fnext]').click(); assert.match(await pane.locator('.fcount').innerText(), /^2 of/);
await pane.locator('[data-a=fprev]').click(); await pane.locator('[data-a=fprev]').click();
assert.match(await pane.locator('.fcount').innerText(), new RegExp(`^${total} of`), 'wraps backwards');
// Enter steps forward, Shift+Enter back
await pane.locator('.fq').press('Enter'); assert.match(await pane.locator('.fcount').innerText(), /^1 of/);
await pane.locator('.fq').press('Shift+Enter'); assert.match(await pane.locator('.fcount').innerText(), new RegExp(`^${total} of`));
// only matches
const before = await pane.locator('.m').count();
await pane.locator('.fq').fill('useMemo');
await pane.locator('.fonly').check(); const after = await pane.locator('.m').count(); assert.ok(after < before && after > 0, `${after} < ${before}`);
await pane.locator('.fonly').uncheck();
await pane.locator('.fq').fill('effect');
// case sensitive + no matches + html is escaped
await pane.locator('.fq').fill('EFFECT'); assert.ok(await pane.locator('mark').count() > 0);
await pane.locator('.fcase').check(); assert.equal(await pane.locator('.fcount').innerText(), 'No matches');
await pane.locator('.fcase').uncheck();
await pane.locator('.fq').fill('<'); await d.waitForTimeout(100);
assert.equal(await pane.locator('.fbody script, .fbody img').count(), 0);
await pane.locator('.fq').fill(''); assert.equal(await pane.locator('mark').count(), 0); assert.equal(await pane.locator('.fcount').innerText(), '');
// close and reopen keeps working
await card.locator('[data-a=view]').click(); assert.equal(await pane.isHidden(), true);
await d.screenshot({ path: '/tmp/cv-out/find-pane.png' });
assert.deepEqual(errs, []);
await ctx.close(); console.log('FIND E2E PASSED');
