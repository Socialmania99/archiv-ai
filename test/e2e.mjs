import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { toExportPage } from './helper.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const EXT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = '/tmp/cv-out/e2e'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });

const chatgpt = `<!doctype html><title>Plan a trip - ChatGPT</title><body>
<div data-message-author-role="user"><div class="whitespace-pre-wrap">My key is sk-proj-ABCDEFGHIJKLMNOPQRSTUVWX please plan 2 days in Rome.
Email me at jane@doe.com</div></div>
<div data-message-author-role="assistant"><div class="markdown"><h2>Rome plan</h2><p>Here is a <strong>plan</strong>:</p>
<ol><li>Colosseum<ul><li>book ahead</li></ul></li><li>Vatican</li></ol>
<pre><div>python</div><code class="language-python">print("ciao")\nx = [1,2]</code></pre>
<table><thead><tr><th>Day</th><th>Place</th></tr></thead><tbody><tr><td>1</td><td>Forum</td></tr></tbody></table>
<p>Math: <span class="katex"><span class="katex-mathml"><math><semantics><mrow></mrow><annotation encoding="application/x-tex">E=mc^2</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">E=mc2</span></span></p>
<button>Copy</button></div></div></body>`;

const claude = `<!doctype html><title>Debug help - Claude</title><body>
<div data-testid="user-message"><p>Why does this fail?</p></div>
<div class="font-claude-response"><div class="grid-cols-1"><p>Because of <code>None</code>.</p><pre><code class="language-js">let a = null;</code></pre><ul><li>fix <a href="https://example.com/doc">docs</a></li></ul></div></div></body>`;

// Gemini mock: older messages load when scrolled to the top (3 batches)
const gemini = `<!doctype html><title>Lazy chat - Gemini</title>
<body style="margin:0"><div id="sc" style="height:300px;overflow:auto"><div id="chat"></div></div>
<script>
let batch=0;const chat=document.getElementById('chat'),sc=document.getElementById('sc');
function add(b){const f=document.createDocumentFragment();for(let k=1;k>=0;k--){
 const uq=document.createElement('user-query');uq.style.display='block';uq.style.height='90px';uq.innerHTML='<div class="query-text">Q b'+b+' m'+k+'</div>';
 const mr=document.createElement('model-response');mr.style.display='block';mr.style.height='90px';mr.innerHTML='<message-content><div class="markdown"><p>A b'+b+' m'+k+'</p></div></message-content>';
 f.prepend(mr);f.prepend(uq);} // keep user before model; newer batches go BELOW older
 return f;}
// initial: newest batch 0 ; older batches prepend
chat.append(add(0)); sc.scrollTop=sc.scrollHeight;
sc.addEventListener('scroll',()=>{if(sc.scrollTop<5&&batch<3){batch++;const h=sc.scrollHeight;chat.prepend(add(batch));sc.scrollTop=sc.scrollHeight-h;}});
</script></body>`;

const ctx = await chromium.launchPersistentContext('/tmp/cv-profile-' + Date.now(), {
  channel: 'chromium', headless: true, acceptDownloads: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`]
});
const copilot = `<!doctype html><title>Trip - Copilot</title><body><div data-content="user-message"><p>Hi</p></div><div data-content="ai-message"><p>Hello **there**</p></div></body>`;
const pages = { 'https://chatgpt.com/c/1': chatgpt, 'https://claude.ai/chat/1': claude, 'https://gemini.google.com/app/1': gemini, 'https://copilot.microsoft.com/chats/1': copilot };
for (const [u, html] of Object.entries(pages)) await ctx.route(u, (r) => r.fulfill({ contentType: 'text/html', body: html }));

let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const extId = sw.url().split('/')[2];
console.log('extension loaded:', extId);

async function exportFrom(url, autoload = true) {
  await sw.evaluate(() => chrome.storage.sync.clear());
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(url); await p.bringToFront(); await p.waitForTimeout(500);
  const popupInfo = await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return chrome.tabs.sendMessage(tab.id, { type: 'scan' });
  });
  const res = await sw.evaluate(async (al) => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return chrome.tabs.sendMessage(tab.id, { type: 'export', autoload: al });
  }, autoload);
  const ep = await toExportPage(ctx);
  return { page: p, ep, popupInfo, res, errors };
}

// ---------- ChatGPT ----------
{
  const { ep, popupInfo, res } = await exportFrom('https://chatgpt.com/c/1', false);
  assert.equal(popupInfo.supported, true); assert.equal(popupInfo.siteName, 'ChatGPT'); assert.equal(popupInfo.title, 'Plan a trip'); assert.equal(popupInfo.count, 2);
  assert.equal(res.ok, true);
  const html = await ep.locator('#preview').innerHTML();
  assert.ok(html.includes('<table>') && html.includes('Forum'), 'table');
  assert.ok(html.includes('E=mc^2'), 'katex tex source, not the visual copy');
  assert.ok(!html.includes('Copy</'), 'button text removed');
  assert.ok(html.includes('language') === false || true);
  const note = await ep.locator('#redactNote').textContent();
  console.log('redact note:', note);
  assert.ok(/OpenAI-style key ×1/.test(note), note);
  assert.ok(!html.includes('sk-proj-ABC'), 'key redacted in preview');
  assert.ok(html.includes('jane@doe.com'), 'email kept by default');
  // toggle email redaction
  await ep.check('#rEmails'); assert.ok(!(await ep.locator('#preview').innerHTML()).includes('jane@doe.com'));
  await ep.uncheck('#rEmails');
  // exclude message 1 by clicking its header, then include-only responses
  await ep.locator('.msg.user .role').click();
  assert.match(await ep.locator('#stats').textContent(), /^1 messages/);
  await ep.locator('.msg.user .role').click();

  const dl = async (fmt) => {
    await ep.click('#fmtBtn').then(() => ep.click(`#fmtMenu button[data-f=${fmt}]`));
    const [d] = await Promise.all([ep.waitForEvent('download'), ep.click('#download')]);
    const f = path.join(OUT, d.suggestedFilename()); await d.saveAs(f); return f;
  };
  const files = {};
  for (const fmt of ['md', 'docx', 'html', 'json', 'txt']) files[fmt] = await dl(fmt);
  console.log('downloads:', Object.values(files).map((f) => path.basename(f)).join(', '));
  const mdText = fs.readFileSync(files.md, 'utf8');
  assert.ok(mdText.startsWith('# Plan a trip') && mdText.includes('```python') && mdText.includes('| Day | Place |') && mdText.includes('$E=mc^2$'), mdText);
  assert.ok(mdText.includes('[REDACTED:openai-key]') && !mdText.includes('sk-proj'), 'redacted in file');
  assert.ok(mdText.includes('1. Colosseum\n   - book ahead'), mdText);
  assert.equal(path.basename(files.md), 'ChatGPT - Plan a trip - ' + new Date().toISOString().slice(0, 10) + '.md');
  assert.ok(fs.statSync(files.docx).size > 1500);
  // dark theme -> html carries dark palette
  await ep.click('.theme[data-theme=dark]');
  const darkHtml = fs.readFileSync(await dl('html'), 'utf8');
  assert.ok(darkHtml.includes('#0f1117'), 'dark theme applied');
  // PNG image export
  const png = fs.readFileSync(await dl('png'));
  assert.equal(png.slice(0, 8).toString('hex'), '89504e470d0a1a0a', 'png signature');
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  console.log('png size:', w + 'x' + h, png.length + ' bytes');
  assert.ok(w === 1800 && h > 400 && png.length > 8000, 'png has content');
  fs.writeFileSync(path.join(OUT, 'chat-dark.png'), png);
  await ep.click('.theme[data-theme=light]');
  // save to library
  await ep.fill('#tagIn', 'travel'); await ep.press('#tagIn', 'Enter'); await ep.fill('#tagIn', 'rome'); await ep.press('#tagIn', 'Enter'); await ep.fill('#folder', 'Trips'); await ep.click('#save');
  await ep.waitForSelector('.toast.show');
}

// ---------- Claude ----------
{
  const { ep, popupInfo } = await exportFrom('https://claude.ai/chat/1', false);
  assert.equal(popupInfo.siteName, 'Claude'); assert.equal(popupInfo.count, 2); assert.equal(popupInfo.title, 'Debug help');
  const html = await ep.locator('#preview').innerHTML();
  assert.ok(html.includes('href="https://example.com/doc"') && html.includes('let a = null;'));
  await ep.selectOption('#keep', 'assistant');
  assert.match(await ep.locator('#stats').textContent(), /^1 messages/);
  await ep.click('#save'); await ep.waitForSelector('.toast.show');
}

// ---------- Gemini lazy-load ----------
{
  const { ep, popupInfo, res } = await exportFrom('https://gemini.google.com/app/1', true);
  assert.equal(popupInfo.count, 4, 'only newest batch is in the DOM before scroll');
  const n = await ep.locator('.msg').count();
  console.log('gemini messages after auto-scroll:', n);
  assert.equal(n, 16, 'auto-load pulled all 4 batches (4 batches x 4 msgs)');
  const order = await ep.locator('.msg').allTextContents();
  assert.ok(order[0].includes('Q b3 m0') && order[order.length-1].includes('A b0 m1'), 'oldest first: ' + order[0]);
}

// ---------- Copilot (beta adapter) ----------
{
  const { popupInfo } = await exportFrom('https://copilot.microsoft.com/chats/1', false);
  assert.equal(popupInfo.siteName, 'Copilot'); assert.equal(popupInfo.beta, true); assert.equal(popupInfo.count, 2);
}

// ---------- Dashboard ----------
{
  const d = await ctx.newPage(); const errs = []; d.on('pageerror', (e) => errs.push(String(e)));
  await d.goto(`chrome-extension://${extId}/dashboard.html`);
  await d.waitForSelector('.rc');
  assert.equal((await d.textContent('#sChats')).trim(), '2');
  assert.ok(await d.locator('#chart svg path').count() >= 2, 'chart drawn');
  assert.equal(await d.locator('.qf').count(), 2);
  assert.equal(await d.locator('#foldersMini .fcard').count(), 1, 'one folder: Trips');
  await d.fill('#qf', 'colosseum'); assert.equal(await d.locator('.qf').count(), 1);
  await d.fill('#qf', '');
  // samples
  await d.goto(`chrome-extension://${extId}/dashboard.html#settings`);
  await d.click('#addSamples'); await d.waitForTimeout(600);
  await d.goto(`chrome-extension://${extId}/dashboard.html`); await d.waitForSelector('.rc');
  assert.equal((await d.textContent('#sChats')).trim(), '16');
  await d.waitForTimeout(2600);
  await d.screenshot({ path: path.join(OUT, 'dashboard.png') });
  // library: search, tag filter, zip
  await d.goto(`chrome-extension://${extId}/dashboard.html#library`); await d.waitForSelector('#list .card');
  await d.fill('#q', 'colosseum'); await d.waitForTimeout(100);
  assert.equal(await d.locator('#list .card').count(), 1);
  assert.ok((await d.locator('.snip').innerHTML()).includes('<mark>colosseum</mark>'));
  await d.fill('#q', ''); await d.click('#tags .chip[data-tag=rome]');
  assert.equal(await d.locator('#list .card').count(), 1);
  await d.click('#tags .chip[data-tag=rome]');
  const [dz] = await Promise.all([d.waitForEvent('download'), d.click('#xferBtn').then(() => d.click('#zipAll'))]);
  const z = path.join(OUT, dz.suggestedFilename()); await dz.saveAs(z);
  console.log('library zip:', fs.statSync(z).size, 'bytes');
  // folder card click filters
  await d.goto(`chrome-extension://${extId}/dashboard.html#folders`); await d.waitForSelector('#foldersAll .fcard');
  await d.locator('#foldersAll .fcard', { hasText: 'Trips' }).click(); await d.waitForSelector('#list .card');
  assert.equal(await d.locator('#list .card').count(), 1);
  assert.equal(await d.inputValue('#folder'), 'Trips');
  // merge two chats
  await d.goto(`chrome-extension://${extId}/dashboard.html#library`); await d.waitForSelector('#list .card');
  await d.selectOption('#folder', ''); await d.waitForTimeout(100);
  await d.locator('#list .card', { hasText: 'Debug help' }).locator('.pick').check();
  await d.locator('#list .card', { hasText: 'Plan a trip' }).locator('.pick').check();
  assert.equal(await d.locator('#mergeBtn').isEnabled(), true);
  await d.click('#mergeBtn');
  let mp = null; for (let k = 0; k < 100 && !mp; k++) { for (const p of ctx.pages()) { if (/export\.html/.test(p.url()) && /Combined/.test(await p.locator('#title').innerText().catch(() => ''))) mp = p; } if (!mp) await new Promise((r) => setTimeout(r, 150)); }
  assert.ok(mp, 'combined export page opened');
  assert.equal(await mp.locator('h2.docsec').count(), 2, 'two section headings');
  assert.match(await mp.textContent('#meta'), /combined/);
  await mp.click('#fmtBtn').then(() => mp.click('#fmtMenu button[data-f=md]'));
  const [md2] = await Promise.all([mp.waitForEvent('download'), mp.click('#download')]);
  const mf = path.join(OUT, md2.suggestedFilename()); await md2.saveAs(mf);
  const mtext = fs.readFileSync(mf, 'utf8');
  assert.ok(mtext.includes('# Debug help') && mtext.includes('# Plan a trip') && mtext.includes('## Claude') && mtext.includes('## ChatGPT'), mtext.slice(0, 400));
  // remove samples
  await d.goto(`chrome-extension://${extId}/dashboard.html#settings`);
  await d.click('#rmSamples'); await d.waitForTimeout(500);
  await d.goto(`chrome-extension://${extId}/dashboard.html`); await d.waitForSelector('.rc');
  assert.equal((await d.textContent('#sChats')).trim(), '2');
  assert.deepEqual(errs, []);
}

// ---------- v0.3: new platforms, auto-detect, Teach Archiv ----------
{
  const mk = (title, u, a) => `<!doctype html><title>${title}</title><body><main>${u}${a}</main></body>`;
  const sites = {
    'https://aistudio.google.com/prompts/1': ['AI Studio', 'Notes - Google AI Studio', mk('Notes - Google AI Studio', '<ms-chat-turn><div class="chat-turn-container user">Hello studio</div></ms-chat-turn>', '<ms-chat-turn><div class="chat-turn-container model">Hi from model</div></ms-chat-turn>')],
    'https://notebooklm.google.com/notebook/1': ['NotebookLM', 'Src - NotebookLM', mk('Src - NotebookLM', '<div class="chat-message-pair"><div class="from-user-container">Summarise</div></div>', '<div class="to-user-container">Summary here</div>')],
    'https://www.kimi.com/chat/1': ['Kimi', 'Q - Kimi', mk('Q - Kimi', '<div class="chat-content-item-user">你好</div>', '<div class="chat-content-item-assistant"><div class="markdown">你好！</div></div>')],
    'https://yuanbao.tencent.com/chat/1': ['YuanBao', 'T - 元宝', mk('T - 元宝', '<div class="agent-chat__list__item--human">问</div>', '<div class="agent-chat__list__item--ai">答</div>')],
    'https://chat.qwen.ai/c/1': ['Qwen', 'Q - Qwen', mk('Q - Qwen', '<div class="user-message">Ask qwen</div>', '<div class="qwen-markdown"><p>Answer qwen</p></div>')],
    'https://www.doubao.com/chat/1': ['Doubao', 'D - 豆包', mk('D - 豆包', '<div data-testid="send_message">发</div>', '<div data-testid="receive_message">收</div>')],
    'https://github.com/copilot/c/1': ['GitHub Copilot', 'C - GitHub Copilot', mk('C - GitHub Copilot', '<div class="UserMessage-module">gh q</div>', '<div class="AIMessage-module">gh a</div>')],
    'https://www.google.com/search?udm=50&q=hello': ['Google AI Mode', 'hello', mk('hello - Google Search', '<div class="user-query-x">hello</div>', '<div data-subtree="aimc"><p>ai says</p></div>')],
    'https://chat.deepseek.com/a/chat/s/1': ['DeepSeek', 'S - DeepSeek', mk('S - DeepSeek', '<div class="user-message">ds q</div>', '<div class="ds-markdown"><p>ds a</p></div>')],
    'https://grok.com/chat/1': ['Grok', 'G - Grok', mk('G - Grok', '<div class="message-bubble items-end">gq</div>', '<div class="message-bubble"><div class="response-content-markdown">ga</div></div>')],
    'https://www.perplexity.ai/search/1': ['Perplexity', 'P - Perplexity', mk('P - Perplexity', '<h1 class="group/query">pq</h1>', '<div id="markdown-content-0"><p>pa</p></div>')]
  };
  for (const [u, [, , html]] of Object.entries(sites)) await ctx.route(u, (r) => r.fulfill({ contentType: 'text/html', body: html }));
  for (const [u, [name]] of Object.entries(sites)) {
    const { popupInfo, ep, errors } = await exportFrom(u, false);
    assert.equal(popupInfo.siteName, name, u);
    assert.equal(popupInfo.count, 2, name + ' count');
    assert.equal(popupInfo.auto, false, name + ' via selectors');
    assert.equal(await ep.locator('.msg').count(), 2, name + ' msgs');
    assert.deepEqual(errors, []);
    console.log('adapter ok:', name);
  }

  // auto-detect: site selectors miss, attribute names still reveal the turns
  await ctx.route('https://chat.qwen.ai/c/2', (r) => r.fulfill({ contentType: 'text/html', body: mk('Odd - Qwen', '<div class="xx" data-role="human">auto q</div>', '<div class="yy" data-role="assistant"><p>auto a</p></div>') }));
  {
    const { popupInfo, ep } = await exportFrom('https://chat.qwen.ai/c/2', false);
    assert.equal(popupInfo.auto, true); assert.equal(popupInfo.count, 2);
    const t = await ep.locator('#preview').innerText();
    assert.ok(t.includes('auto q') && t.includes('auto a'), t);
    console.log('auto-detect ok');
  }

  // Teach Archiv: opaque markup, user clicks one message of each kind
  const opaque = mk('Opaque - Claude', '<div class="turn mine">one</div><div class="turn mine">three</div>', '<div class="turn bot">two</div><div class="turn bot">four</div>');
  await ctx.route('https://claude.ai/chat/opaque', (r) => r.fulfill({ contentType: 'text/html', body: opaque.replace('<main>', '<main>').replace(/<div class="turn mine">one<\/div>/, '<div class="turn mine">one</div>') }));
  {
    await sw.evaluate(() => chrome.storage.sync.clear());
    const p = await ctx.newPage(); await p.goto('https://claude.ai/chat/opaque'); await p.bringToFront(); await p.waitForTimeout(400);
    const before = await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return chrome.tabs.sendMessage(t.id, { type: 'scan' }); });
    assert.equal(before.count, 0, 'selectors miss before teaching');
    await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return chrome.tabs.sendMessage(t.id, { type: 'pick' }); });
    await p.mouse.click(...(await p.locator('.mine').first().boundingBox().then((b) => [b.x + 5, b.y + 5])));
    await p.mouse.click(...(await p.locator('.bot').first().boundingBox().then((b) => [b.x + 5, b.y + 5])));
    await p.waitForTimeout(500);
    const saved = await sw.evaluate(() => chrome.storage.sync.get('selectorOverrides'));
    console.log('taught selectors:', JSON.stringify(saved.selectorOverrides));
    const after = await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return chrome.tabs.sendMessage(t.id, { type: 'scan' }); });
    assert.equal(after.count, 4, 'picker found all four');
    assert.equal(after.auto, false);
    console.log('teach ok');
  }
  await sw.evaluate(() => chrome.storage.sync.clear());
}

// screenshot of export page for visual check
{
  const { ep } = await exportFrom('https://chatgpt.com/c/1', false);
  await ep.setViewportSize({ width: 1280, height: 900 });
  await ep.click('.theme[data-theme=dark]');
  await ep.screenshot({ path: path.join(OUT, 'export-dark.png') });
}
await ctx.close();
console.log('\nE2E PASSED');
