import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseBlocks, parseInline, blocksToText } from '../lib/markdown.js';
import { redact } from '../lib/redact.js';
import { zip, crc32 } from '../lib/zip.js';
import { toDocxBlob } from '../lib/docx.js';
import { toHtmlDoc, toMarkdownDoc, toTextDoc, toJsonDoc, makeFilename, pickMessages, palette, stats as msgStats } from '../lib/render.js';
import { computeStats, activitySeries, compact, DAY } from '../lib/stats.js';
import { makeSamples } from '../lib/sample.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

const md = `# Title

Hello **bold** and *it* and \`code\` and [link](https://x.com/a_b) snake_case_word 5 * 3 * 2.
Second line same paragraph.

- one
  - nested a
  - nested b
- two

1. first
2. second
   with continuation

\`\`\`python
def f():
    return "a|b"
\`\`\`

> quoted **text**

| A | B |
| --- | --- |
| 1 | x \\| y |
| 2 | z |

---
![pic](https://img.test/a.png)`;

t('blocks', () => {
  const b = parseBlocks(md);
  assert.deepEqual(b.map((x) => x.t), ['h', 'p', 'ul', 'ol', 'code', 'quote', 'table', 'hr', 'p']);
  assert.equal(b[2].items[0].blocks[1].t, 'ul');
  assert.equal(b[2].items[0].blocks[1].items.length, 2);
  assert.equal(b[4].lang, 'python');
  assert.equal(b[4].text, 'def f():\n    return "a|b"');
  assert.equal(b[6].rows[0][1][0].s, 'x | y');
});
t('inline', () => {
  const i = parseInline('a **b** *c* `d` [e](https://f.com) snake_case_word 5 * 3 * 2');
  assert.ok(i.find((r) => r.s === 'b' && r.b));
  assert.ok(i.find((r) => r.s === 'c' && r.i));
  assert.ok(i.find((r) => r.s === 'd' && r.code));
  assert.ok(i.find((r) => r.s === 'e' && r.href === 'https://f.com'));
  const plain = i.map((r) => r.s || '').join('');
  assert.ok(plain.includes('snake_case_word'), plain);
  assert.ok(plain.includes('5 * 3 * 2'), plain);
});
t('text', () => assert.ok(blocksToText(parseBlocks(md)).includes('• nested a')));

t('redact', () => {
  const s = 'key sk-ant-abc123abc123abc123abc123 and sk-proj-AAAAAAAAAAAAAAAAAAAAAAAA AKIAABCDEFGHIJKLMNOP ghp_' + 'a'.repeat(36) +
    ' mail me@x.io call +1 415-555-0134 password: hunter2hunter Bearer abcdefghijklmnopqrstuvwxyz123456';
  const a = redact(s, { secrets: true });
  assert.ok(!/sk-ant|sk-proj|AKIA|ghp_|hunter2|abcdefghijklmnopqrstuvwxyz123456/.test(a.text), a.text);
  assert.ok(a.text.includes('me@x.io'));
  assert.ok(a.text.includes('password: [REDACTED:password-assign]'));
  const b = redact(s, { emails: true, phones: true });
  assert.ok(!b.text.includes('me@x.io') && !b.text.includes('415-555-0134'), b.text);
  assert.equal(redact('plain text', { secrets: true, emails: true, phones: true }).total, 0);
});

t('crc32', () => assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926));

const conv = { title: 'Test: A/B chat', site: 'claude', siteName: 'Claude', url: 'https://claude.ai/chat/1', exportedAt: '2026-11-08T10:00:00Z',
  messages: [{ i: 0, role: 'user', markdown: 'Write <b>code</b> & a table' }, { i: 1, role: 'assistant', markdown: md }] };

t('renderers', () => {
  const html = toHtmlDoc(conv, conv.messages);
  assert.ok(html.includes('&lt;b&gt;code&lt;/b&gt;'));
  assert.ok(!html.includes('<b>code</b>'));
  assert.ok(html.includes('<table>') && html.includes('<pre><code>'));
  assert.ok(toMarkdownDoc(conv, conv.messages).includes('## You'));
  assert.ok(toTextDoc(conv, conv.messages).includes('CLAUDE:'));
  assert.equal(JSON.parse(toJsonDoc(conv, conv.messages)).messages.length, 2);
  assert.equal(makeFilename('{site} - {title} - {date}', conv, 'md'), 'Claude - Test AB chat - 2026-11-08.md');
});
t('xss safe', () => {
  const evil = { ...conv, messages: [{ i: 0, role: 'assistant', markdown: '[x](javascript:alert(1)) ![i](javascript:alert(2)) <script>alert(3)</script>' }] };
  const html = toHtmlDoc(evil, evil.messages);
  assert.ok(!/href="javascript/i.test(html) && !/src="javascript/i.test(html) && !html.includes('<script>alert'));
});

t('themes', () => {
  assert.equal(palette({ theme: 'dark' }).bg, '#0f1117');
  assert.equal(palette({ theme: 'light', color: '#112233' }).fg, '#112233');
  assert.equal(palette({ theme: 'sepia', color: '#112233' }).fg, '#433422', 'custom colour only on light');
  assert.ok(toHtmlDoc(conv, conv.messages, { theme: 'sakura', font: 'Georgia', size: 11, page: 'A4' }).includes('#fff5f8'));
});
t('merged sections', () => {
  const merged = { title: 'Combined', site: 'multi', siteName: 'Archiv AI', exportedAt: '2026-11-08T10:00:00Z', messages: [
    { i: 0, role: 'section', markdown: 'First chat' }, { i: 1, role: 'user', markdown: 'q1' }, { i: 2, role: 'assistant', markdown: 'a1', siteName: 'Claude' },
    { i: 3, role: 'section', markdown: 'Second chat' }, { i: 4, role: 'assistant', markdown: 'a2', siteName: 'Gemini' }] };
  const onlyAi = pickMessages(merged, 'assistant');
  assert.deepEqual(onlyAi.map((m) => m.i), [0, 2, 3, 4], 'sections survive include filter');
  const md = toMarkdownDoc(merged, merged.messages);
  assert.ok(md.includes('# First chat') && md.includes('## Claude') && md.includes('## Gemini'), md);
  assert.equal(msgStats(merged.messages).messages, 3, 'sections not counted');
  assert.ok(toHtmlDoc(merged, merged.messages).includes('class="docsec"'));
  assert.ok(toTextDoc(merged, merged.messages).includes('FIRST CHAT'));
});
t('stats', () => {
  const now = new Date('2026-11-08T12:00:00').getTime();
  const chats = makeSamples(now);
  const st = computeStats(chats, now);
  assert.equal(st.totals.chats, 14);
  assert.ok(st.week.chats >= 4 && st.dailyChats.length === 7 && st.dailyChats[6] >= 2);
  assert.ok(st.folders.find((f) => f.name === 'Code').count >= 3);
  const m = activitySeries(chats, 'monthly', now);
  assert.equal(m.length, 8); assert.equal(m.reduce((a, b) => a + b.value, 0) <= 14, true); assert.equal(m[7].label, 'Nov');
  const w = activitySeries(chats, 'weekly', now);
  assert.equal(w.length, 8); assert.ok(w[7].value >= 4);
  assert.equal(compact(18200), '18.2K'); assert.equal(compact(999), '999'); assert.equal(compact(2500000), '2.5M');
  assert.ok(st.ringOf(chats[0]) > 0 && st.ringOf(chats[0]) <= 1);
  void DAY;
});

await import('../content/registry.js');
await import('../content/adapters.js');
t('registry integrity', () => {
  const R = CV.REGISTRY, ids = R.map((r) => r.id);
  assert.ok(R.length >= 230, 'entries ' + R.length);
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  for (const r of R) {
    assert.ok(CV.CATEGORIES[r.cat], 'category ' + r.id);
    assert.ok(['web', 'local', 'via', 'app'].includes(r.tier), 'tier ' + r.id);
    assert.ok(r.tier !== 'app' || r.note, 'app tier needs a reason: ' + r.id);
    assert.ok(r.tier !== 'via' || ids.includes(r.via), 'via target exists: ' + r.id);
    for (const h of r.hosts) assert.ok(/^[a-z0-9.-]+\.[a-z]+$/.test(h) && !h.includes('/'), 'host ' + h);
    assert.ok(!r.auto || (r.tier === 'web' && r.hosts.length), 'auto needs hosts: ' + r.id);
  }
  for (const a of CV.ADAPTERS) assert.ok(ids.includes(a.id), 'adapter has registry entry: ' + a.id);
  // every tool the user asked for is present
  const want = ['ChatGPT','Google Gemini','Microsoft Copilot','Claude','Meta AI','DeepSeek','Grok','Le Chat (Mistral)','Poe','YouChat','Pi','Chatsonic','HuggingChat','Duck.ai','LMArena (Chatbot Arena)','Genspark AI Chat','DeepAI Chat','GigaChat','Doubao','Kimi','Ernie Bot','Tencent Hunyuan','ChatGLM (Z.ai)','Yi Chat (01.AI)','StepChat','HKChat','Leo (Brave Browser)','Alice (Yandex)','iFlytek Spark','Cursor AI','Windsurf','Devin','Manus','Vercel v0','Bolt.new','Lovable.dev','Perplexity AI','NotebookLM','Open WebUI','LibreChat','Midjourney','Suno AI','Character.ai','Khanmigo','Yellow.ai','Otter.ai','Notion AI'];
  const names = new Set(R.map((r) => r.name));
  for (const w of want) assert.ok(names.has(w), 'missing ' + w);
  const asked = fs.readFileSync(new URL('./requested-tools.txt', import.meta.url), 'utf8').split('\n').filter(Boolean);
  const missing = asked.filter((x) => !names.has(x));
  assert.deepEqual(missing, [], 'requested tools missing');
});
t('manifest matches registry auto sites', () => {
  const m = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url)));
  const have = new Set(m.content_scripts[0].matches);
  for (const r of CV.REGISTRY.filter((x) => x.auto)) for (const h of r.hosts) {
    const p = `https://${h}/${r.path.replace(/^\//, '')}*`;
    assert.ok(have.has(p), 'manifest lacks ' + p);
  }
  assert.deepEqual(m.permissions.sort(), ['activeTab', 'contextMenus', 'scripting', 'storage', 'unlimitedStorage']);
  assert.ok(!m.host_permissions, 'no broad host permissions');
  assert.ok(m.description.length <= 132, 'store limit 132, got ' + m.description.length); assert.ok(m.name.length <= 75);
  assert.deepEqual(m.optional_host_permissions, ['https://api.notion.com/*']);
  for (const f of [...m.content_scripts[0].js, 'theme.js', 'popup.css', 'lib/inject.js']) assert.ok(fs.existsSync(new URL('../' + f, import.meta.url)), 'file ' + f);
});
t('sites list merges adapters', () => {
  const g = CV.SITES.find((s) => s.id === 'gemini'); assert.ok(g.selectors && g.url.startsWith('https://gemini'));
  const c = CV.SITES.find((s) => s.id === 'cursor'); assert.ok(!c.selectors && c.tier === 'app' && c.url === '');
  assert.match(CV.colorFor('whatever'), /^hsl\(/); assert.equal(CV.colorFor('chatgpt'), '#10a37f');
});

const N = await import('../lib/notion.js');
const { parseBlocks: pb } = await import('../lib/markdown.js');
t('notion: blocks', () => {
  const md = '# Head\n\nHello **bold** `code` [l](https://a.com/x) and [bad](javascript:alert(1)).\n\n- one\n  - two\n    - three\n      - four\n- b\n\n1. x\n2. y\n\n> quote\n\n```py\nprint(1)\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n| 3 |\n\n![pic](https://e.com/i.png)\n\n---';
  const b = N.blocksToNotion(pb(md));
  const types = b.map((x) => x.type);
  assert.deepEqual(types, ['heading_3', 'paragraph', 'bulleted_list_item', 'bulleted_list_item', 'numbered_list_item', 'numbered_list_item', 'quote', 'code', 'table', 'image', 'divider']);
  const rt = b[1].paragraph.rich_text;
  assert.ok(rt.some((r) => r.annotations && r.annotations.bold && r.text.content === 'bold'));
  assert.ok(rt.some((r) => r.text.link && r.text.link.url === 'https://a.com/x'));
  assert.ok(!JSON.stringify(rt).includes('javascript:'), 'unsafe link dropped');
  assert.equal(b[7].code.language, 'python');
  assert.equal(b[8].table.children.length, 3); assert.equal(b[8].table.children[2].table_row.cells.length, 2, 'rows padded to width');
  // depth: top(0) > two(1) > three(2); "four" flattened to a sibling at depth 2
  const li = b[2].bulleted_list_item.children[0];
  assert.equal(li.bulleted_list_item.children.length, 2);
  assert.equal(li.bulleted_list_item.children[0].bulleted_list_item.children, undefined);
});
t('notion: limits', () => {
  const long = 'x'.repeat(4500);
  const b = N.blocksToNotion(pb(long));
  assert.deepEqual(b[0].paragraph.rich_text.map((r) => r.text.content.length), [2000, 2000, 500]);
  const rows = Array.from({ length: 250 }, (_, i) => `| ${i} | v |`).join('\n');
  const tb = N.blocksToNotion(pb('| n | v |\n|---|---|\n' + rows));
  assert.ok(tb.length >= 3 && tb.every((x) => x.type === 'table' && x.table.children.length <= 100));
  assert.equal(N.parsePageId('https://www.notion.so/Team-Wiki-0123456789abcdef0123456789abcdef?pvs=4'), '01234567-89ab-cdef-0123-456789abcdef');
  assert.equal(N.parsePageId('01234567-89ab-cdef-0123-456789abcdef'), '01234567-89ab-cdef-0123-456789abcdef');
  assert.equal(N.parsePageId('hello'), null);
});
await (async () => {
  const conv = { title: 'T', siteName: 'Claude', exportedAt: '2026-11-09T00:00:00Z', url: 'https://claude.ai/c/1' };
  const msgs = Array.from({ length: 130 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', markdown: 'm' + i }));
  const { title, children } = N.conversationToNotion(conv, msgs);
  assert.equal(title, 'T'); assert.equal(children.length, 1 + 130 * 2);
  const calls = [];
  let n429 = 0;
  const fake = async (url, init) => {
    const body = JSON.parse(init.body || 'null');
    calls.push({ m: init.method, url, body, auth: init.headers.Authorization, ver: init.headers['Notion-Version'] });
    if (init.method === 'PATCH' && n429++ === 0) return { ok: false, status: 429, headers: { get: () => '0' }, json: async () => ({ message: 'slow' }) };
    return { ok: true, status: 200, json: async () => ({ id: 'pid', url: 'https://notion.so/pid', properties: { Name: { type: 'title', title: [{ plain_text: 'Wiki' }] } } }) };
  };
  const prog = [];
  const r = await N.sendToNotion({ token: 'secret_x', parentId: 'par', title, children, fetchImpl: fake, sleep: async () => {}, onProgress: (a, b) => prog.push([a, b]) });
  assert.equal(r.url, 'https://notion.so/pid');
  assert.equal(calls[0].m, 'POST'); assert.equal(calls[0].body.children.length, 100); assert.equal(calls[0].body.parent.page_id, 'par');
  assert.equal(calls[0].auth, 'Bearer secret_x'); assert.equal(calls[0].ver, '2022-06-28');
  const patches = calls.filter((c) => c.m === 'PATCH'); assert.equal(patches.length, 3, 'one 429 retry + 2 remaining chunks'); // 261 blocks = 100 + 100 + 61
  assert.deepEqual(patches.map((c) => c.body.children.length), [100, 100, 61]);
  assert.deepEqual(prog.at(-1), [3, 3]);
  assert.equal((await N.testNotion({ token: 't', parentId: 'p', fetchImpl: fake })).title, 'Wiki');
  const bad = (status) => async () => ({ ok: false, status, headers: { get: () => null }, json: async () => ({ message: 'm' }) });
  await assert.rejects(N.sendToNotion({ token: 't', parentId: 'p', title: 'x', children: [], fetchImpl: bad(404), sleep: async () => {} }), /Connections/);
  await assert.rejects(N.sendToNotion({ token: 't', parentId: 'p', title: 'x', children: [], fetchImpl: bad(401), sleep: async () => {} }), /token/);
  await assert.rejects(N.sendToNotion({ token: 't', parentId: 'p', title: 'x', children: [], fetchImpl: async () => { throw new Error('offline'); }, sleep: async () => {} }), /Could not reach/);
  n++; console.log('ok notion: send, chunking, retry, errors');
})();

const F = await import('../lib/find.js');
t('find in chat', () => {
  const msgs = [{ markdown: 'Hello hello HELLO <b>x</b>' }, { markdown: 'nothing' }, { markdown: 'say Hello. İstanbul' }];
  const r = F.findInChat(msgs, 'hello');
  assert.equal(r.total, 4); assert.deepEqual([...r.byMsg.keys()], [0, 2]);
  assert.deepEqual(r.byMsg.get(2).map((h) => h.n), [3]);
  assert.equal(F.findInChat(msgs, 'hello', { caseSensitive: true }).total, 1); assert.equal(F.findInChat(msgs, 'Hello', { caseSensitive: true }).total, 2);
  assert.equal(F.findInChat(msgs, '   ').total, 0); assert.equal(F.findInChat(msgs, '').total, 0);
  assert.equal(F.findInChat(msgs, '(').total, 0, 'regex metachars are literal'); assert.equal(F.findInChat([{ markdown: 'a (b) c' }], '(b)').total, 1);
  assert.equal(F.findInChat(msgs, 'istanbul').total, 0, 'no accent folding'); assert.equal(F.findInChat(msgs, 'İstanbul').total, 1);
  const html = F.highlightHtml(msgs[0].markdown, r.byMsg.get(0), 1);
  assert.equal(html, 'Hello'.replace('Hello', '<mark>Hello</mark>') + ' <mark class="cur">hello</mark> <mark>HELLO</mark> &lt;b&gt;x&lt;/b&gt;', html);
  assert.equal(F.highlightHtml('<i>', [], 0), '&lt;i&gt;');
  assert.equal(F.stepMatch(0, 3, -1), 2); assert.equal(F.stepMatch(2, 3, 1), 0); assert.equal(F.stepMatch(0, 0, 1), 0);
  const big = [{ markdown: 'a'.repeat(20000) }]; assert.equal(F.findInChat(big, 'a').total, 5000, 'capped');
});

const O = await import('../lib/obsidian.js');
t('obsidian notes', () => {
  const conv = { title: 'Fix: "React" loop?', siteName: 'Claude', site: 'claude', url: 'https://claude.ai/chat/1', exportedAt: '2026-11-09T10:00:00Z' };
  const msgs = [{ role: 'user', markdown: 'Why?\n\n```js\nlet a;\n```' }, { role: 'assistant', markdown: '# Because\n\n- one\n\n| a | b |\n|---|---|\n| 1 | 2 |' }];
  const d = O.toObsidianDoc(conv, msgs, { tags: ['My Tag', '2026', 'dev/tools'] });
  assert.ok(d.startsWith('---\ntitle: "Fix: \\"React\\" loop?"\nsite: "Claude"\nsource: "https://claude.ai/chat/1"\nexported: 2026-11-09\nmessages: 2\ntags:\n  - ai-chat\n  - claude\n  - my-tag\n  - dev/tools\n---\n'), d);
  assert.ok(!/- 2026/.test(d), 'numeric tag dropped');
  assert.ok(d.includes('> [!question] You\n> Why?\n>\n> ```js\n> let a;\n> ```\n'), d);
  assert.ok(d.includes('> [!note] Claude\n> # Because\n>\n> - one\n>\n> | a | b |'), d);
  const h = O.toObsidianDoc(conv, msgs, { style: 'headings' });
  assert.ok(h.includes('### You\n\nWhy?') && h.includes('### Claude\n\n# Because') && !h.includes('[!'));
  assert.ok(!O.toObsidianDoc({ ...conv, url: 'javascript:alert(1)' }, msgs).includes('source:'));
  assert.equal(O.safeNoteName('a/b:c*d?e"f<g>h|i#j^k[l]m'), 'abcdefghijklm'); assert.equal(O.safeNoteName('///'), 'Chat'); assert.equal(O.safeNoteName('.hidden'), 'hidden');
  assert.equal(O.safeFolder('AI Chats//Work/..:x'), 'AI Chats/Work/x'); assert.equal(O.safeFolder(''), '');
  assert.equal(O.obsidianUri({ vault: 'My Vault', folder: 'AI Chats', name: 'Plan: Rome #1' }), 'obsidian://new?vault=My%20Vault&file=AI%20Chats%2FPlan%20Rome%201&clipboard');
  assert.equal(O.obsidianUri({ name: 'x' }), 'obsidian://new?file=x&clipboard');
  assert.equal(O.obsidianTag('Hello World!'), 'hello-world'); assert.equal(O.obsidianTag('123'), ''); assert.equal(O.obsidianTag('日本語'), '日本語');
});

import * as ID from '../lib/identity.js';
import { suggestTags, mergeTags } from '../lib/topics.js';
t('identity: key, compare, merge', () => {
  const base = { site: 'chatgpt', title: 'T', url: 'https://chatgpt.com/c/abc?x=1#h', messages: [{ role: 'user', markdown: 'Hi' }, { role: 'assistant', markdown: 'Hello  there' }] };
  assert.equal(ID.chatKey(base), 'chatgpt|https://chatgpt.com/c/abc');
  assert.equal(ID.chatKey({ ...base, url: 'https://chatgpt.com/' }), 'chatgpt|t:t');
  assert.equal(ID.compareChats(base, { ...base, messages: [{ role: 'user', markdown: 'hi' }, { role: 'assistant', markdown: 'Hello there' }] }).kind, 'same');
  const more = { ...base, messages: [...base.messages, { role: 'user', markdown: 'More' }, { role: 'assistant', markdown: 'Sure' }] };
  assert.equal(ID.compareChats(base, more).kind, 'updated');
  const m = ID.mergeInto({ ...base, id: 'x', tags: ['a'], folder: 'f' }, more, 1000);
  assert.equal(m.kind, 'updated'); assert.equal(m.added, 2); assert.equal(m.rec.messages.length, 4);
  assert.ok(!m.rec.messages[0].updated && m.rec.messages[2].updated && m.rec.messages[3].addedAt === 1000);
  assert.equal(m.rec.id, 'x'); assert.equal(m.rec.updatedCount, 2);
  const div = { ...base, messages: [{ role: 'user', markdown: 'Other' }] };
  assert.equal(ID.compareChats(base, div).kind, 'changed');
  const r = ID.mergeInto({ ...base, id: 'x', tags: ['a'], folder: 'f' }, div, 5);
  assert.equal(r.kind, 'replaced'); assert.deepEqual(r.rec.tags, ['a']); assert.equal(r.rec.folder, 'f');
  assert.equal(ID.mergeInto({ ...base, id: 'x' }, base).kind, 'same');
});
t('topics: multi tags', () => {
  const c = { title: 'Fix React bug', messages: [{ role: 'user', markdown: 'My javascript function throws an error in react; also plan a trip with flight and hotel and itinerary' }] };
  const tg = suggestTags(c);
  assert.ok(tg.includes('coding') && tg.includes('travel') && tg.length >= 2 && tg.length <= 4, tg.join());
  assert.deepEqual(suggestTags({ title: 'x', messages: [{ role: 'user', markdown: 'hello' }] }), []);
  assert.deepEqual(mergeTags(['A', ' b '], ['a', 'c']), ['a', 'b', 'c']);
});

{
  const N2 = await import('../lib/notion.js');
  const calls = [];
  const fake = async (url, init) => { calls.push({ url, m: init.method, body: JSON.parse(init.body || 'null') }); return { ok: true, status: 200, json: async () => ({ id: 'dbid', url: 'https://notion.so/x' }) }; };
  const db = await N2.createChatDatabase({ token: 't', parentId: 'par', fetchImpl: fake, sleep: async () => {} });
  assert.equal(db.id, 'dbid'); assert.ok(calls[0].url.endsWith('/databases')); assert.equal(calls[0].body.parent.page_id, 'par');
  assert.deepEqual(Object.keys(calls[0].body.properties), ['Name', 'Site', 'Tags', 'Date', 'Messages', 'URL']);
  const props = N2.chatProps({ siteName: 'ChatGPT', exportedAt: '2026-11-10T01:02:03Z', url: 'https://chatgpt.com/c/1' }, ['coding', 'a,b', 'coding'], 7);
  assert.equal(props.Site.select.name, 'ChatGPT'); assert.deepEqual(props.Tags.multi_select.map((x) => x.name), ['coding', 'a b']);
  assert.equal(props.Date.date.start, '2026-11-10'); assert.equal(props.Messages.number, 7); assert.equal(props.URL.url, 'https://chatgpt.com/c/1');
  assert.ok(!('URL' in N2.chatProps({ url: 'javascript:x' }, [], 0)));
  calls.length = 0;
  await N2.sendToNotion({ token: 't', databaseId: 'dbid', props, title: 'Row', children: [], fetchImpl: fake, sleep: async () => {} });
  assert.equal(calls[0].body.parent.database_id, 'dbid'); assert.ok(calls[0].body.properties.Name.title[0].text.content === 'Row' && calls[0].body.properties.Site);
  n++; console.log('ok notion: database mode');
}

t('branded pdf css', () => {
  const css = toHtmlDoc({ site: 'x', siteName: 'A"B', title: 'T\\"}', url: '', exportedAt: '2026-01-01', messages: [] }, [], { brand: true });
  assert.ok(css.includes('counter(page)') && css.includes('@top-left') && !css.includes('A"B') && !css.includes('T\\"}'));
  assert.ok(!toHtmlDoc({ siteName: 'A', title: 'T', exportedAt: '2026-01-01', messages: [] }, [], {}).includes('counter(page)'));
  assert.ok(!toHtmlDoc({ siteName: 'A', title: 'T', exportedAt: '2026-01-01', messages: [] }, [], { brand: true, theme: 'dark' }).includes('@top-left'), 'bleed themes skip margin boxes');
});

fs.mkdirSync('/tmp/cv-out', { recursive: true });
const docx = toDocxBlob(conv, conv.messages, { font: 'Georgia', size: 12, color: '#222222', page: 'Letter', header: true });
fs.writeFileSync('/tmp/cv-out/test.docx', Buffer.from(await docx.arrayBuffer()));
fs.writeFileSync('/tmp/cv-out/test.zip', Buffer.from(await zip([{ name: 'a/b.md', data: 'héllo' }, { name: 'c.txt', data: 'x'.repeat(5000) }]).arrayBuffer()));
fs.writeFileSync('/tmp/cv-out/test.html', toHtmlDoc(conv, conv.messages));
console.log(`\n${n} unit groups passed`);
