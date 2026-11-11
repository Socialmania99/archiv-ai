import { getAll, deleteChat, saveChat, saveOrMerge } from './lib/db.js';
import { avatarHtml } from './lib/avatar.js';
import { chatKey, compareChats } from './lib/identity.js';
import { suggestTags } from './lib/topics.js';
import { mountSidebar, renderSidebar } from './sidebar.js';
import { zip } from './lib/zip.js';
import { toMarkdownDoc, safeFilename, esc } from './lib/render.js';
import { computeStats, activitySeries, compact, chatTokens } from './lib/stats.js';
import { makeSamples } from './lib/sample.js';
import { toObsidianDoc, safeNoteName, safeFolder } from './lib/obsidian.js';
import { findInChat, highlightHtml, stepMatch } from './lib/find.js';
import { parsePageId, testNotion } from './lib/notion.js';
import { getNotion, setNotion, clearNotion, ensureNotionAccess, revokeNotionAccess } from './lib/notion-store.js';

const $ = (id) => document.getElementById(id);

const SITES = CV.SITES;
const siteColor = (id) => CV.colorFor(id);
const FOLDER_GRADS = [
  ['#7c3aed', '#4f46e5'], ['#06b6d4', '#4f46e5'], ['#ec4899', '#8b5cf6'], ['#f59e0b', '#ef4444'], ['#10b981', '#3b82f6'], ['#6366f1', '#a855f7']
];
const folderGrad = (name) => { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const g = FOLDER_GRADS[h % FOLDER_GRADS.length]; return `linear-gradient(135deg, ${g[0]}, ${g[1]})`; };

let all = [];
let activeTag = '';
let period = 'monthly';
const picked = new Set();

function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- routing ---------- */
const VIEWS = ['dashboard', 'inbox', 'library', 'folders', 'sites', 'settings'];
function route() {
  const [h, q] = (location.hash || '#dashboard').slice(1).split('?');
  const view = VIEWS.includes(h) ? h : 'dashboard';
  VIEWS.forEach((v) => { $('view-' + v).hidden = v !== view; });
  if (view === 'library') {
    const p = new URLSearchParams(q || '');
    if (q !== undefined) { $('site').value = p.get('site') || ''; $('folder').value = p.get('folder') || ''; activeTag = p.get('tag') || ''; }
    renderLibrary();
  }
  if (view === 'settings') renderSettings();
  if (view === 'inbox') loadInbox().then(renderInbox);
}
window.addEventListener('hashchange', route);
$('list').addEventListener('input', (e) => {
  const bar = e.target.closest('.findbar'); if (!bar) return;
  const card = bar.closest('.card'); card.querySelector('.view-pane').dataset.cur = '0'; paintPane(card);
});
$('list').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.classList.contains('fq')) return;
  e.preventDefault(); stepPane(e.target.closest('.card'), e.shiftKey ? -1 : 1);
});


/* ---------- inbox: recent copies sent from the extension ---------- */
let inbox = [];
const inboxTags = {};
const ago2 = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
async function loadInbox() {
  const g = await chrome.storage.local.get(null);
  inbox = Object.entries(g).filter(([k, v]) => k.startsWith('pending:') && !(v && v.merged)).map(([k, v]) => ({ ...v, pid: k.slice(8) })).sort((a, b) => (b.receivedAt || 0) - (a.receivedAt || 0));
}
function dupStatus(c) {
  const key = chatKey(c);
  const hit = all.find((r) => (r.key || chatKey(r)) === key);
  if (!hit) return { cls: 'new', text: 'New chat' };
  const cmp = compareChats(hit, c);
  if (cmp.kind === 'same') return { cls: 'same', text: 'Already saved, identical. Saving replaces the copy' };
  if (cmp.kind === 'updated') return { cls: 'upd', text: `Updated: ${cmp.added.length} new message${cmp.added.length === 1 ? '' : 's'} will be added to the saved chat` };
  return { cls: 'same', text: 'Saved version differs. Saving replaces its content, keeps tags and folder' };
}
function renderInbox() {
  $('inboxCount').textContent = inbox.length ? inbox.length + ' waiting' : '';
  $('inboxList').innerHTML = inbox.length ? inbox.map((c) => {
    const st = dupStatus(c);
    const tags = inboxTags[c.pid] ?? suggestTags(c).join(', ');
    const n = c.messages.filter((m) => m.role !== 'section').length;
    return `<article class="ib glass-in" data-pid="${esc(c.pid)}">
      <div class="ib-top">${avatarHtml(c.site, c.siteName, 44)}
        <div class="grow"><div class="ib-from">Recent copy from ${esc(c.siteName)}</div><h3>${esc(c.title)}</h3>
          <div class="muted small">${n} messages · ${ago2(c.receivedAt || Date.now())}</div></div>
        <span class="ib-st ${st.cls}">${esc(st.text)}</span></div>
      <div class="ib-tags"><span class="muted small">Tags</span><input type="text" class="ib-tagsin" value="${esc(tags)}" placeholder="topic tags, comma separated" aria-label="Tags"></div>
      <div class="ib-acts"><button class="primary" data-a="isave">Save to vault</button><button data-a="ipreview" aria-expanded="false">Preview</button><button data-a="iexport">Export…</button><button data-a="idiscard" class="danger">Discard</button></div>
      <div class="ib-pane" hidden></div>
    </article>`;
  }).join('') : '<div class="empty glass-in">Inbox is empty. Open a chat, click the Archiv icon and choose “Export this chat”. It appears here.</div>';
}
$('inboxList').addEventListener('input', (e) => { if (e.target.classList.contains('ib-tagsin')) inboxTags[e.target.closest('.ib').dataset.pid] = e.target.value; });
$('inboxList').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-a]'); if (!b) return;
  const card = b.closest('.ib'), pid = card.dataset.pid, c = inbox.find((x) => x.pid === pid);
  if (!c) return;
  if (b.dataset.a === 'ipreview') {
    const pane = card.querySelector('.ib-pane'), open = pane.hidden;
    if (open && !pane.innerHTML) pane.innerHTML = c.messages.filter((m) => m.role !== 'section').map((m) => `<div class="m ${m.role}"><b>${m.role === 'user' ? 'You' : esc(c.siteName)}</b><pre>${esc(m.markdown)}</pre></div>`).join('');
    pane.hidden = !open; b.setAttribute('aria-expanded', String(open)); b.textContent = open ? 'Hide preview' : 'Preview';
    return;
  }
  if (b.dataset.a === 'iexport') { location.href = 'export.html?id=' + encodeURIComponent(pid); return; }
  if (b.dataset.a === 'idiscard') { await chrome.storage.local.remove('pending:' + pid); delete inboxTags[pid]; toast('Discarded'); return; }
  if (b.dataset.a === 'isave') {
    const tags = card.querySelector('.ib-tagsin').value.split(',').map((t) => t.trim()).filter(Boolean);
    const { receivedAt, pid: _p, ...chat } = c; void receivedAt; void _p;
    const r = await saveOrMerge({ ...chat, messages: chat.messages.filter((m) => m.role !== 'section') }, { tags });
    await chrome.storage.local.remove('pending:' + pid); delete inboxTags[pid];
    toast(r.status === 'updated' ? `Updated: +${r.added} new message${r.added === 1 ? '' : 's'}` : r.status === 'new' ? 'Saved to your vault' : 'Replaced the saved copy');
    await reload();
  }
});
chrome.storage.onChanged.addListener(async (ch, area) => {
  if (area !== 'local' || !Object.keys(ch).some((k) => k.startsWith('pending:'))) return;
  await loadInbox();
  renderInbox();
});

/* ---------- find inside a saved chat ---------- */
function paneHtml() {
  return `<div class="findbar">
    <input type="search" class="fq" placeholder="Find in this chat…" aria-label="Find in this chat">
    <span class="fcount muted small" aria-live="polite"></span>
    <button data-a="fprev" title="Previous match" aria-label="Previous match">↑</button>
    <button data-a="fnext" title="Next match" aria-label="Next match">↓</button>
    <label class="inline small"><input type="checkbox" class="fcase"> Aa</label>
    <label class="inline small"><input type="checkbox" class="fonly"> Only matches</label>
  </div><div class="fbody"></div>`;
}
function paintPane(card, scroll = true) {
  const chat = all.find((c) => c.id === card.dataset.id);
  const pane = card.querySelector('.view-pane');
  const q = pane.querySelector('.fq').value;
  const res = findInChat(chat.messages, q, { caseSensitive: pane.querySelector('.fcase').checked });
  let cur = Number(pane.dataset.cur || 0);
  if (cur >= res.total || cur < 0) cur = 0;
  pane.dataset.cur = String(cur);
  const only = pane.querySelector('.fonly').checked && res.total > 0;
  pane.querySelector('.fbody').innerHTML = chat.messages.map((m, i) => (only && !res.byMsg.has(i)) ? '' :
    `<div class="m${m.updated ? ' msg-updated' : ''}"><b>${m.role === 'user' ? 'You' : esc(chat.siteName)}</b>${m.updated ? ' <span class="chip upd">Updated</span>' : ''}<pre>${highlightHtml(m.markdown, res.byMsg.get(i), cur)}</pre></div>`).join('');
  const msgsWith = res.byMsg.size;
  pane.querySelector('.fcount').textContent = !q.trim() ? '' : res.total ? `${cur + 1} of ${res.total} · ${msgsWith} message${msgsWith === 1 ? '' : 's'}` : 'No matches';
  pane.querySelectorAll('[data-a=fprev],[data-a=fnext]').forEach((b) => { b.disabled = res.total < 2; });
  if (scroll) { const m = pane.querySelector('mark.cur'); if (m) m.scrollIntoView({ block: 'nearest' }); }
}
function stepPane(card, dir) {
  const pane = card.querySelector('.view-pane');
  const chat = all.find((c) => c.id === card.dataset.id);
  const res = findInChat(chat.messages, pane.querySelector('.fq').value, { caseSensitive: pane.querySelector('.fcase').checked });
  pane.dataset.cur = String(stepMatch(Number(pane.dataset.cur || 0), res.total, dir));
  paintPane(card);
}

/* ---------- helpers ---------- */
function snippetFor(chat, q) {
  if (q) {
    const i = chat.searchText.indexOf(q);
    if (i >= 0) {
      const start = Math.max(0, i - 40);
      const raw = chat.searchText.slice(start, i + q.length + 70).replace(/\s+/g, ' ');
      const at = raw.indexOf(q);
      return (start > 0 ? '…' : '') + esc(raw.slice(0, at)) + '<mark>' + esc(raw.slice(at, at + q.length)) + '</mark>' + esc(raw.slice(at + q.length));
    }
  }
  const last = [...chat.messages].reverse().find((m) => m.role === 'assistant') || chat.messages[chat.messages.length - 1];
  return esc((last ? last.markdown : '').replace(/[#*`>|_-]/g, '').replace(/\s+/g, ' ').slice(0, 80));
}
const ago = (t) => {
  const d = Math.floor((Date.now() - t) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? d + 'd ago' : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function ringSvg(frac, label) {
  const r = 22, c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 54 54" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>
    <circle cx="27" cy="27" r="${r}" fill="none" stroke="var(--brand-soft)" stroke-width="6"/>
    <circle cx="27" cy="27" r="${r}" fill="none" stroke="var(--brand)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 27 27)"/>
    <text x="27" y="31" text-anchor="middle">${Math.round(frac * 100)}%</text></svg>`;
}

/* ---------- dashboard ---------- */
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)');
const dayLabel = (i, n) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };
// One shared tooltip per bar chart. The number counts up from 0 to that day's real value when a bar is
// hovered, focused (keyboard) or tapped (touch); each bar also carries the value in its aria-label.
function renderBars(el, values, unit) {
  const max = Math.max(1, ...values);
  el.innerHTML = values.map((v, i) => {
    const lab = `${dayLabel(i, values.length)}: ${v.toLocaleString()} ${v === 1 ? unit.one : unit.many}`;
    return `<i tabindex="0" role="img" data-i="${i}" aria-label="${esc(lab)}" style="height:${Math.max(6, Math.round((v / max) * 54))}px"></i>`;
  }).join('') + '<div class="bartip" aria-hidden="true"><span class="bt-d"></span><b class="bt-n">0</b></div>';
  const tip = el.querySelector('.bartip'), num = tip.querySelector('.bt-n'), dd = tip.querySelector('.bt-d');
  let cur = -1, raf = 0;
  const count = (to) => {
    cancelAnimationFrame(raf);
    if (REDUCE.matches || to === 0) { num.textContent = to.toLocaleString(); return; }
    const t0 = performance.now(), dur = Math.min(900, 350 + Math.log10(to + 1) * 150);
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      num.textContent = Math.round(to * e).toLocaleString();
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    num.textContent = '0'; raf = requestAnimationFrame(tick);
  };
  const show = (i) => {
    if (i === cur) return; // same bar: do not replay
    cur = i;
    const b = el.children[i], v = values[i];
    dd.textContent = dayLabel(i, values.length) + ' · ' + (v === 1 ? unit.one : unit.many);
    const cx = b.offsetLeft + b.offsetWidth / 2;
    tip.style.left = cx + 'px';
    tip.style.transform = `translate(-${Math.min(90, Math.max(10, (cx / el.clientWidth) * 100))}%, 0)`;
    tip.classList.add('on'); el.querySelectorAll('i.hot').forEach((x) => x.classList.remove('hot')); b.classList.add('hot');
    count(v);
  };
  const hide = () => { cur = -1; cancelAnimationFrame(raf); tip.classList.remove('on'); el.querySelectorAll('i.hot').forEach((x) => x.classList.remove('hot')); };
  const idx = (e) => { const b = e.target.closest && e.target.closest('i[data-i]'); return b ? +b.dataset.i : -1; };
  el.onpointerover = (e) => { const i = idx(e); if (i >= 0) show(i); };
  el.onpointerleave = (e) => { if (e.pointerType !== 'touch') hide(); };
  // focusin/focusout have no on* properties; re-rendering replaces the previous listeners
  el._ac?.abort(); el._ac = new AbortController();
  el.addEventListener('focusin', (e) => { const i = idx(e); if (i >= 0) show(i); }, { signal: el._ac.signal });
  el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) hide(); }, { signal: el._ac.signal });
  el.onkeydown = (e) => { if (e.key === 'Escape') { hide(); e.target.blur?.(); } };
}
function deltaHtml(n, unit) {
  return n > 0 ? `<span class="delta up">+${compact(n)} ${unit} this week</span>` : `<span class="delta flat">no new ${unit} this week</span>`;
}

function lineChart(series) {
  const W = 560, H = 190, padL = 6, padR = 6, top = 40, bottom = 26;
  const max = Math.max(1, ...series.map((s) => s.value));
  const step = (W - padL - padR) / Math.max(1, series.length - 1);
  const pts = series.map((s, i) => [padL + i * step, top + (1 - s.value / max) * (H - top - bottom)]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) { const mx = (pts[i - 1][0] + pts[i][0]) / 2; d += ` C${mx},${pts[i - 1][1]} ${mx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`; }
  const area = d + ` L${pts[pts.length - 1][0]},${H - bottom} L${pts[0][0]},${H - bottom} Z`;
  const labels = series.map((s, i) => `<text x="${pts[i][0]}" y="${H - 6}" text-anchor="middle">${esc(s.label)}</text>`).join('');
  const hi = series.reduce((b, s, i) => (s.value >= series[b].value ? i : b), 0);
  return { W, H, pts, hi, svg: `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Chats saved per ${period === 'weekly' ? 'week' : 'month'}">
    <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".30"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <path class="ar" d="${area}" fill="url(#ar)"/><path class="ln" pathLength="1" d="${d}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
    <line id="cl" x1="${pts[hi][0]}" x2="${pts[hi][0]}" y1="${pts[hi][1]}" y2="${H - bottom}" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 4"/>
    <circle id="cd" cx="${pts[hi][0]}" cy="${pts[hi][1]}" r="5.5" fill="#fff" stroke="rgba(255,255,255,.4)" stroke-width="5"/>${labels}</svg>` };
}

function renderChart(stats) {
  const series = activitySeries(all, period);
  const ch = lineChart(series);
  const box = $('chart');
  box.innerHTML = ch.svg + '<div class="tip" id="tip"></div>';
  const tip = $('tip'), cl = box.querySelector('#cl'), cd = box.querySelector('#cd');
  const show = (i) => {
    const [x, y] = ch.pts[i];
    cl.setAttribute('x1', x); cl.setAttribute('x2', x); cl.setAttribute('y1', y);
    cd.setAttribute('cx', x); cd.setAttribute('cy', y);
    const pct = (x / ch.W) * 100;
    tip.style.left = pct + '%'; tip.style.top = (y / ch.H) * 100 + '%';
    tip.style.transform = pct > 80 ? 'translate(-86%, -118%)' : pct < 10 ? 'translate(-14%, -118%)' : 'translate(-50%, -118%)';
    tip.innerHTML = `${esc(series[i].label)}<b>${series[i].value} chat${series[i].value === 1 ? '' : 's'}</b>`;
  };
  show(ch.hi);
  box.onmousemove = (e) => {
    const r = box.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * ch.W;
    let best = 0;
    ch.pts.forEach((p, i) => { if (Math.abs(p[0] - x) < Math.abs(ch.pts[best][0] - x)) best = i; });
    show(best);
  };
  box.onmouseleave = () => show(ch.hi);
  void stats;
}

function recentCard(c, stats) {
  const color = siteColor(c.site);
  const t = chatTokens(c);
  return `<article class="rc glass-in" data-id="${esc(c.id)}" tabindex="0" role="button" aria-label="Open ${esc(c.title)}">
    <div class="thumb" style="background:linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #6d4aff))">${avatarHtml(c.site, c.siteName, 44)}<em>${esc(c.siteName)}</em></div>
    <div><h4>${esc(c.title)}</h4><div class="by"><i>${esc((c.folder || c.siteName)[0].toUpperCase())}</i>${esc(c.folder || 'No folder')} · ${ago(c.savedAt)}</div></div>
    <div class="spent">~${compact(t)} tokens<small>${c.messages.length} messages</small></div>
    ${ringSvg(stats.ringOf(c), 'Size compared with your largest saved chat')}
  </article>`;
}

function renderDashboard() {
  const stats = computeStats(all);
  $('today').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' });
  $('sChats').textContent = stats.totals.chats.toLocaleString();
  $('sWords').textContent = compact(stats.totals.words);
  $('sChatsD').innerHTML = deltaHtml(stats.week.chats, 'chats');
  $('sWordsD').innerHTML = deltaHtml(stats.week.words, 'words');
  renderBars($('sChatsBars'), stats.dailyChats, { one: 'chat saved', many: 'chats saved' });
  renderBars($('sWordsBars'), stats.dailyWords, { one: 'word archived', many: 'words archived' });
  $('heroNum').textContent = stats.today.chats;
  $('heroSub').textContent = `${stats.today.messages} messages · ~${compact(stats.today.tokens)} tokens today`;
  renderChart(stats);

  const recent = all.slice(0, 3);
  $('recent').innerHTML = recent.length ? recent.map((c) => recentCard(c, stats)).join('')
    : `<div class="empty glass-in">Nothing saved yet. Open a chat on a supported site, press Alt+Shift+E, then “Save to vault”.<br><button id="emptySamples" class="primary">Add sample chats to explore</button></div>`;

  renderQuickFind();
  renderFoldersMini(stats);
}

function renderQuickFind() {
  const q = $('qf').value.trim().toLowerCase();
  const rows = (q ? all.filter((c) => c.searchText.includes(q)) : all).slice(0, 4);
  $('qfList').innerHTML = rows.length ? rows.map((c) => `
    <div class="qf" data-id="${esc(c.id)}" tabindex="0" role="button">
      ${avatarHtml(c.site, c.siteName, 34)}
      <div><b>${esc(c.title)}</b><span class="sn">${snippetFor(c, q)}</span></div>
      <div class="count" title="${c.messages.length} messages">${c.messages.length}</div>
    </div>`).join('') : `<div class="empty">${all.length ? 'No chats match.' : 'Your saved chats appear here.'}</div>`;
}

function renderFoldersMini(stats) {
  const f = stats.folders.slice(0, 3);
  $('foldersMini').innerHTML = f.length ? f.map((x) => folderCard(x)).join('')
    : '<div class="empty" style="grid-column:1/-1">Add a folder name when you save a chat to group it here.</div>';
}
function folderCard(x) {
  return `<div class="fcard" data-folder="${esc(x.name)}" tabindex="0" role="button">
    <div class="fcover" style="background:${folderGrad(x.name)}"><span class="fbadge">${x.count} chat${x.count === 1 ? '' : 's'}</span></div>
    <b>${esc(x.name)}</b><small>~${compact(x.tokens)} tokens</small></div>`;
}

/* ---------- library ---------- */
function fillFilters() {
  const sv = $('site').value, fv = $('folder').value;
  const sites = [...new Map(all.map((c) => [c.site, c.siteName])).entries()];
  $('site').innerHTML = '<option value="">All sites</option>' + sites.map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join('');
  const folders = [...new Set(all.map((c) => c.folder).filter(Boolean))].sort();
  $('folder').innerHTML = '<option value="">All folders</option>' + folders.map((f) => `<option>${esc(f)}</option>`).join('');
  $('site').value = sv; $('folder').value = fv;
}

function visibleChats() {
  const q = $('q').value.trim().toLowerCase();
  const site = $('site').value, folder = $('folder').value;
  return all.filter((c) => (!q || c.searchText.includes(q)) && (!site || c.site === site) && (!folder || c.folder === folder) && (!activeTag || (c.tags || []).includes(activeTag)));
}

function renderLibrary() {
  const q = $('q').value.trim().toLowerCase();
  const rows = visibleChats();
  $('libCount').textContent = `${rows.length} of ${all.length} chats`;
  const tags = [...new Set(all.flatMap((c) => c.tags || []))].sort();
  $('tags').innerHTML = tags.map((t) => `<span class="chip${t === activeTag ? ' on' : ''}" data-tag="${esc(t)}">#${esc(t)}</span>`).join('');
  $('mergeBtn').textContent = `Export combined (${picked.size})`;
  $('mergeBtn').disabled = picked.size < 2;
  $('list').innerHTML = rows.length ? rows.map((c) => `
    <article class="card glass-in" data-id="${esc(c.id)}">
      <input type="checkbox" class="pick" aria-label="Select ${esc(c.title)}" ${picked.has(c.id) ? 'checked' : ''}>
      <div>
        <h2>${esc(c.title)}</h2>
        <div class="muted small">${esc(c.siteName)} · ${c.messages.length} messages · saved ${new Date(c.savedAt).toLocaleDateString()}${c.updatedAt ? ` · <span class="chip upd">Updated +${c.updatedCount || 0} ${new Date(c.updatedAt).toLocaleDateString()}</span>` : ''}${c.folder ? ' · 📁 ' + esc(c.folder) : ''}
          ${(c.tags || []).map((t) => `<span class="chip">#${esc(t)}</span>`).join(' ')}${c.sample ? ' <span class="chip">sample</span>' : ''}</div>
        ${q ? `<div class="snip">${snippetFor(c, q)}</div>` : ''}
        <div class="acts">
          <button data-a="view">Preview</button><button data-a="export">Export…</button><button data-a="tag">Tags / folder</button>
          ${c.url ? '<button data-a="open">Open original</button>' : ''}<button data-a="del" class="danger">Delete</button>
        </div>
        <div class="view-pane" hidden></div>
      </div>
    </article>`).join('') : `<div class="empty glass-in">${all.length ? 'No chats match.' : 'Nothing saved yet.'}</div>`;
}

/* ---------- folders / sites / settings ---------- */
function renderFoldersAll() {
  const stats = computeStats(all);
  $('foldersAll').innerHTML = stats.folders.length ? stats.folders.map(folderCard).join('') : '<div class="empty glass-in" style="grid-column:1/-1">No folders yet.</div>';
}
const TIER_LABEL = { web: 'AUTO', local: 'SELF-HOSTED', via: 'VIA', app: 'NO WEB PAGE' };
let sitesInit = false;
function renderSites() {
  if (!sitesInit) {
    sitesInit = true;
    $('siteCat').innerHTML = '<option value="">All categories</option>' + Object.entries(CV.CATEGORIES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
    ['siteSearch', 'siteCat', 'siteTier'].forEach((id) => $(id).addEventListener('input', renderSites));
  }
  const q = $('siteSearch').value.trim().toLowerCase(), cat = $('siteCat').value, tier = $('siteTier').value;
  const list = SITES.filter((s) => (!cat || s.cat === cat)
    && (!tier || (tier === 'selectors' ? s.selectors : tier === 'web' ? s.tier === 'web' && !s.selectors : s.tier === tier))
    && (!q || (s.name + ' ' + s.hosts.join(' ') + ' ' + s.cat).toLowerCase().includes(q)));
  $('siteCount').textContent = `${list.length} of ${SITES.length} tools`;
  const card = (s) => {
    const open = s.url ? `href="${esc(s.url)}" target="_blank" rel="noopener"` : '';
    const badge = s.selectors ? (s.beta ? '<span class="beta">BETA</span>' : '<span class="ok">BUILT-IN</span>') : `<span class="beta tier-${s.tier}">${TIER_LABEL[s.tier]}</span>`;
    const saved = all.filter((c) => c.site === s.id).length;
    return `<${s.url ? 'a' : 'div'} class="sitecard glass-in${s.tier === 'app' ? ' dim' : ''}" ${open} title="${esc(s.note || '')}">
      ${avatarHtml(s.id, s.name, 38)}
      <div class="grow"><b>${esc(s.name)}</b>${badge}<div class="muted small">${s.note && !s.url ? esc(s.note) : (saved + ' saved · ' + esc(CV.CATEGORIES[s.cat]))}</div></div></${s.url ? 'a' : 'div'}>`;
  };
  $('sitesAll').innerHTML = list.length ? list.map(card).join('') : '<div class="empty glass-in" style="grid-column:1/-1">No tools match.</div>';
  const quick = SITES.filter((s) => s.auto && s.url).slice(0, 14);
  $('siteMenu').innerHTML = quick.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${avatarHtml(s.id, s.name, 18)} ${esc(s.name)}</a>`).join('') + '<a href="#sites">All supported sites…</a>';
}
async function renderNotion() {
  const cfg = await getNotion();
  $('nStatus').textContent = cfg ? `Connected to “${cfg.pageTitle || 'your page'}”. Pick Notion as the format on the export page.` : 'Not connected.';
  $('nMode').value = (cfg && cfg.mode) || 'page';
  $('nToken').value = ''; $('nToken').placeholder = cfg ? '•••• saved (paste a new one to replace)' : 'ntn_… or secret_…';
  $('nPage').value = cfg ? cfg.parentUrl || cfg.parentId : '';
}
async function renderSettings() {
  renderNotion();
  try {
    const e = await navigator.storage.estimate();
    $('storageInfo').textContent = `${all.length} chats saved · using ${(e.usage / 1048576).toFixed(2)} MB of this browser's storage`;
  } catch { $('storageInfo').textContent = `${all.length} chats saved`; }
  const { floatBtn } = await chrome.storage.sync.get('floatBtn');
  $('floatBtn').checked = floatBtn !== false;
  $('floatBtn').onchange = () => chrome.storage.sync.set({ floatBtn: $('floatBtn').checked });
  const { selectorOverrides } = await chrome.storage.sync.get('selectorOverrides');
  const o = selectorOverrides || {};
  const ids = Object.keys(o);
  $('overrides').innerHTML = ids.length ? ids.map((id) => `<div class="row" style="margin:6px 0"><b>${esc(id)}</b><span class="muted small grow">${esc(o[id].user || '')} | ${esc(o[id].assistant || '')}</span><button data-clear="${esc(id)}">Remove</button></div>`).join('') : '<span class="muted small">None. Set them from the toolbar popup if a site stops working.</span>';
}

/* ---------- data actions ---------- */
async function reload() {
  all = await getAll();
  renderSidebar();
  await loadInbox();
  if (!$('view-inbox').hidden) renderInbox();
  fillFilters();
  renderDashboard(); renderFoldersAll(); renderSites();
  if (!$('view-library').hidden) renderLibrary();
  if (!$('view-settings').hidden) renderSettings();
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
const openExport = (chat) => chrome.runtime.sendMessage({ type: 'open-page', path: 'export.html?lib=' + encodeURIComponent(chat.id) });

async function exportCombined() {
  const chats = all.filter((c) => picked.has(c.id)).sort((a, b) => a.savedAt - b.savedAt);
  if (chats.length < 2) return;
  const messages = [];
  chats.forEach((c) => {
    messages.push({ i: messages.length, role: 'section', markdown: c.title });
    c.messages.forEach((m) => messages.push({ i: messages.length, role: m.role, markdown: m.markdown, siteName: c.siteName }));
  });
  const payload = { site: 'multi', siteName: 'Archiv', title: `Combined export (${chats.length} chats)`, url: '', exportedAt: new Date().toISOString(), merged: true, messages };
  await chrome.runtime.sendMessage({ type: 'open-export', payload });
}

async function backup() {
  if (!all.length) return toast('Nothing to back up yet');
  download(new Blob([JSON.stringify(all.map(({ searchText, ...r }) => r), null, 1)], { type: 'application/json' }), 'archiv-backup-' + new Date().toISOString().slice(0, 10) + '.json');
}

/* ---------- events ---------- */
document.addEventListener('click', async (e) => {
  const t = e.target;
  if (!t.closest('.menuwrap') && !t.closest('#plusBtn')) $('siteMenu').hidden = true;

  const rc = t.closest('.rc, .qf');
  if (rc) { const c = all.find((x) => x.id === rc.dataset.id); if (c) openExport(c); return; }
  const fc = t.closest('.fcard');
  if (fc) {
    $('q').value = ''; activeTag = ''; $('site').value = '';
    $('folder').value = fc.dataset.folder;
    if (location.hash === '#library') renderLibrary(); else location.hash = '#library';
    return;
  }
  const tag = t.closest('#tags .chip');
  if (tag) { activeTag = activeTag === tag.dataset.tag ? '' : tag.dataset.tag; renderLibrary(); return; }

  const btn = t.closest('button');
  if (!btn) return;
  if (btn.id === 'emptySamples' || btn.id === 'addSamples') { for (const s of makeSamples()) await saveChat(s); toast('Sample chats added'); return reload(); }
  if (btn.id === 'rmSamples') { for (const c of all.filter((x) => x.sample)) await deleteChat(c.id); toast('Samples removed'); return reload(); }
  if (btn.id === 'wipe') { if (confirm('Delete ALL saved chats from this browser? This cannot be undone.')) { for (const c of all) await deleteChat(c.id); picked.clear(); toast('Vault emptied'); await reload(); } return; }
  if (btn.id === 'nSave') {
    const old = await getNotion();
    const token = $('nToken').value.trim() || (old && old.token) || '';
    const parentId = parsePageId($('nPage').value);
    if (!token) { $('nStatus').textContent = 'Paste the integration secret.'; return; }
    if (!parentId) { $('nStatus').textContent = 'That does not look like a Notion page link or ID.'; return; }
    $('nStatus').textContent = 'Checking…';
    try {
      if (!(await ensureNotionAccess())) { $('nStatus').textContent = 'Archiv needs permission to reach api.notion.com. Click again and allow it.'; return; }
      const { title } = await testNotion({ token, parentId });
      const old = await getNotion(); const mode = $('nMode').value;
      await setNotion({ token, parentId, parentUrl: $('nPage').value.trim(), pageTitle: title, mode, databaseId: old && old.parentId === parentId ? old.databaseId : undefined });
      toast('Notion connected'); return renderNotion();
    } catch (e) { $('nStatus').textContent = e.message; return; }
  }
  if (btn.id === 'nClear') { await clearNotion(); await revokeNotionAccess().catch(() => {}); toast('Notion disconnected'); return renderNotion(); }
  if (btn.dataset.clear) { const { selectorOverrides } = await chrome.storage.sync.get('selectorOverrides'); const o = selectorOverrides || {}; delete o[btn.dataset.clear]; await chrome.storage.sync.set({ selectorOverrides: o }); return renderSettings(); }
  if (btn.id === 'moreBtn' || btn.id === 'plusBtn') { $('siteMenu').hidden = !$('siteMenu').hidden; return; }
  if (btn.id === 'xferBtn') { const m = $('xferMenu'); m.hidden = !m.hidden; btn.setAttribute('aria-expanded', String(!m.hidden)); return; }
  if (btn.closest && btn.closest('#xferMenu')) { $('xferMenu').hidden = true; $('xferBtn').setAttribute('aria-expanded', 'false'); }
  if (btn.id === 'promoBackup' || btn.id === 'backup') return backup();
  if (btn.id === 'searchGo') { $('q').value = $('globalSearch').value; location.hash = '#library'; return renderLibrary(); }
  if (btn.id === 'mergeBtn') return exportCombined();
  if (btn.id === 'selVisible') { visibleChats().forEach((c) => picked.add(c.id)); return renderLibrary(); }
  if (btn.id === 'selClear') { picked.clear(); return renderLibrary(); }
  if (btn.id === 'zipObs') {
    const used = new Set();
    const files = all.map((c) => {
      const dir = safeFolder(c.folder);
      let n = (dir ? dir + '/' : '') + safeNoteName(`${c.title} (${c.siteName})`);
      for (let k = 2; used.has(n.toLowerCase()); k++) n = n.replace(/( \(\d+\))?$/, ` (${k})`);
      used.add(n.toLowerCase());
      return { name: n + '.md', data: toObsidianDoc(c, c.messages, { tags: c.tags || [] }) };
    });
    if (!files.length) return toast('Nothing saved yet');
    return download(zip(files), 'archiv-obsidian-notes.zip');
  }
  if (btn.id === 'zipAll') {
    if (!all.length) return toast('Vault is empty');
    const used = new Set();
    const files = all.map((c) => {
      const base = (c.folder ? safeFilename(c.folder) + '/' : '') + safeFilename(c.title);
      let n = base, k = 2; while (used.has(n)) n = base + ' (' + k++ + ')';
      used.add(n);
      return { name: n + '.md', data: toMarkdownDoc(c, c.messages) };
    });
    return download(zip(files), 'archiv-library.zip');
  }
  if (btn.id === 'import') return $('file').click();

  const card = btn.closest('.card');
  if (card && btn.dataset.a) {
    const chat = all.find((c) => c.id === card.dataset.id);
    const a = btn.dataset.a;
    if (a === 'view') {
      const v = card.querySelector('.view-pane');
      if (v.hidden) {
        v.innerHTML = paneHtml();
        v.querySelector('.fq').value = ($('q').value || '').trim();   // carry the library search into the preview
        v.dataset.cur = '0';
        paintPane(card, false);
      }
      v.hidden = !v.hidden;
      if (!v.hidden) v.querySelector('.fq').focus();
    } else if (a === 'fprev' || a === 'fnext') {
      stepPane(card, a === 'fnext' ? 1 : -1);
    } else if (a === 'export') openExport(chat);
    else if (a === 'open') { if (/^https:/.test(chat.url || '')) window.open(chat.url, '_blank', 'noopener'); }
    else if (a === 'tag') {
      const tags = prompt('Tags (comma separated)', (chat.tags || []).join(', '));
      if (tags === null) return;
      const folder = prompt('Folder (blank for none)', chat.folder || '');
      if (folder === null) return;
      await saveChat({ ...chat, tags: tags.split(',').map((x) => x.trim()).filter(Boolean), folder: folder.trim() });
      await reload();
    } else if (a === 'del') {
      if (confirm('Delete "' + chat.title + '" from your vault? This cannot be undone.')) { await deleteChat(chat.id); picked.delete(chat.id); await reload(); }
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const el = e.target.closest && e.target.closest('.rc, .qf, .fcard');
  if (el) el.click();
});
document.addEventListener('change', (e) => {
  if (e.target.classList.contains('pick')) {
    const id = e.target.closest('.card').dataset.id;
    e.target.checked ? picked.add(id) : picked.delete(id);
    $('mergeBtn').textContent = `Export combined (${picked.size})`;
    $('mergeBtn').disabled = picked.size < 2;
  }
});
$('q').oninput = renderLibrary;
$('site').onchange = renderLibrary;
$('folder').onchange = renderLibrary;
$('qf').oninput = renderQuickFind;
$('period').onchange = () => { period = $('period').value; renderChart(); };
$('globalSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') { $('q').value = $('globalSearch').value; location.hash = '#library'; renderLibrary(); } });
$('file').onchange = async () => {
  const f = $('file').files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data)) throw new Error('not a Archiv backup');
    let n = 0;
    for (const c of data) if (c && c.title && Array.isArray(c.messages)) { await saveChat(c); n++; }
    toast(`Imported ${n} chats`);
    await reload();
  } catch (err) { toast('Import failed: ' + err.message); }
  $('file').value = '';
};

(async function init() {
  mountSidebar({ page: 'dashboard', title: 'Dashboard' });
  await loadInbox();
  all = await getAll();
  fillFilters();
  renderDashboard(); renderFoldersAll(); renderSites();
  route();
})();

// The service worker reuses this tab for new exports and asks it to switch view.
chrome.runtime.onMessage.addListener((m) => { if (m && m.type === 'hash' && m.hash && location.hash !== m.hash) location.hash = m.hash; });

document.addEventListener('click', (e) => { if (!e.target.closest('.xfer') && $('xferMenu')) { $('xferMenu').hidden = true; $('xferBtn').setAttribute('aria-expanded', 'false'); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('xferMenu')) $('xferMenu').hidden = true; });

try { const v = chrome.runtime.getManifest().version; const el = document.getElementById('ver'); if (el) el.textContent = 'Archiv v' + v; } catch { /* ignore */ }
