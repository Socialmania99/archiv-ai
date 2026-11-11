import { parseBlocks } from './lib/markdown.js';
import { redact } from './lib/redact.js';
import {
  FONTS, THEMES, DEFAULT_STYLE, palette, esc, pickMessages, toMarkdownDoc, toTextDoc, toJsonDoc, toHtmlDoc,
  blocksHtml, roleName, makeFilename, stats
} from './lib/render.js';
import { toDocxBlob } from './lib/docx.js';
import { toPngBlobs } from './lib/image.js';
import { zip } from './lib/zip.js';
import { saveOrMerge, getChat } from './lib/db.js';
import { suggestTags } from './lib/topics.js';
import { chatKey, compareChats } from './lib/identity.js';
import { getAll } from './lib/db.js';
import { mountSidebar, renderSidebar } from './sidebar.js';
import { conversationToNotion, sendToNotion, createChatDatabase, chatProps } from './lib/notion.js';
import { toObsidianDoc, obsidianUri, safeNoteName } from './lib/obsidian.js';
import { getNotion, setNotion, ensureNotionAccess } from './lib/notion-store.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const DEFAULTS = {
  format: 'pdf', keep: 'both', ...DEFAULT_STYLE,
  brandPdf: true, rSecrets: true, rEmails: false, rPhones: false,
  filename: '{site} - {title} - {date}',
  obStyle: 'callouts', obVault: '', obFolder: 'AI Chats'
};

let conv = null;
let settings = { ...DEFAULTS };
let selected = new Set();
let lastClicked = null;

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

async function loadSettings() {
  try {
    const { settings: s } = await chrome.storage.sync.get('settings');
    settings = { ...DEFAULTS, ...(s || {}) };
  } catch { /* defaults */ }
}
const persist = () => chrome.storage.sync.set({ settings }).catch(() => {});

async function loadConversation() {
  const libId = params.get('lib');
  if (libId) {
    const rec = await getChat(libId);
    return rec ? { ...rec, exportedAt: new Date().toISOString() } : null;
  }
  const id = params.get('id');
  if (!id) return null;
  const key = 'pending:' + id;
  const got = await chrome.storage.local.get(key);
  return got[key] || null;
}

function redactOpts() { return { secrets: settings.rSecrets, emails: settings.rEmails, phones: settings.rPhones }; }

/** messages after include filter, selection and redaction */
function currentView() {
  const opts = redactOpts();
  const hits = {};
  const msgs = pickMessages(conv, settings.keep, selected).map((m) => {
    if (m.role === 'section') return m;
    const r = redact(m.markdown, opts);
    Object.entries(r.hits).forEach(([k, v]) => { hits[k] = (hits[k] || 0) + v; });
    return { ...m, markdown: r.text };
  });
  // drop section headings that have no messages under them
  const clean = msgs.filter((m, k) => m.role !== 'section' || (msgs[k + 1] && msgs[k + 1].role !== 'section'));
  return { msgs: clean, hits };
}

function renderPreview() {
  const p = palette(settings);
  const box = $('preview');
  box.style.cssText = `font-family:${FONTS[settings.font] || FONTS['Segoe UI']};font-size:${Number(settings.size) || 11}pt;color:${p.fg};background:${p.bg};` +
    `--pv-muted:${p.muted};--pv-line:${p.line};--pv-code:${p.code};--pv-inline:${p.inline};--pv-user:${p.user};--pv-ai:${p.ai};--pv-link:${p.link}`;
  const opts = redactOpts();
  const head = `<h1 class="doc">${esc(conv.title)}</h1>` + (settings.header ? `<p class="meta">Exported from ${esc(conv.siteName)} on ${esc(conv.exportedAt.slice(0, 10))}</p>` : '');
  const visible = conv.messages.filter((m) => m.role === 'section' || settings.keep === 'both' || m.role === settings.keep);
  box.innerHTML = head + visible.map((m) => {
    if (m.role === 'section') return `<h2 class="docsec">${esc(m.markdown)}</h2>`;
    const on = selected.has(m.i);
    const r = redact(m.markdown, opts);
    const html = blocksHtml(parseBlocks(r.text)).replace(/\[REDACTED:[a-z-]+\]/g, '<span class="redacted">$&</span>');
    return `<section class="msg ${m.role}${on ? '' : ' off'}" data-i="${m.i}">
      <div class="role"><input type="checkbox" ${on ? 'checked' : ''} tabindex="-1">${esc(roleName(m.role, conv, m))}</div>${html}</section>`;
  }).join('');

  const { msgs, hits } = currentView();
  const s = stats(msgs);
  $('stats').textContent = `${s.messages} messages · ${s.words.toLocaleString()} words · ~${s.tokens.toLocaleString()} tokens`;
  const total = Object.values(hits).reduce((a, b) => a + b, 0);
  const note = $('redactNote');
  if (total) {
    note.className = 'redact-note';
    note.textContent = `Redacted ${total}: ` + Object.entries(hits).map(([k, v]) => `${k} ×${v}`).join(', ');
  } else {
    note.className = 'redact-note none';
    note.textContent = (settings.rSecrets || settings.rEmails || settings.rPhones) ? 'Nothing sensitive found.' : 'Redaction is off.';
  }
  $('download').disabled = s.messages === 0;
  document.querySelectorAll('.theme').forEach((b) => b.classList.toggle('on', b.dataset.theme === settings.theme));
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function printPdf(html) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;height:1200px;border:0';
  frame.srcdoc = html;
  frame.onload = () => {
    const w = frame.contentWindow;
    setTimeout(() => { w.focus(); w.print(); setTimeout(() => frame.remove(), 60000); }, 250);
  };
  document.body.appendChild(frame);
}

async function doNotion(msgs) {
  const cfg = await getNotion();
  if (!cfg) {
    toast('Connect Notion first (sidebar › Settings)');
    return;
  }
  if (!(await ensureNotionAccess())) return toast('Notion access was not allowed');
  const btn = $('download');
  btn.disabled = true;
  try {
    const { title, children } = conversationToNotion(conv, msgs, settings);
    let databaseId, props;
    if (cfg.mode === 'database') {
      databaseId = cfg.databaseId;
      if (!databaseId) { btn.textContent = 'Creating database…'; databaseId = (await createChatDatabase({ token: cfg.token, parentId: cfg.parentId })).id; await setNotion({ ...cfg, databaseId }); }
      props = chatProps(conv, tagList, msgs.filter((m) => m.role !== 'section').length);
    }
    const r = await sendToNotion({
      token: cfg.token, parentId: cfg.parentId, databaseId, props, title, children,
      onProgress: (a, b) => { btn.textContent = b > 1 ? `Sending ${a}/${b}…` : 'Sending…'; }
    });
    const link = $('notionLink'); link.href = r.url || '#'; link.hidden = !r.url;
    toast('Sent to Notion');
  } catch (e) { toast(e.message || 'Notion export failed'); }
  finally { btn.disabled = false; syncAction(); }
}

function syncAction() {
  const f = settings.format;
  $('download').textContent = f === 'notion' ? 'Send to Notion' : f === 'obsidian' ? 'Download note' : 'Download';
  $('obsOpts').hidden = f !== 'obsidian';
  $('obOpen').hidden = f !== 'obsidian';
}

const obsidianOpts = () => ({ style: settings.obStyle, tags: [], extraTags: [] });
const noteName = () => safeNoteName(makeFilename(settings.filename, conv, 'md').replace(/\.md$/, ''));
async function openInObsidian() {
  const { msgs } = currentView();
  if (!msgs.some((m) => m.role !== 'section')) return toast('Nothing selected');
  try {
    await navigator.clipboard.writeText(toObsidianDoc(conv, msgs, obsidianOpts()));
  } catch { return toast('Could not copy the note. Use "Download note" instead.'); }
  toast('Note copied. Opening Obsidian…');
  location.href = obsidianUri({ vault: settings.obVault, folder: settings.obFolder, name: noteName() });
}

async function doDownload() {
  const { msgs } = currentView();
  if (!msgs.some((m) => m.role !== 'section')) return toast('Nothing selected');
  if (settings.format === 'notion') return doNotion(msgs);
  const style = settings;
  const name = (ext) => makeFilename(settings.filename, conv, ext);
  const f = settings.format;
  try {
    if (f === 'md') download(new Blob([toMarkdownDoc(conv, msgs, style)], { type: 'text/markdown' }), name('md'));
    else if (f === 'txt') download(new Blob([toTextDoc(conv, msgs, style)], { type: 'text/plain' }), name('txt'));
    else if (f === 'json') download(new Blob([toJsonDoc(conv, msgs)], { type: 'application/json' }), name('json'));
    else if (f === 'html') download(new Blob([toHtmlDoc(conv, msgs, style)], { type: 'text/html' }), name('html'));
    else if (f === 'docx') download(toDocxBlob(conv, msgs, style), name('docx'));
    else if (f === 'obsidian') download(new Blob([toObsidianDoc(conv, msgs, obsidianOpts())], { type: 'text/markdown' }), safeNoteName(name('md').replace(/\.md$/, '')) + '.md');
    else if (f === 'png') {
      toast('Rendering image…');
      const parts = await toPngBlobs(conv, msgs, style);
      if (parts.length === 1) download(parts[0], name('png'));
      else {
        const base = name('png').replace(/\.png$/, '');
        const files = await Promise.all(parts.map(async (b, k) => ({ name: `${base} (part ${k + 1}).png`, data: new Uint8Array(await b.arrayBuffer()) })));
        download(zip(files), base + ' (images).zip');
      }
    } else if (f === 'pdf') {
      toast('Choose "Save as PDF" in the print dialog');
      printPdf(toHtmlDoc(conv, msgs, { ...style, brand: settings.brandPdf !== false }));
    }
  } catch (e) { toast('Export failed: ' + e.message); }
}

let tagList = [];
const pendingId = params.get('id');
function renderTags() {
  const sug = suggestTags(conv).filter((t) => !tagList.includes(t));
  $('tagbox').innerHTML = tagList.map((t) => `<span class="chip" data-t="${esc(t)}" title="Remove tag" role="button" tabindex="0">#${esc(t)}</span>`).join('')
    + sug.map((t) => `<span class="chip suggest" data-s="${esc(t)}" title="Add suggested tag" role="button" tabindex="0">+ ${esc(t)}</span>`).join('');
}
const addTag = (t) => { t = String(t).trim().toLowerCase(); if (t && !tagList.includes(t)) tagList.push(t); renderTags(); };

async function doSave() {
  const picked = pickMessages(conv, 'both', selected).filter((m) => m.role !== 'section');
  if (!picked.length) return toast('Nothing selected');
  if (conv.merged) return toast('Combined documents are not saved to the vault');
  if ($('tagIn').value.trim()) { addTag($('tagIn').value); $('tagIn').value = ''; }
  const r = await saveOrMerge({
    title: conv.title, site: conv.site, siteName: conv.siteName, url: conv.url,
    exportedAt: conv.exportedAt, messages: picked
  }, { tags: tagList, folder: $('folder').value.trim() });
  if (pendingId) { await chrome.storage.local.remove('pending:' + pendingId).catch(() => {}); $('discard').hidden = true; }
  toast(r.status === 'updated' ? `Updated: +${r.added} new message${r.added === 1 ? '' : 's'} added to the saved chat` : r.status === 'new' ? 'Saved to your vault' : 'Replaced the saved copy');
  renderSidebar(); showStatus();
}

async function showStatus() {
  const chip = $('stChip');
  if (conv.merged) { chip.hidden = true; return; }
  const key = chatKey(conv);
  const hit = (await getAll()).find((r) => (r.key || chatKey(r)) === key);
  chip.hidden = false;
  if (!hit) { chip.textContent = 'New chat'; return; }
  const c = compareChats(hit, conv);
  chip.textContent = c.kind === 'same' ? 'Already saved' : c.kind === 'updated' ? `Updated: +${c.added.length} new` : 'Saved version differs';
}

// Export formats (used by the dropdown).
const DOCK = [
  ['pdf', 'Download PDF', '#ef4444', 'PDF'], ['docx', 'Download Word', '#2563eb', 'DOC'], ['png', 'Download image', '#10b981', '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/></svg>'],
  ['md', 'Download Markdown', '#8b5cf6', 'MD'], ['json', 'Download JSON', '#f59e0b', '{ }'], ['txt', 'Download text', '#64748b', 'TXT'],
  ['html', 'Download HTML', '#06b6d4', '&lt;/&gt;'], ['obsidian', 'Obsidian note', '#7c3aed', '<svg viewBox="0 0 24 24"><path d="M12 2 5 8l-1 8 6 6 8-3 2-9z"/><path d="m12 2 3 10-5 10"/></svg>'], ['notion', 'Send to Notion', '#3f3f46', 'N']
];
const FMT_LABEL = { pdf: 'PDF', docx: 'Word', png: 'Image', md: 'Markdown', json: 'JSON', txt: 'Text', html: 'HTML', obsidian: 'Obsidian', notion: 'Notion' };
const FMT_SUB = { pdf: 'Print dialog, branded', docx: 'Editable Word file', png: 'Picture of the chat', md: 'Plain Markdown', json: 'Structured data', txt: 'Plain text', html: 'Web page', obsidian: 'Note with tags', notion: 'Send to your workspace' };
function renderFmt() {
  const cur = DOCK.find((d) => d[0] === settings.format) || DOCK[0];
  $('fmtName').textContent = FMT_LABEL[cur[0]];
  $('fmtDot').style.background = cur[2];
  $('fmtMenu').innerHTML = DOCK.map(([f, tip, bg, ic]) => `<button role="option" data-f="${f}" class="${f === settings.format ? 'on' : ''}" aria-selected="${f === settings.format}"><span class="ico" style="background:${bg}">${ic}</span><span><b>${FMT_LABEL[f]}</b><small>${FMT_SUB[f]}</small></span></button>`).join('');
}
function setFormat(f) {
  settings.format = f;
  document.querySelectorAll('input[name=format]').forEach((r) => { r.checked = r.value === f; });
  persist(); syncAction(); renderFmt();
}
$('fmtBtn').onclick = (e) => { e.stopPropagation(); const open = $('fmtMenu').hidden; $('fmtMenu').hidden = !open; $('fmtBtn').setAttribute('aria-expanded', String(open)); };
$('fmtMenu').onclick = (e) => { const b = e.target.closest('button[data-f]'); if (!b) return; setFormat(b.dataset.f); $('fmtMenu').hidden = true; $('fmtBtn').setAttribute('aria-expanded', 'false'); };
document.addEventListener('click', () => { $('fmtMenu').hidden = true; $('fmtBtn').setAttribute('aria-expanded', 'false'); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('fmtMenu').hidden = true; $('fmtBtn').setAttribute('aria-expanded', 'false'); } });


function bind() {
  document.querySelectorAll('input[name=format]').forEach((r) => {
    r.checked = r.value === settings.format;
    r.onchange = () => setFormat(r.value);
  });
  $('keep').value = settings.keep;
  $('keep').onchange = () => { settings.keep = $('keep').value; persist(); renderPreview(); };

  ['rSecrets', 'rEmails', 'rPhones', 'header', 'brandPdf'].forEach((id) => {
    $(id).checked = !!settings[id];
    $(id).onchange = () => { settings[id] = $(id).checked; persist(); renderPreview(); };
  });

  $('themes').innerHTML = Object.entries(THEMES).map(([k, t]) =>
    `<button class="theme" data-theme="${k}" title="${t.label}"><i style="background:${t.bg};border-bottom:3px solid ${t.user}"></i><span>${t.label}</span></button>`).join('');
  $('themes').onclick = (e) => {
    const b = e.target.closest('.theme');
    if (!b) return;
    settings.theme = b.dataset.theme; persist(); renderPreview();
  };

  Object.keys(FONTS).forEach((k) => $('font').add(new Option(k, k)));
  $('font').value = settings.font;
  $('font').onchange = () => { settings.font = $('font').value; persist(); renderPreview(); };
  $('size').value = settings.size;
  $('size').onchange = () => { settings.size = Number($('size').value) || 11; persist(); renderPreview(); };
  $('color').value = settings.color;
  $('color').oninput = () => { settings.color = $('color').value; persist(); renderPreview(); };
  $('page').value = settings.page;
  $('page').onchange = () => { settings.page = $('page').value; persist(); };
  $('filename').value = settings.filename;
  $('filename').onchange = () => { settings.filename = $('filename').value || DEFAULTS.filename; persist(); };

  const selectable = () => conv.messages.filter((m) => m.role !== 'section').map((m) => m.i);
  $('selAll').onclick = () => { selected = new Set(conv.messages.map((m) => m.i)); renderPreview(); };
  $('selNone').onclick = () => { selected = new Set(conv.messages.filter((m) => m.role === 'section').map((m) => m.i)); renderPreview(); };

  $('preview').addEventListener('click', (e) => {
    const head = e.target.closest('.role');
    if (!head) return;
    e.preventDefault();
    const i = Number(head.closest('.msg').dataset.i);
    const ids = selectable();
    if (e.shiftKey && lastClicked != null) {
      const [a, b] = [Math.min(lastClicked, i), Math.max(lastClicked, i)];
      const turnOn = !selected.has(i);
      ids.forEach((k) => { if (k >= a && k <= b) turnOn ? selected.add(k) : selected.delete(k); });
    } else {
      selected.has(i) ? selected.delete(i) : selected.add(i);
    }
    lastClicked = i;
    renderPreview();
  });

  $('obStyle').value = settings.obStyle;
  $('obStyle').onchange = () => { settings.obStyle = $('obStyle').value; persist(); };
  $('obVault').value = settings.obVault;
  $('obVault').onchange = () => { settings.obVault = $('obVault').value.trim(); persist(); };
  $('obFolder').value = settings.obFolder;
  $('obFolder').onchange = () => { settings.obFolder = $('obFolder').value.trim(); persist(); };
  $('obOpen').onclick = () => openInObsidian();
  syncAction();
  $('download').onclick = doDownload;
  $('save').onclick = () => doSave().catch((e) => toast('Save failed: ' + e));
  $('discard').onclick = async () => { await chrome.storage.local.remove('pending:' + pendingId); chrome.runtime.sendMessage({ type: 'open-dashboard', hash: '#inbox' }); };
  $('tagIn').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag($('tagIn').value); $('tagIn').value = ''; } };
  $('tagbox').onclick = (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    if (c.dataset.s) addTag(c.dataset.s); else { tagList = tagList.filter((t) => t !== c.dataset.t); renderTags(); }
  };
  $('openLib').onclick = () => chrome.runtime.sendMessage({ type: 'open-dashboard', hash: pendingId ? '#inbox' : '#library' });
  $('copy').onclick = async () => {
    const { msgs } = currentView();
    await navigator.clipboard.writeText(toMarkdownDoc(conv, msgs, settings));
    toast('Markdown copied');
  };
}

(async function init() {
  mountSidebar({ page: 'export', title: 'Export' });
  await loadSettings();
  conv = await loadConversation();
  if (!conv) {
    $('title').textContent = 'Nothing to export';
    $('meta').textContent = 'This export is no longer in your Inbox. Open a chat and use Archiv AI again.';
    return;
  }
  selected = new Set(conv.messages.map((m) => m.i));
  document.title = 'Archiv AI · ' + conv.title;
  mountSidebar({ page: 'export', title: 'Export', current: conv.title });
  $('title').textContent = conv.title;
  const n = conv.messages.filter((m) => m.role !== 'section').length;
  $('meta').textContent = `${conv.siteName} · ${n} messages${conv.merged ? ' · combined document' : ' found'}`;
  if (conv.merged) { $('save').hidden = true; document.querySelector('.tagrow').hidden = true; }
  $('discard').hidden = !pendingId;
  $('crumb').textContent = pendingId ? 'Inbox › Recent copy from ' + conv.siteName : 'Library › Export';
  if (!conv.merged) { tagList = [...(conv.tags || [])]; if (!tagList.length) tagList = suggestTags(conv).slice(0, 3); renderTags(); showStatus(); }
  bind();
  renderFmt();
  renderPreview();
})();
