import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const EXT = path.resolve(new URL('..', import.meta.url).pathname);
const ctx = await chromium.launchPersistentContext('/tmp/cv-profile-8-' + Date.now(), { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = sw.url().split('/')[2];
const p = await ctx.newPage(); await p.goto(`chrome-extension://${id}/export.html`);
const md = await p.evaluate(() => {
  const d = document.createElement('div');
  d.innerHTML = `<p>Real answer text.</p>
    <div class="flex gap-2"><button>Copy</button><span class="copy-button">CopiedFailed to copyCopy</span></div>
    <div role="status" aria-live="polite">Copied to clipboard</div>
    <div class="toast-wrapper">Failed to copy to clipboard. Try again later.</div>
    <div data-testid="copy-turn-action-button"><span>Copy</span></div>
    <pre><code>Copy this line</code></pre>
    <p>Second paragraph about how to copy a file.</p>`;
  return globalThis.CV.toMarkdown(d);
});
assert.ok(!/Copied|Failed to copy|Try again later/.test(md), md);
assert.ok(md.includes('Real answer text.') && md.includes('Copy this line') && md.includes('how to copy a file'), md);
console.log('V08 E2E PASSED'); await ctx.close();
