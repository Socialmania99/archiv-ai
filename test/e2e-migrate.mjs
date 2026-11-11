import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const EXT = path.resolve(new URL('..', import.meta.url).pathname);
const ctx = await chromium.launchPersistentContext('/tmp/cv-profile-m-' + Date.now(), { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = sw.url().split('/')[2]; const errs = [];
const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(`chrome-extension://${id}/dashboard.html`); await p.waitForSelector('#today');
// plant a chat in the pre-rename database
await p.evaluate(() => new Promise((res, rej) => {
  const r = indexedDB.open('cairn', 1);
  r.onupgradeneeded = () => { const s = r.result.createObjectStore('chats', { keyPath: 'id' }); s.createIndex('savedAt', 'savedAt'); };
  r.onsuccess = () => { const t = r.result.transaction('chats', 'readwrite'); t.objectStore('chats').put({ id: 'old1', title: 'Saved before the rename', site: 'chatgpt', siteName: 'ChatGPT', savedAt: Date.now(), exportedAt: new Date().toISOString(), messages: [{ i: 0, role: 'user', markdown: 'hi' }, { i: 1, role: 'assistant', markdown: 'hello' }], tags: [], folder: '', searchText: 'saved before the rename hi hello' }); t.oncomplete = () => { r.result.close(); res(); }; t.onerror = () => rej(t.error); };
}));
await p.reload(); await p.waitForSelector('.rc');
assert.match(await p.locator('body').innerText(), /Saved before the rename/);
const names = await p.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
assert.ok(names.includes('archiv') && !names.includes('cairn'), names.join());
await p.reload(); await p.waitForSelector('.rc');                         // second run: no duplicates, no errors
assert.equal(await p.locator('.rc').count(), 1);
assert.deepEqual(errs, []);
await ctx.close(); console.log('MIGRATION E2E PASSED');
