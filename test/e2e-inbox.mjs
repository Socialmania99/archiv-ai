import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const EXT = path.resolve(new URL('..', import.meta.url).pathname);
const ctx = await chromium.launchPersistentContext('/tmp/cv-profile-i-' + Date.now(), { channel: 'chromium', headless: true, viewport: { width: 1400, height: 900 }, acceptDownloads: true, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = sw.url().split('/')[2]; const errs = [];
const d = await ctx.newPage(); d.on('pageerror', (e) => errs.push(String(e)));
await d.goto(`chrome-extension://${id}/dashboard.html#dashboard`); await d.waitForSelector('#sb .panel');
const basePages = ctx.pages().length;
const extTabs = () => ctx.pages().filter((p) => p.url().startsWith('chrome-extension://')).length;
const base = { site: 'chatgpt', siteName: 'ChatGPT', title: 'React bug help', url: 'https://chatgpt.com/c/abc?x=1', exportedAt: new Date().toISOString(),
  messages: [{ i: 0, role: 'user', markdown: 'My javascript function has a bug and an error in react code' }, { i: 1, role: 'assistant', markdown: 'Fix the variable in your react function. Also for the trip, book a flight and hotel for the itinerary.' }] };
const send = (p) => d.evaluate((pl) => chrome.runtime.sendMessage({ type: 'open-export', payload: pl }), p);

await send(base); await d.waitForSelector('.ib');
assert.equal(extTabs(), 1, 'single Archiv AI tab'); assert.equal(ctx.pages().length, basePages);
assert.match(await d.locator('.ib-from').innerText(), /Recent copy from ChatGPT/);
assert.match(await d.locator('.ib-st').innerText(), /New chat/);
const tags = await d.locator('.ib-tagsin').inputValue(); console.log('tags:', tags);
assert.ok(tags.split(',').length >= 2, 'multiple topic tags');
assert.match(await d.locator('#sb .bdg').first().innerText(), /1/);
await d.click('[data-a=ipreview]'); assert.equal(await d.locator('.ib-pane').isVisible(), true); assert.equal(await d.locator('.ib-pane .m').count(), 2);
assert.equal(await d.locator('[data-a=ipreview]').innerText(), 'Hide preview');
await d.screenshot({ path: '/tmp/cv-out/inbox.png' });
await d.click('[data-a=ipreview]'); assert.equal(await d.locator('.ib-pane').isHidden(), true);

await d.click('[data-a=isave]'); await d.waitForSelector('.ib', { state: 'detached' });
// same chat again -> replace
await send(base); await d.waitForSelector('.ib');
assert.equal(ctx.pages().length, basePages);
assert.match(await d.locator('.ib-st').innerText(), /Already saved/);
await d.click('[data-a=isave]'); await d.waitForSelector('.ib', { state: 'detached' });
// same chat with new messages -> Updated
const more = { ...base, messages: [...base.messages, { i: 2, role: 'user', markdown: 'Thanks, one more question' }, { i: 3, role: 'assistant', markdown: 'Sure, ask away' }] };
await send(more); await d.waitForSelector('.ib');
assert.match(await d.locator('.ib-st').innerText(), /Updated: 2 new/);
await d.click('[data-a=isave]'); await d.waitForSelector('.ib', { state: 'detached' });
await d.goto(`chrome-extension://${id}/dashboard.html#library`); await d.waitForSelector('#list .card');
assert.equal(await d.locator('#list .card').count(), 1, 'one saved chat, not three');
assert.match(await d.locator('#list .card .muted').first().innerText(), /4 messages/);
assert.ok(await d.locator('#list .card .chip.upd').count() >= 1, 'Updated chip');
await d.locator('#list .card [data-a=view]').click();
assert.equal(await d.locator('.msg-updated').count(), 2);
// sidebar: site entry with logo, filter link
await d.locator('#sb .si', { hasText: 'ChatGPT' }).first().click(); await d.waitForTimeout(300);
assert.match(await d.evaluate(() => location.hash), /site=chatgpt/);
assert.ok(await d.locator('#sb .si .av.logo img').count() >= 1, 'brand logo in sidebar');
// collapse
await d.click('#sb .sbtoggle'); await d.waitForTimeout(400); assert.ok((await d.locator('#sb .panel').boundingBox()).width < 5, 'panel contracted');
await d.click('#sb .sbtoggle'); await d.waitForTimeout(400); assert.ok((await d.locator('#sb .panel').boundingBox()).width > 200, 'panel expanded');
await d.click('#sb .sbtoggle'); await d.waitForTimeout(300); assert.ok((await d.locator('#sb .panel').boundingBox()).width < 5); 
// inbox export -> same tab, dock
await d.evaluate(() => { location.hash = '#inbox'; });
await send({ ...base, title: 'Other chat', url: 'https://chatgpt.com/c/zzz' }); await d.waitForSelector('.ib');
await d.click('[data-a=iexport]'); await d.waitForSelector('#fmtBtn');
assert.equal(ctx.pages().length, basePages, 'export stays in the same tab');
assert.equal(await d.locator('#dock').count(), 0, 'dock removed');
await d.waitForFunction(() => /2 messages/.test(document.getElementById('stats').textContent));
assert.equal(await d.locator('#sb .panel').boundingBox().then((b) => b.width < 5), true, 'collapsed state kept on export page');
await d.click('#sb .sbtoggle'); await d.waitForTimeout(350);
await d.click('#fmtBtn'); assert.equal(await d.locator('#fmtMenu').isVisible(), true);
await d.click('#fmtMenu button[data-f=docx]'); assert.equal(await d.locator('#fmtName').innerText(), 'Word'); assert.equal(await d.locator('#fmtMenu').isHidden(), true);
assert.equal(await d.locator('input[value=docx]').isChecked(), true);
await d.click('#fmtBtn'); await d.click('#fmtMenu button[data-f=md]');
await d.locator('.msg .role').first().click(); await d.click('#fmtBtn'); await d.click('#fmtMenu button[data-f=md]'); await d.waitForFunction(() => /1 messages/.test(document.getElementById('stats').textContent));
const [dl] = await Promise.all([d.waitForEvent('download'), d.click('#download')]);
assert.match(dl.suggestedFilename(), /\.md$/);
assert.ok(await d.locator('#tagbox .chip').count() >= 1);
const sc = await d.evaluate(() => { const p = document.getElementById('preview'); return [getComputedStyle(p).overflowY, p.scrollHeight >= p.clientHeight]; });
assert.equal(sc[0], 'auto', 'preview scrolls in its own box');
assert.equal(await d.locator('#sb .collapse').count(), 0, 'panel collapse button removed');
await d.screenshot({ path: '/tmp/cv-out/export-dock.png' });
await d.click('#save'); await d.waitForTimeout(500);
assert.equal(await d.locator('#discard').isHidden(), true);
// discard flow
await d.goto(`chrome-extension://${id}/dashboard.html#inbox`);
await send({ ...base, title: 'Throwaway', url: 'https://chatgpt.com/c/tmp' }); await d.waitForSelector('.ib');
await d.click('[data-a=idiscard]'); await d.waitForSelector('.ib', { state: 'detached' });
// combined export never lands in inbox
assert.equal(await d.locator('#inboxList .empty').count(), 1);
assert.deepEqual(errs, []);
await ctx.close(); console.log('INBOX E2E PASSED');
