import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { toExportPage } from './helper.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const EXT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = '/tmp/cv-out/e2e-v04'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });

const launch = async (ext) => chromium.launchPersistentContext('/tmp/cv-profile4-' + Math.random().toString(36).slice(2), {
  channel: 'chromium', headless: true, acceptDownloads: true, viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`]
});
const mk = (title, body) => `<!doctype html><title>${title}</title><body><main>${body}</main></body>`;
const chat = (t) => mk(t, '<div data-role="human">What is 2+2?</div><div data-role="assistant"><p>It is <b>4</b>.</p></div>');

// ======================= A. normal build =======================
{
  const ctx = await launch(EXT);
  const errors = [];
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  const watch = (p, label) => { p.on('pageerror', (e) => errors.push(label + ': ' + e)); p.on('console', (m) => { if (m.type() === 'error') errors.push(label + ' console: ' + m.text()); }); };

  await ctx.route('https://chatgpt.com/c/1', (r) => r.fulfill({ contentType: 'text/html', body: mk('Plan - ChatGPT', '<div data-message-author-role="user"><div class="whitespace-pre-wrap">Hello</div></div><div data-message-author-role="assistant"><div class="markdown"><p>Hi there</p></div></div>') }));
  await ctx.route('https://www.genspark.ai/c/1', (r) => r.fulfill({ contentType: 'text/html', body: chat('Maths - Genspark AI Chat') }));
  await ctx.route('https://www.google.com/search?q=cats', (r) => r.fulfill({ contentType: 'text/html', body: mk('cats - Google Search', '<h1>Results</p>') }));

  // --- in-page button on a known site, then click it
  {
    const p = await ctx.newPage(); watch(p, 'chatgpt');
    await p.goto('https://chatgpt.com/c/1'); await p.bringToFront();
    await p.waitForTimeout(2500);
    await p.mouse.click(1280 - 18 - 21, 800 - 96 - 21);
    const ep = await toExportPage(ctx); watch(ep, 'export');
    assert.equal(await ep.locator('.msg').count(), 2);
    console.log('in-page button ok');
    await ep.close(); await p.close();
  }
  // --- registry-known site without selectors -> generic adapter + auto-detect
  {
    const p = await ctx.newPage(); watch(p, 'genspark');
    await p.goto('https://www.genspark.ai/c/1'); await p.bringToFront(); await p.waitForTimeout(500);
    const info = await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return chrome.tabs.sendMessage(t.id, { type: 'scan' }); });
    assert.equal(info.siteName, 'Genspark AI Chat'); assert.equal(info.generic, true); assert.equal(info.auto, true); assert.equal(info.count, 2);
    console.log('generic known site ok');
    await p.close();
  }
  // --- normal Google search must NOT be treated as AI Mode
  {
    const p = await ctx.newPage(); watch(p, 'google');
    await p.goto('https://www.google.com/search?q=cats'); await p.waitForTimeout(600);
    const info = await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return chrome.tabs.sendMessage(t.id, { type: 'scan' }); });
    assert.notEqual(info.siteName, 'Google AI Mode');
    assert.equal(info.count, 0);
    await p.close();
  }

  // --- theme switcher
  const pop = await ctx.newPage(); watch(pop, 'popup');
  await pop.goto(`chrome-extension://${extId}/popup.html`); await pop.waitForSelector('#sname');
  await pop.waitForTimeout(400);
  const ui = () => pop.evaluate(() => document.documentElement.dataset.ui);
  const first = await ui();
  assert.ok(first === 'light' || first === 'dark');
  await pop.click('[data-theme-toggle]');
  const second = await ui(); assert.notEqual(second, first);
  await pop.screenshot({ path: path.join(OUT, `popup-${second}.png`) });
  await pop.click('[data-theme-toggle]');
  assert.equal(await ui(), first);
  await pop.click('[data-theme-toggle]');         // end on the flipped value, then check persistence elsewhere
  await pop.screenshot({ path: path.join(OUT, `popup-${first === 'dark' ? 'light' : 'dark'}-b.png`) });
  const stored = await sw.evaluate(() => chrome.storage.local.get('archivAiUi'));
  assert.equal(stored.archivAiUi, second);

  const dash = await ctx.newPage(); watch(dash, 'dashboard');
  await dash.goto(`chrome-extension://${extId}/dashboard.html#settings`); await dash.waitForSelector('#addSamples');
  assert.equal(await dash.evaluate(() => document.documentElement.dataset.ui), second, 'theme shared with dashboard');
  assert.equal(await dash.isChecked('#floatBtn'), true);
  await dash.click('#addSamples'); await dash.waitForTimeout(700);
  await dash.goto(`chrome-extension://${extId}/dashboard.html`); await dash.waitForSelector('.rc');
  await dash.setViewportSize({ width: 1420, height: 920 });
  for (const mode of ['light', 'dark']) {
    await dash.evaluate((m) => window.ArchivAiTheme.apply(m), mode);
    assert.equal(await dash.evaluate(() => document.documentElement.dataset.ui), mode);
    await dash.waitForTimeout(250);
    await dash.screenshot({ path: path.join(OUT, `dashboard-${mode}.png`) });
  }
  // --- sites view
  await dash.goto(`chrome-extension://${extId}/dashboard.html#sites`); await dash.waitForSelector('.sitecard');
  const total = await dash.locator('.sitecard').count();
  assert.ok(total >= 230, 'all tools listed: ' + total);
  await dash.fill('#siteSearch', 'cursor');
  assert.equal(await dash.locator('.sitecard').count(), 1);
  assert.match(await dash.locator('.sitecard').first().innerText(), /NO WEB PAGE/);
  await dash.fill('#siteSearch', '');
  await dash.selectOption('#siteCat', 'image');
  const img = await dash.locator('.sitecard').count(); assert.ok(img > 10 && img < total);
  await dash.selectOption('#siteCat', '');
  await dash.selectOption('#siteTier', 'selectors');
  assert.equal(await dash.locator('.sitecard').count(), 15);
  await dash.selectOption('#siteTier', '');
  for (const mode of ['light', 'dark']) {
    await dash.evaluate((m) => window.ArchivAiTheme.apply(m), mode);
    await dash.screenshot({ path: path.join(OUT, `sites-${mode}.png`) });
  }
  // float button setting
  await dash.goto(`chrome-extension://${extId}/dashboard.html#settings`); await dash.waitForSelector('#floatBtn');
  await dash.uncheck('#floatBtn'); await dash.waitForTimeout(200);
  assert.equal((await sw.evaluate(() => chrome.storage.sync.get('floatBtn'))).floatBtn, false);
  // export page toggle
  await sw.evaluate(() => chrome.storage.sync.clear());
  assert.deepEqual(errors, [], errors.join('\n'));
  await ctx.close();
  console.log('A: theme, sites view, float button ok');
}

// ======================= B. on-demand injection on any page =======================
{
  const tmp = '/tmp/archiv-ai-inject-copy'; fs.rmSync(tmp, { recursive: true, force: true });
  fs.cpSync(EXT, tmp, { recursive: true, filter: (s) => !s.includes('node_modules') && !s.endsWith('.zip') });
  const m = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json')));
  m.host_permissions = ['<all_urls>'];                 // stands in for the activeTab grant a real click gives
  fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(m));
  const ctx = await launch(tmp);
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  await ctx.route('https://my-new-ai.test/chat', (r) => r.fulfill({ contentType: 'text/html', body: chat('Brand new AI') }));
  await ctx.route('http://localhost:3000/', (r) => r.fulfill({ contentType: 'text/html', body: chat('Open WebUI') }));
  await ctx.route('https://elicit.com/notebook/1', (r) => r.fulfill({ contentType: 'text/html', body: chat('Review - Elicit') }));
  const extId = sw.url().split('/')[2];
  const host = await ctx.newPage(); await host.goto(`chrome-extension://${extId}/dashboard.html`); // extension page can import() lib/inject.js
  const viaInject = (url, msg = { type: 'scan' }) => host.evaluate(async ([u, mg]) => {
    const { sendToTab } = await import(chrome.runtime.getURL('lib/inject.js'));
    const [t] = await chrome.tabs.query({ url: u });
    return sendToTab(t.id, t.url, mg);
  }, [url, msg]);
  for (const [url, name, id] of [['https://my-new-ai.test/chat', 'my-new-ai.test', 'host:my-new-ai.test'], ['http://localhost:3000/', 'Open WebUI', 'openwebui'], ['https://elicit.com/notebook/1', 'Elicit', 'elicit']]) {
    const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(400);
    const info = await viaInject(url);
    assert.equal(info.supported, true, url); assert.equal(info.siteName, name, url); assert.equal(info.site, id, url);
    assert.equal(info.count, 2, url); assert.equal(info.auto, true, url);
    // injecting twice must not break anything
    const again = await viaInject(url); assert.equal(again.count, 2);
    console.log('injected ok:', name);
    await p.close();
  }
  // full export through injection
  const p = await ctx.newPage(); await p.goto('https://my-new-ai.test/chat');
  await viaInject('https://my-new-ai.test/chat', { type: 'export', autoload: false });
  const ep = await toExportPage(ctx);
  assert.match(await ep.locator('#preview').innerText(), /What is 2\+2\?[\s\S]*It is 4/);
  // non-injectable pages are refused cleanly
  const bad = await host.evaluate(async () => { const { isInjectable } = await import(chrome.runtime.getURL('lib/inject.js')); return [isInjectable('chrome://extensions'), isInjectable('https://chromewebstore.google.com/x'), isInjectable('https://a.com')]; });
  assert.deepEqual(bad, [false, false, true]);
  await ctx.close();
  console.log('B: on-demand injection ok');
}
console.log('\nE2E v0.4 PASSED');
