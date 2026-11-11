// Per-site message finders for 15 AI platforms.
//
// Selectors are the part that breaks when a site redesigns, so they live in ONE
// file. Three layers keep exports working anyway:
//   1. the site's own selectors below
//   2. user overrides (popup > "Teach Archiv AI", or typed selectors)
//   3. auto-detect: a heuristic scan for user / AI turns by attribute names
// `verified: true` is set only after a real-account test. None are verified yet.
(function () {
globalThis.CV = globalThis.CV || {};
if (CV.ADAPTERS) return; // already loaded in this page (static + on-demand injection)

const clean = (name) => () => document.title.replace(new RegExp('\\s*[-|–·]\\s*' + name + '\\s*$', 'i'), '').trim();
const qParam = (k) => new URLSearchParams(location.search).get(k);

CV.ADAPTERS = [
  {
    id: 'chatgpt', name: 'ChatGPT', color: '#10a37f', url: 'https://chatgpt.com/', hosts: ['chatgpt.com', 'chat.openai.com'],
    user: '[data-message-author-role="user"]',
    assistant: '[data-message-author-role="assistant"]',
    body: '.markdown, .whitespace-pre-wrap',
    title: clean('ChatGPT')
  },
  {
    id: 'claude', name: 'Claude', color: '#d97757', url: 'https://claude.ai/', hosts: ['claude.ai'],
    user: '[data-testid="user-message"]',
    assistant: '.font-claude-response, .font-claude-message',
    // Artifact panel (the document/code shown beside the chat). Only the artifact currently open is in the page.
    artifacts: '[data-testid="artifact-content"], [class*="artifact-content"], [id*="artifact-panel"] pre, [class*="artifact"] pre',
    artifactTitle: '[data-testid="artifact-title"], [class*="artifact"] h1, [class*="artifact"] [class*="title"]',
    title: clean('Claude')
  },
  {
    id: 'gemini', name: 'Gemini', color: '#4285f4', url: 'https://gemini.google.com/', hosts: ['gemini.google.com'],
    user: 'user-query .query-text, user-query',
    assistant: 'model-response .markdown, model-response message-content, model-response',
    title: clean('Gemini')
  },
  {
    id: 'deepseek', name: 'DeepSeek', color: '#4d6bfe', url: 'https://chat.deepseek.com/', hosts: ['chat.deepseek.com'], beta: true,
    user: '[class*="user-message"], .fbb737a4',
    assistant: '.ds-markdown',
    title: clean('DeepSeek')
  },
  {
    id: 'grok', name: 'Grok', color: '#111827', url: 'https://grok.com/', hosts: ['grok.com'], beta: true,
    user: '.message-bubble.items-end, [class*="items-end"] > .message-bubble',
    assistant: '.message-bubble:not(.items-end), [class*="items-start"] > .message-bubble',
    body: '.response-content-markdown, .markdown',
    title: clean('Grok')
  },
  {
    id: 'copilot', name: 'Copilot', color: '#0f6cbd', url: 'https://copilot.microsoft.com/', hosts: ['copilot.microsoft.com'], beta: true,
    user: '[data-content="user-message"]',
    assistant: '[data-content="ai-message"]',
    title: clean('(?:Microsoft )?Copilot')
  },
  {
    id: 'githubcopilot', name: 'GitHub Copilot', color: '#6e40c9', url: 'https://github.com/copilot', hosts: ['github.com'], beta: true,
    match: () => location.pathname.startsWith('/copilot'),
    user: '[class*="UserMessage"], [class*="user-message"], [data-testid*="user" i]',
    assistant: '[class*="AIMessage"], [class*="ChatMessage-module__ai"], [class*="assistant-message"], [data-testid*="assistant" i]',
    title: clean('GitHub(?: Copilot)?')
  },
  {
    id: 'googleai', name: 'Google AI Mode', color: '#ea4335', url: 'https://www.google.com/search?udm=50', hosts: ['www.google.com'], beta: true,
    match: () => location.pathname === '/search' && (qParam('udm') === '50' || !!document.querySelector('[data-subtree*="aimc"], [jsname][data-xid*="aim"]')),
    user: '[data-scope-id="turn"] [role="heading"], [class*="user-query" i], [data-attrid*="query" i]',
    assistant: '[data-subtree*="aimc"], [class*="ai-response" i], [data-scope-id="turn"] [data-container-id]',
    title: () => (qParam('q') || document.title.replace(/\s*-\s*Google Search\s*$/i, '')).trim()
  },
  {
    id: 'aistudio', name: 'AI Studio', color: '#1a73e8', url: 'https://aistudio.google.com/', hosts: ['aistudio.google.com'], beta: true,
    user: 'ms-chat-turn .chat-turn-container.user, ms-chat-turn [class*="user-chunk"]',
    assistant: 'ms-chat-turn .chat-turn-container.model, ms-chat-turn [class*="model-chunk"]',
    title: clean('Google AI Studio')
  },
  {
    id: 'perplexity', name: 'Perplexity', color: '#20808d', url: 'https://www.perplexity.ai/', hosts: ['perplexity.ai'], beta: true,
    user: 'h1[class*="group/query"], [class*="group/query"]',
    assistant: '[id^="markdown-content"], .prose',
    title: clean('Perplexity')
  },
  {
    id: 'notebooklm', name: 'NotebookLM', color: '#0b57d0', url: 'https://notebooklm.google.com/', hosts: ['notebooklm.google.com'], beta: true,
    user: '[class*="from-user"]',
    assistant: '[class*="to-user"]',
    title: clean('NotebookLM')
  },
  {
    id: 'kimi', name: 'Kimi', color: '#111111', url: 'https://www.kimi.com/', hosts: ['kimi.com', 'kimi.moonshot.cn'], beta: true,
    user: '[class*="chat-content-item-user"], .segment-user',
    assistant: '[class*="chat-content-item-assistant"], .segment-assistant',
    body: '.markdown, .markdown-container',
    title: clean('Kimi')
  },
  {
    id: 'yuanbao', name: 'YuanBao', color: '#12b886', url: 'https://yuanbao.tencent.com/', hosts: ['yuanbao.tencent.com'], beta: true,
    user: '[class*="item--human"], [class*="bubble--human"]',
    assistant: '[class*="item--ai"], [class*="bubble--ai"]',
    title: clean('(?:腾讯)?元宝')
  },
  {
    id: 'qwen', name: 'Qwen', color: '#615ced', url: 'https://chat.qwen.ai/', hosts: ['chat.qwen.ai'], beta: true,
    user: '[class*="user-message"], [class*="questionItem"]',
    assistant: '.qwen-markdown, [class*="response-message"]',
    title: clean('Qwen(?: Chat)?')
  },
  {
    id: 'doubao', name: 'Doubao', color: '#1e6fff', url: 'https://www.doubao.com/', hosts: ['doubao.com'], beta: true,
    user: '[data-testid="send_message"]',
    assistant: '[data-testid="receive_message"]',
    title: clean('(?:豆包|Doubao)')
  }
];

CV.SITE_COLORS = Object.fromEntries(CV.ADAPTERS.map((a) => [a.id, a.color]));

CV.colorFor = function (id) {
  if (CV.SITE_COLORS[id]) return CV.SITE_COLORS[id];
  let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 55% 42%)`;
};

const ADAPTER_IDS = new Set(CV.ADAPTERS.map((a) => a.id));
const hostOk = (host, hosts) => hosts.some((h) => host === h || host.endsWith('.' + h));

/** Everything the dashboard lists: registry entries merged with their adapter, if any. */
CV.SITES = (CV.REGISTRY || []).map((r) => {
  const a = CV.ADAPTERS.find((x) => x.id === r.id);
  return {
    ...r,
    color: CV.colorFor(r.id),
    url: a ? a.url : (r.hosts[0] && r.tier === 'web' ? 'https://' + r.hosts[0] + (r.path || '/') : ''),
    selectors: !!a,
    beta: a ? !!a.beta : true
  };
});

// Adapter used when a site has no selectors of its own: auto-detect + Teach Archiv AI do the work.
function makeGeneric(reg) {
  const host = location.hostname.replace(/^www\./, '');
  let id, name;
  if (reg) { id = reg.id; name = reg.name; }
  else {
    const t = document.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const local = (CV.REGISTRY || []).find((e) => e.tier === 'local' && t.includes(e.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
    id = local ? local.id : 'host:' + location.host;
    name = local ? local.name : (host || 'This page');
  }
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    id, name, color: CV.colorFor(id), url: location.origin + '/', hosts: [location.hostname], beta: true, generic: true, user: null, assistant: null,
    title: () => document.title.replace(new RegExp('\\s*[-|\u2013\u00b7]\\s*' + esc + '\\s*$', 'i'), '').trim() || host
  };
}

CV.currentAdapter = function () {
  const host = location.hostname;
  const named = CV.ADAPTERS.find((a) => hostOk(host, a.hosts) && (!a.match || a.match()));
  if (named) return named;
  const reg = (CV.REGISTRY || []).find((e) => !ADAPTER_IDS.has(e.id) && e.tier === 'web' && e.hosts.length && hostOk(host, e.hosts) && (!e.path || location.pathname.startsWith(e.path)));
  return makeGeneric(reg || null);
};

CV.isKnownSite = function () { const a = CV.currentAdapter(); return !a.generic || !String(a.id).startsWith('host:'); };

function queryAll(sel) {
  if (!sel) return [];
  try { return Array.from(document.querySelectorAll(sel)); } catch { return []; }
}

// Returns [{role, el}] in document order, outermost matches only.
CV.findMessages = function (adapter, overrides) {
  const o = (overrides && overrides[adapter.id]) || {};
  const userSel = o.user || adapter.user;
  const asstSel = o.assistant || adapter.assistant;
  const all = [];
  const seen = new Set();
  const add = (sel, role) => queryAll(sel).forEach((el) => { if (!seen.has(el)) { seen.add(el); all.push({ role, el }); } });
  add(userSel, 'user');
  add(asstSel, 'assistant');
  return CV.tidy(all);
};

CV.tidy = function (all) {
  all.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  const els = all.map((m) => m.el);
  return all.filter((m) => !els.some((other) => other !== m.el && other.contains(m.el)));
};

// ---------- auto-detect (layer 3) ----------
// Looks for elements whose class / id / data-* attributes name a user turn or an
// AI turn. Only trusted when BOTH roles are found, and never inside the composer.
const USER_RE = /(?:^|[^a-z])(user|human|query|question|prompt|send|from-user|me)(?:[^a-z]|$)/i;
const AI_RE = /(?:^|[^a-z])(assistant|bot|ai|answer|response|receive|model|reply|to-user|markdown)(?:[^a-z]|$)/i;

function attrBlob(el) {
  let s = typeof el.className === 'string' ? el.className : '';
  s += ' ' + (el.id || '');
  for (const a of el.attributes) if (a.name.startsWith('data-')) s += ' ' + a.name + ' ' + a.value;
  return s;
}

CV.heuristicMessages = function () {
  const root = document.querySelector('main') || document.body;
  const users = [], ais = [];
  root.querySelectorAll('*').forEach((el) => {
    if (el.closest('textarea, input, [contenteditable="true"], form, nav, header, footer, aside')) return;
    if (el.children.length > 40) return;
    const blob = attrBlob(el);
    if (!blob.trim()) return;
    const u = USER_RE.test(blob), a = AI_RE.test(blob);
    if (u === a) return;
    const len = (el.textContent || '').trim().length;   // only measured for candidates
    if (len < 2 || len > 60000) return;
    if (u) users.push({ role: 'user', el });
    else ais.push({ role: 'assistant', el });
  });
  // keep only outermost per role
  const outer = (list) => list.filter((m) => !list.some((o) => o !== m && o.el.contains(m.el)));
  const U = outer(users), A = outer(ais);
  if (!U.length || !A.length) return [];
  // a plausible chat alternates; reject when one side is wildly larger
  if (Math.max(U.length, A.length) > 4 * Math.min(U.length, A.length) + 4) return [];
  return CV.tidy([...U, ...A]);
};

// ---------- "teach" selector derivation ----------
const STATE_CLASS = /^(active|selected|open|hover|focus|show|hidden|visible|dark|light|ng-|is-|has-)/i;
function stableClass(c) {
  if (STATE_CLASS.test(c) || /^(css|sc|_|jsx|svelte)-?/i.test(c)) return false;
  if (c.length < 3 || c.length > 40 || /\d{3,}/.test(c)) return false;
  if (/^[a-z0-9]{8,}$/i.test(c) && /\d/.test(c)) return false;      // hashed
  if (/^[a-z]{1,3}[A-Z0-9_-]{5,}$/.test(c)) return false;            // minified
  return true;
}
function candidates(el) {
  const out = [];
  const tag = el.tagName.toLowerCase();
  for (const a of el.attributes) {
    if (!a.name.startsWith('data-') || a.value.length > 40 || /\d{4,}/.test(a.value)) continue;
    out.push(`[${a.name}="${CSS.escape(a.value)}"]`, `${tag}[${a.name}]`);
  }
  if (tag.includes('-')) out.push(tag);
  const cls = Array.from(el.classList).filter(stableClass);
  cls.forEach((c) => out.push('.' + CSS.escape(c), `${tag}.${CSS.escape(c)}`));
  if (cls.length > 1) out.push('.' + cls.slice(0, 2).map(CSS.escape).join('.'));
  return out;
}

/** Derive a selector that matches `el` (and its look-alikes) but never `avoidEl`. */
CV.deriveSelector = function (el, avoidEl) {
  let node = el;
  for (let depth = 0; node && node !== document.body && depth < 7; depth++, node = node.parentElement) {
    for (const sel of candidates(node)) {
      let list;
      try { list = Array.from(document.querySelectorAll(sel)); } catch { continue; }
      if (!list.includes(node)) continue;
      if (avoidEl && list.some((m) => m === avoidEl || m.contains(avoidEl) || avoidEl.contains(m))) continue;
      if (list.length > 400) continue;
      return sel;
    }
  }
  return null;
};
})();
