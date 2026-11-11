// Shared sidebar for the dashboard and export pages: icon rail + collapsible tree panel.
import { getAll } from './lib/db.js';
import { avatarHtml } from './lib/avatar.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  dash: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  lib: '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  gear: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  export: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>'
};
const CHEVL = '<path d="m15 6-6 6 6 6"/>';
const svg = (k, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24">${I[k]}</svg>`;

const ls = {
  get(k, d) { try { const v = localStorage.getItem('archiv-ai.sb.' + k) ?? localStorage.getItem('archiv.sb.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('archiv-ai.sb.' + k, JSON.stringify(v)); } catch { /* ignore */ } }
};

let opts = { page: 'dashboard', title: 'Dashboard', current: null };

async function inboxCount() {
  try { return Object.entries(await chrome.storage.local.get(null)).filter(([k, v]) => k.startsWith('pending:') && !(v && v.merged)).length; } catch { return 0; }
}

function groupHtml(id, label, icon, items, openByDefault) {
  const open = ls.get('open.' + id, openByDefault);
  return `<div class="sg${open ? ' open' : ''}" data-g="${id}">
    <button class="sg-h" aria-expanded="${open}">${svg(icon, 'ic')}<span>${esc(label)}</span>${svg('chev', 'chev')}</button>
    <div class="sg-b">${items}</div></div>`;
}
const item = (href, label, o = {}) =>
  `<a class="si${o.active ? ' active' : ''}" href="${esc(href)}" data-key="${esc(o.key || '')}">${o.icon || ''}<span class="grow">${esc(label)}</span>${o.badge ? `<em class="bdg">${o.badge}</em>` : ''}</a>`;

function activeKey() {
  if (opts.page === 'export') return 'export';
  const raw = (location.hash || '#dashboard').slice(1);
  const [v, q] = raw.split('?');
  const p = new URLSearchParams(q || '');
  if (v === 'library' && p.get('site')) return 'library?site=' + p.get('site');
  if (v === 'library' && p.get('folder')) return 'library?folder=' + p.get('folder');
  return v || 'dashboard';
}

export async function renderSidebar() {
  const root = document.getElementById('sb');
  if (!root) return;
  const [chats, inbox] = await Promise.all([getAll().catch(() => []), inboxCount()]);
  const key = activeKey();
  const sites = [...chats.reduce((m, c) => m.set(c.site, { name: c.siteName, n: (m.get(c.site)?.n || 0) + 1 }), new Map()).entries()].sort((a, b) => b[1].n - a[1].n);
  const folders = [...chats.reduce((m, c) => (c.folder ? m.set(c.folder, (m.get(c.folder) || 0) + 1) : m), new Map()).entries()].sort();
  const A = (k) => key === k;
  const H = 'dashboard.html';

  const overview = item(H + '#dashboard', 'Overview', { key: 'dashboard', active: A('dashboard'), icon: svg('dash', 'ic') })
    + item(H + '#inbox', 'Inbox', { key: 'inbox', active: A('inbox'), icon: svg('inbox', 'ic'), badge: inbox || '' })
    + (opts.page === 'export' ? item('#', opts.current || 'Current export', { key: 'export', active: true, icon: svg('export', 'ic') }) : '');
  const library = item(H + '#library', 'All chats', { key: 'library', active: A('library'), icon: svg('lib', 'ic'), badge: chats.length || '' })
    + sites.map(([id, s]) => item(H + '#library?site=' + encodeURIComponent(id), s.name, { key: 'library?site=' + id, active: A('library?site=' + id), icon: avatarHtml(id, s.name, 20), badge: s.n })).join('');
  const orgs = item(H + '#folders', 'All folders', { key: 'folders', active: A('folders'), icon: svg('folder', 'ic') })
    + folders.map(([f, n]) => item(H + '#library?folder=' + encodeURIComponent(f), f, { key: 'library?folder=' + f, active: A('library?folder=' + f), badge: n })).join('');
  const tools = item(H + '#sites', 'Supported sites', { key: 'sites', active: A('sites'), icon: svg('globe', 'ic') })
    + item(H + '#settings', 'Settings', { key: 'settings', active: A('settings'), icon: svg('gear', 'ic') });

  const collapsed = ls.get('collapsed', false);
  const rail = [['dash', 'dashboard', 'Overview'], ['inbox', 'inbox', 'Inbox'], ['lib', 'library', 'Library'], ['folder', 'folders', 'Folders'], ['globe', 'sites', 'Supported sites'], ['gear', 'settings', 'Settings']]
    .map(([ic, v, t]) => `<a class="rl${key.split('?')[0] === v ? ' active' : ''}" href="${H}#${v}" title="${t}" aria-label="${t}">${svg(ic)}${v === 'inbox' && inbox ? `<em class="dot"></em>` : ''}</a>`).join('');

  root.className = 'sb' + (collapsed ? ' collapsed' : '');
  root.innerHTML = `
    <div class="rail"><a class="rl logo" href="${H}#dashboard" title="Archiv AI"><img src="icons/128.png" alt="Archiv AI"></a><button class="sbtoggle" aria-label="Collapse or expand sidebar" title="Collapse / expand sidebar" aria-expanded="${!collapsed}"><svg viewBox="0 0 24 24">${CHEVL}</svg></button>${rail}<span class="grow"></span></div>
    <div class="panel">
      <div class="phead"><h2>${esc(opts.title)}</h2></div>
      <div class="ptree">
        ${groupHtml('overview', 'Overview', 'dash', overview, true)}
        ${groupHtml('library', 'Library', 'lib', library, true)}
        ${groupHtml('folders', 'Folders', 'folder', orgs, false)}
        ${groupHtml('tools', 'Tools', 'gear', tools, true)}
      </div>
      <div class="promo"><h3>Back up your vault</h3><p>Everything lives in this browser. Keep a copy.</p><button id="promoBackup">Download backup <span>→</span></button></div>
      <div class="sb-foot"><a class="bmc sm" href="https://www.buymeacoffee.com/Socialmania99" target="_blank" rel="noopener"><span class="cup" aria-hidden="true">☕</span>Buy me a coffee</a><a class="gh" href="https://github.com/socialmania99/archiv-ai" target="_blank" rel="noopener">GitHub</a></div>
    </div>`;
  if (window.ArchivAiTheme) window.ArchivAiTheme.mount();
}

export function mountSidebar(o = {}) {
  opts = { ...opts, ...o };
  const root = document.getElementById('sb');
  if (root.dataset.mounted) return renderSidebar();
  root.dataset.mounted = '1';
  root.addEventListener('click', (e) => {
    const h = e.target.closest('.sg-h');
    if (h) { const g = h.parentElement; g.classList.toggle('open'); h.setAttribute('aria-expanded', g.classList.contains('open')); ls.set('open.' + g.dataset.g, g.classList.contains('open')); return; }
    if (e.target.closest('.collapse, .sbtoggle')) { root.classList.toggle('collapsed'); const c = root.classList.contains('collapsed'); ls.set('collapsed', c); const t = root.querySelector('.sbtoggle'); if (t) t.setAttribute('aria-expanded', String(!c)); return; }
    const a = e.target.closest('a.si, a.rl');
    if (a && opts.page === 'dashboard' && a.getAttribute('href').startsWith('dashboard.html#')) { e.preventDefault(); location.hash = a.getAttribute('href').split('#')[1]; }
  });
  window.addEventListener('hashchange', renderSidebar);
  try { chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && Object.keys(c).some((k) => k.startsWith('pending:'))) renderSidebar(); }); } catch { /* ignore */ }
  return renderSidebar();
}
