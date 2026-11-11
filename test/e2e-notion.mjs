import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { toExportPage } from './helper.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const EXT = path.resolve(new URL('..', import.meta.url).pathname);

// stand-in for the optional-permission grant a real click gives
const tmp = '/tmp/archiv-ai-notion-copy'; fs.rmSync(tmp, { recursive: true, force: true });
fs.cpSync(EXT, tmp, { recursive: true, filter: (s) => !s.includes('node_modules') && !s.endsWith('.zip') });
const m = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json')));
m.host_permissions = ['https://api.notion.com/*']; delete m.optional_host_permissions;
fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(m));

const ctx = await chromium.launchPersistentContext('/tmp/cv-profile-n-' + Date.now(), {
  channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${tmp}`, `--load-extension=${tmp}`]
});
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const extId = sw.url().split('/')[2];
const PAGE = '0123456789abcdef0123456789abcdef', DASHED = '01234567-89ab-cdef-0123-456789abcdef';
const seen = []; let mode = 'ok';
await ctx.route('https://api.notion.com/**', async (r) => {
  const req = r.request(); const url = new URL(req.url());
  seen.push({ m: req.method(), p: url.pathname, h: await req.allHeaders(), b: req.postData() ? JSON.parse(req.postData()) : null });
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  if (mode === '404') return r.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: JSON.stringify({ code: 'object_not_found', message: 'nope' }) });
  if (req.method() === 'GET') return r.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ id: DASHED, properties: { title: { type: 'title', title: [{ plain_text: 'Chat archive' }] } } }) });
  return r.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ id: 'newpage', url: 'https://www.notion.so/newpage' }) });
});
const errors = [];
const watch = (p) => p.on('pageerror', (e) => errors.push(String(e)));

// 1. not connected -> export page asks to connect
await ctx.route('https://chatgpt.com/c/1', (r) => r.fulfill({ contentType: 'text/html', body: '<title>Trip - ChatGPT</title><div data-message-author-role="user"><div class="whitespace-pre-wrap">Plan Rome</div></div><div data-message-author-role="assistant"><div class="markdown"><p>Go to the <strong>Forum</strong>.</p><ul><li>Colosseum</li></ul><pre><code class="language-js">let a=1;</code></pre></div></div>' }));
const exportFrom = async () => {
  const p = await ctx.newPage(); await p.goto('https://chatgpt.com/c/1'); await p.bringToFront(); await p.waitForTimeout(400);
  await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return chrome.tabs.sendMessage(t.id, { type: 'export', autoload: false }); });
  const ep = await toExportPage(ctx); watch(ep); return ep;
};
{
  const ep = await exportFrom();
  assert.equal(await ep.locator('#download').innerText(), 'Download');
  await ep.click('#fmtBtn').then(() => ep.click('#fmtMenu button[data-f=notion]'));
  assert.equal(await ep.locator('#download').innerText(), 'Send to Notion');
  await ep.click('#download'); await ep.waitForSelector('.toast.show');
  assert.match(await ep.locator('.toast').innerText(), /Connect Notion first/);
  assert.equal(seen.length, 0, 'no network before connecting');
  /* single Archiv AI tab: keep it */
}
// 2. connect in dashboard settings
const d = await ctx.newPage(); watch(d);
await d.goto(`chrome-extension://${extId}/dashboard.html#settings`); await d.waitForSelector('#nSave');
await d.fill('#nPage', 'not a link'); await d.fill('#nToken', 'secret_abc'); await d.click('#nSave');
assert.match(await d.locator('#nStatus').innerText(), /does not look like/);
await d.fill('#nPage', `https://www.notion.so/Chat-archive-${PAGE}?pvs=4`); await d.click('#nSave');
await d.waitForFunction(() => /Connected to/.test(document.getElementById('nStatus').textContent));
assert.match(await d.locator('#nStatus').innerText(), /Chat archive/);
assert.equal(seen[0].m, 'GET'); assert.equal(seen[0].p, '/v1/pages/' + DASHED); assert.equal(seen[0].h.authorization, 'Bearer secret_abc');
const store = await sw.evaluate(async () => ({ l: await chrome.storage.local.get('notionCfg'), s: await chrome.storage.sync.get(null) }));
assert.equal(store.l.notionCfg.token, 'secret_abc'); assert.ok(!JSON.stringify(store.s).includes('secret_abc'), 'token never synced');
// 3. send
seen.length = 0;
{
  const ep = await exportFrom();
  await ep.click('#fmtBtn').then(() => ep.click('#fmtMenu button[data-f=notion]'));
  await ep.click('#download');
  await ep.waitForSelector('#notionLink:not([hidden])');
  assert.equal(await ep.getAttribute('#notionLink', 'href'), 'https://www.notion.so/newpage');
  const post = seen.find((x) => x.m === 'POST');
  assert.equal(post.p, '/v1/pages'); assert.equal(post.b.parent.page_id, DASHED);
  assert.equal(post.b.properties.title.title[0].text.content, 'Trip');
  const types = post.b.children.map((c) => c.type);
  assert.deepEqual(types.slice(0, 3), ['paragraph', 'heading_2', 'paragraph']);
  assert.ok(types.includes('code') && types.includes('bulleted_list_item'));
  assert.equal(post.b.children.find((c) => c.type === 'code').code.language, 'javascript');
  assert.equal(await ep.locator('#download').innerText(), 'Send to Notion');
  console.log('sent: ' + types.join(','));
  // 4. error path
  mode = '404'; await ep.click('#download'); await ep.waitForFunction(() => /Connections/.test(document.querySelector('.toast').textContent));
  await ep.goto(`chrome-extension://${extId}/dashboard.html#settings`);
}
// 5. disconnect
await d.bringToFront(); await d.waitForSelector("#nClear"); await d.click("#nClear"); await d.waitForFunction(() => /Not connected/.test(document.getElementById('nStatus').textContent));
assert.equal(await sw.evaluate(async () => (await chrome.storage.local.get('notionCfg')).notionCfg), undefined);
assert.deepEqual(errors, [], errors.join('\n'));
await ctx.close();
console.log('NOTION E2E PASSED');
