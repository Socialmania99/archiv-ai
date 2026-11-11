import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { toExportPage } from './helper.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const EXT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = '/tmp/cv-out/e2e-obs'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const ctx = await chromium.launchPersistentContext('/tmp/cv-profile-o-' + Date.now(), { channel: 'chromium', headless: true, acceptDownloads: true, viewport: { width: 1400, height: 900 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = sw.url().split('/')[2]; const errs = [];
await ctx.route('https://claude.ai/chat/1', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset=utf-8><title>Debug: "loop" - Claude</title><div data-testid="user-message"><p>Why does this fail? key sk-proj-ABCDEFGHIJKLMNOPQRSTUVWX</p></div><div class="font-claude-response"><p>Because of <code>None</code>.</p><pre><code class="language-js">let a = null;</code></pre></div>' }));
const p = await ctx.newPage(); await p.goto('https://claude.ai/chat/1'); await p.bringToFront(); await p.waitForTimeout(400);
await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return chrome.tabs.sendMessage(t.id, { type: 'export', autoload: false }); });
const ep = await toExportPage(ctx); ep.on('pageerror', (e) => errs.push(String(e)));
assert.equal(await ep.locator('#obsOpts').isHidden(), true); assert.equal(await ep.locator('#obOpen').isHidden(), true);
await ep.click('#fmtBtn').then(() => ep.click('#fmtMenu button[data-f=obsidian]'));
assert.equal(await ep.locator('#obsOpts').isVisible(), true); assert.equal(await ep.locator('#obOpen').isVisible(), true);
assert.equal(await ep.locator('#download').innerText(), 'Download note');
await ep.fill('#obVault', 'Second Brain'); await ep.fill('#obFolder', 'AI/Chats'); await ep.locator('#obFolder').blur();
// download
const [dl] = await Promise.all([ep.waitForEvent('download'), ep.click('#download')]);
const f = path.join(OUT, dl.suggestedFilename()); await dl.saveAs(f);
assert.ok(!/[:"#^\[\]|]/.test(dl.suggestedFilename().replace(/\.md$/, '')), 'safe note name: ' + dl.suggestedFilename());
const note = fs.readFileSync(f, 'utf8'); console.log(note);
assert.ok(note.startsWith('---\ntitle: "Debug: \\"loop\\""\nsite: "Claude"'));
assert.ok(note.includes('tags:\n  - ai-chat\n  - claude\n---'));
assert.ok(note.includes('> [!question] You') && note.includes('> [!note] Claude') && note.includes('> ```js\n> let a = null;\n> ```'));
assert.ok(note.includes('[REDACTED:openai-key]') && !note.includes('sk-proj'), 'redaction applies');
// headings layout
await ep.selectOption('#obStyle', 'headings');
const [dl2] = await Promise.all([ep.waitForEvent('download'), ep.click('#download')]);
await dl2.saveAs(path.join(OUT, 'h.md')); assert.ok(fs.readFileSync(path.join(OUT, 'h.md'), 'utf8').includes('### You'));
await ep.selectOption('#obStyle', 'callouts');
// open in Obsidian: note lands on the clipboard
await ep.click('#obOpen'); await ep.waitForSelector('.toast.show');
const clip = await ep.evaluate(() => navigator.clipboard.readText());
assert.ok(clip.startsWith('---\ntitle:') && clip.includes('> [!note] Claude'), clip.slice(0, 80));
// settings persisted
const st = await sw.evaluate(() => chrome.storage.sync.get('settings'));
assert.equal(st.settings.obVault, 'Second Brain'); assert.equal(st.settings.obFolder, 'AI/Chats');
// library zip
await ep.fill('#folder', 'Dev/Bugs'); await ep.fill('#tagIn', 'python'); await ep.press('#tagIn', 'Enter'); await ep.fill('#tagIn', 'my tag'); await ep.press('#tagIn', 'Enter'); await ep.evaluate(() => document.getElementById('save').click()); await ep.waitForFunction(() => /Saved|Updated|Replaced|failed/.test(document.querySelector('.toast').textContent), null, { timeout: 8000 }).catch(() => {}); 
const d = await ctx.newPage(); d.on('pageerror', (e) => errs.push(String(e)));
await d.goto(`chrome-extension://${id}/dashboard.html#library`); await d.waitForSelector('#list .card');
const [zdl] = await Promise.all([d.waitForEvent('download'), d.click('#xferBtn').then(() => d.click('#zipObs'))]);
const zf = path.join(OUT, 'obs.zip'); await zdl.saveAs(zf);
const { execFileSync } = await import('node:child_process');
const listing = execFileSync('unzip', ['-l', zf]).toString(); console.log(listing);
assert.match(listing, /Dev\/Bugs\/Debug loop \(Claude\)\.md/);
const first = execFileSync('unzip', ['-p', zf]).toString();
assert.ok(first.includes('  - python\n  - my-tag'), 'library tags carried into frontmatter');
assert.deepEqual(errs, [], errs.join('\n'));
await ctx.close(); console.log('OBSIDIAN E2E PASSED');
