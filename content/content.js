// Runs inside chat sites. Answers popup/command messages, scrolls to load the
// full history, converts messages to Markdown and hands them to the export page.
(function () {
  if (globalThis.__archivAiLoaded) return; // static + on-demand injection can both run
  globalThis.__archivAiLoaded = true;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function getOverrides() {
    try {
      const { selectorOverrides } = await chrome.storage.sync.get('selectorOverrides');
      return selectorOverrides || {};
    } catch { return {}; }
  }

  function scrollParent(el) {
    for (let n = el && el.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 20) return n;
    }
    return document.scrollingElement || document.documentElement;
  }

  // Lazy-loaded histories (Gemini, long ChatGPT/Claude threads): scroll up until
  // the message count stops growing, then restore the scroll position.
  async function loadAll(adapter, overrides) {
    let msgs = CV.findMessages(adapter, overrides);
    if (!msgs.length) return;
    const sc = scrollParent(msgs[0].el);
    const startTop = sc.scrollTop;
    let stable = 0, last = msgs.length;
    for (let i = 0; i < 40 && stable < 3; i++) {
      sc.scrollTop = 0;
      await sleep(450);
      const now = CV.findMessages(adapter, overrides).length;
      stable = now === last ? stable + 1 : 0;
      last = now;
    }
    sc.scrollTop = startTop;
  }

  async function scan() {
    const adapter = CV.currentAdapter();
    if (!adapter) return { supported: false };
    const overrides = await getOverrides();
    let msgs = CV.findMessages(adapter, overrides);
    let auto = false;
    if (!msgs.length) { msgs = CV.heuristicMessages(); auto = msgs.length > 0; }
    return { supported: true, site: adapter.id, siteName: adapter.name, beta: !!adapter.beta, generic: !!adapter.generic, auto, title: adapter.title(), count: msgs.length };
  }

  /** Open artifact(s) as fenced blocks. Skips ones already inside a chat message. */
  function collectArtifacts(adapter, overrides) {
    const sel = (overrides[adapter.id] || {}).artifacts || adapter.artifacts;
    if (!sel) return [];
    let els = [];
    try { els = [...document.querySelectorAll(sel)]; } catch { return []; }
    const msgSel = [adapter.user, adapter.assistant].filter(Boolean).join(',');
    const seen = new Set(), out = [];
    els.forEach((el) => {
      if (msgSel && el.closest(msgSel)) return;
      if (els.some((o) => o !== el && o.contains(el))) return;       // keep the outermost match only
      const text = (el.innerText || '').trim();
      if (text.length < 20 || seen.has(text)) return;
      seen.add(text);
      let title = 'Artifact';
      try { const t = adapter.artifactTitle && document.querySelector(adapter.artifactTitle); if (t && t.textContent.trim()) title = 'Artifact: ' + t.textContent.trim().slice(0, 80); } catch { /* keep default */ }
      const code = el.querySelector('code') || (el.tagName === 'PRE' ? el : null);
      const fence = code ? '```\n' + (code.innerText || '').replace(/\n+$/, '') + '\n```' : CV.toMarkdown(el);
      out.push('**' + title + '**\n\n' + fence);
    });
    return out;
  }

  async function buildPayload(autoload) {
    const adapter = CV.currentAdapter();
    if (!adapter) throw new Error('unsupported');
    const overrides = await getOverrides();
    if (autoload) await loadAll(adapter, overrides);
    const o = overrides[adapter.id] || {};
    let found = CV.findMessages(adapter, overrides);
    const viaSelectors = found.length > 0;
    if (!viaSelectors) found = CV.heuristicMessages();
    const msgs = found.map((m, i) => {
      let node = m.el;
      if (viaSelectors && m.role === 'assistant') {
        const sel = o.body || adapter.body;
        if (sel) { try { node = m.el.querySelector(sel) || m.el; } catch { /* keep el */ } }
      }
      return { i, role: m.role, markdown: CV.toMarkdown(node) };
    }).filter((m) => m.markdown);
    const arts = collectArtifacts(adapter, overrides);
    arts.forEach((a) => msgs.push({ i: msgs.length, role: 'assistant', markdown: a }));
    return {
      site: adapter.id,
      siteName: adapter.name,
      title: adapter.title() || 'Untitled chat',
      url: location.href,
      exportedAt: new Date().toISOString(),
      messages: msgs
    };
  }

  async function doExport(autoload) {
    const payload = await buildPayload(autoload);
    if (!payload.messages.length) return { ok: false, error: 'no-messages' };
    return chrome.runtime.sendMessage({ type: 'open-export', payload });
  }

  // ---------- "Teach Archiv AI": click one of your messages and one AI reply ----------
  let picking = false;
  function startPick() {
    if (picking) return;
    picking = true;
    const adapter = CV.currentAdapter();
    const host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;left:0;top:0;width:100%;pointer-events:none';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>
      .bar{position:fixed;top:14px;left:50%;transform:translateX(-50%);background:#1c1b2e;color:#fff;font:14px system-ui,sans-serif;padding:12px 16px;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.35);display:flex;gap:12px;align-items:center;pointer-events:auto}
      .bar b{color:#c4b5fd} button{font:inherit;border:0;border-radius:10px;padding:6px 12px;cursor:pointer;background:#6d4aff;color:#fff} button.x{background:#3a3858}
      .box{position:fixed;border:2px solid #8b5cf6;background:rgba(139,92,246,.14);border-radius:6px;pointer-events:none;display:none}
    </style><div class="box"></div><div class="bar"><span id="t"></span><button class="x" id="cancel">Cancel</button></div>`;
    document.documentElement.appendChild(host);
    const box = root.querySelector('.box'), label = root.getElementById ? root.getElementById('t') : root.querySelector('#t');
    let step = 'user', userEl = null;
    const say = (h) => { label.innerHTML = h; };
    say('Click <b>one of YOUR messages</b> in this chat');
    const target = (e) => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && !host.contains(el) ? el : null; };
    const move = (e) => {
      const el = target(e); if (!el) return;
      const r = el.getBoundingClientRect();
      Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    };
    const finish = () => {
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key, true);
      picking = false;
    };
    const key = (e) => { if (e.key === 'Escape') { finish(); host.remove(); } };
    const click = async (e) => {
      if (root.querySelector('.bar').contains(e.composedPath()[0])) return;
      const el = target(e); if (!el) return;
      e.preventDefault(); e.stopPropagation();
      if (step === 'user') {
        userEl = el; step = 'ai';
        say('Now click <b>one AI reply</b>');
        return;
      }
      const userSel = CV.deriveSelector(userEl, el);
      const aiSel = CV.deriveSelector(el, userEl);
      finish();
      if (!userSel || !aiSel) { say('Could not find a pattern. Try clicking the text itself, not the page background.'); setTimeout(() => host.remove(), 4500); return; }
      const { selectorOverrides } = await chrome.storage.sync.get('selectorOverrides');
      const all = selectorOverrides || {};
      all[adapter.id] = { user: userSel, assistant: aiSel };
      await chrome.storage.sync.set({ selectorOverrides: all });
      const n = CV.findMessages(adapter, all).length;
      label.innerHTML = `Saved. Found <b>${n}</b> messages.`;
      const go = document.createElement('button'); go.textContent = 'Export now';
      go.onclick = () => { host.remove(); doExport(true); };
      root.querySelector('.bar').insertBefore(go, root.querySelector('#cancel'));
    };
    root.querySelector('#cancel').onclick = () => { finish(); host.remove(); };
    document.addEventListener('mousemove', move, true);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'pick') { startPick(); sendResponse({ ok: true }); return false; }
    if (msg.type === 'scan') { scan().then(sendResponse); return true; }
    if (msg.type === 'export') {
      doExport(msg.autoload !== false).then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    }
    return false;
  });

  // ---------- small in-page Export button (known sites only, can be switched off) ----------
  async function initFloat() {
    try {
      if (!CV.isKnownSite()) return;
      const { floatBtn } = await chrome.storage.sync.get('floatBtn');
      if (floatBtn === false) return;
      const host = document.createElement('div');
      host.style.cssText = 'all:initial;position:fixed;right:18px;bottom:96px;z-index:2147483646;display:none';
      const root = host.attachShadow({ mode: 'closed' });
      root.innerHTML = `<style>
        button{all:unset;cursor:pointer;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#8b5cf6,#6d4aff);color:#fff;box-shadow:0 8px 24px rgba(109,74,255,.45);font:700 11px system-ui,sans-serif;transition:transform .12s}
        button:hover{transform:scale(1.08)} button:focus-visible{outline:2px solid #fff;outline-offset:2px}
        svg{width:20px;height:20px}
      </style><button title="Export this chat with Archiv AI" aria-label="Export this chat with Archiv AI"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg></button>`;
      root.querySelector('button').onclick = async () => {
        const b = root.querySelector('button'); b.style.opacity = '.6';
        try { await doExport(true); } finally { b.style.opacity = ''; }
      };
      document.documentElement.appendChild(host);
      let timer = null;
      const refresh = async () => {
        timer = null;
        try { const info = await scan(); host.style.display = info.count > 0 ? 'block' : 'none'; } catch { host.style.display = 'none'; }
      };
      new MutationObserver(() => { if (!timer) timer = setTimeout(refresh, 1500); }).observe(document.body, { childList: true, subtree: true });
      refresh();
    } catch { /* extension context gone (reloaded): do nothing */ }
  }
  initFloat();
})();
