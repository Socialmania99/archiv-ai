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


  // ---------- token + context meter (works on every page the content script runs on) ----------
  function pageModelText() {
    const out = [document.title];
    try {
      const els = document.querySelectorAll('button,[role="combobox"],[aria-haspopup],[data-testid*="model" i],[class*="model" i],header h1,header h2,header span');
      let n = 0;
      for (const el of els) {
        if (++n > 500) break;
        const t = (el.innerText || el.textContent || '').trim();
        if (t.length >= 2 && t.length <= 48) out.push(t);
      }
    } catch { /* ignore */ }
    return out.join(' | ');
  }

  async function readMeter() {
    const adapter = CV.currentAdapter();
    if (!adapter) return null;
    const overrides = await getOverrides();
    let found = CV.findMessages(adapter, overrides);
    if (!found.length) found = CV.heuristicMessages();
    const msgs = found.map((m) => ({ role: m.role, text: m.el.innerText || m.el.textContent || '' }));
    const cfg = await chrome.storage.sync.get(['meterLimits', 'meterDefault']);
    const userSite = (cfg.meterLimits || {})[adapter.id] || 0;
    const w = CV.resolveWindow({ siteId: adapter.id, modelText: pageModelText(), userSite, userDefault: cfg.meterDefault || 0 });
    return { site: adapter.id, siteName: adapter.name, ...CV.meterStats(msgs, w.window), source: w.source, model: w.label, userSite };
  }

  let meterUI = null;
  function mountMeter() {
    if (meterUI) return meterUI;
    const host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;right:18px;bottom:148px;z-index:2147483645;display:none';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>
      *{box-sizing:border-box} .chip{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:8px;background:#1c1b2e;color:#fff;font:600 12px system-ui,sans-serif;padding:5px 12px 5px 5px;border-radius:99px;box-shadow:0 8px 24px rgba(20,10,60,.35),0 0 0 1px rgba(255,255,255,.12)}
      .chip:focus-visible{outline:2px solid #a78bfa;outline-offset:2px}
      .ring{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--c,#34d399) calc(var(--p,0)*1%),rgba(255,255,255,.18) 0)}
      .ring::after{content:"";width:18px;height:18px;border-radius:50%;background:#1c1b2e}
      .pn{position:absolute;right:0;bottom:44px;width:268px;background:#1c1b2e;color:#fff;border-radius:16px;padding:14px;font:12px/1.45 system-ui,sans-serif;box-shadow:0 16px 48px rgba(20,10,60,.5),0 0 0 1px rgba(255,255,255,.12);display:none}
      .pn.open{display:block} h4{margin:0 0 2px;font-size:11px;letter-spacing:.06em;color:#c4b5fd;text-transform:uppercase}
      .big{font-size:22px;font-weight:800;letter-spacing:-.02em} .big small{font-size:12px;font-weight:600;opacity:.7}
      .bar{height:8px;border-radius:9px;background:rgba(255,255,255,.14);overflow:hidden;margin:8px 0} .bar i{display:block;height:100%;width:0;border-radius:9px;background:var(--c,#34d399);transition:width .4s}
      .r{display:flex;justify-content:space-between;padding:3px 0;opacity:.9} .r b{font-weight:700}
      select{font:inherit;width:100%;margin-top:6px;background:#2a2850;color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:9px;padding:5px 8px}
      .src{opacity:.65;font-size:11px;margin-top:4px} .note{opacity:.55;font-size:10.5px;margin-top:8px}
      .acts{display:flex;gap:6px;margin-top:10px} .acts button{all:unset;cursor:pointer;flex:1;text-align:center;padding:6px;border-radius:9px;background:#2a2850;font-weight:600;font-size:11px} .acts button:hover{background:#3a3768}
      .warn{margin-top:8px;padding:6px 8px;border-radius:9px;background:rgba(248,113,113,.18);color:#fecaca;display:none} .warn.on{display:block}
    </style><div class="pn" id="pn"><h4>Context used</h4><div class="big"><span id="big"></span> <small id="of"></small></div><div class="bar"><i id="fill"></i></div>
      <div class="r"><span>Your messages</span><b id="you"></b></div><div class="r"><span>AI replies</span><b id="ai"></b></div><div class="r"><span>Messages</span><b id="cnt"></b></div><div class="r"><span>Room left</span><b id="left"></b></div>
      <div class="warn" id="warn">Getting full. Start a new chat soon, or summarize this one first.</div>
      <label class="src" id="src" style="display:block"></label><select id="win" aria-label="Context window size"></select>
      <div class="note">Estimate (about ±15%). The AI's own count can differ, and chat apps may cap below the model limit. Pick a size if this one looks wrong.</div>
      <div class="acts"><button id="off">Hide on this site</button><button id="close">Close</button></div></div>
      <button class="chip" id="chip" aria-label="Token and context meter" aria-expanded="false"><span class="ring" id="ring"></span><span id="lbl">…</span></button>`;
    const $ = (id) => root.getElementById ? root.getElementById(id) : root.querySelector('#' + id);
    const sel = $('win');
    CV.WINDOW_CHOICES.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = v ? l + ' tokens' : 'Auto (detect)'; sel.append(o); });
    document.documentElement.appendChild(host);
    const ui = meterUI = { host, root, $, last: null, forced: false };
    const toggle = (open) => { $('pn').classList.toggle('open', open); $('chip').setAttribute('aria-expanded', String(open)); };
    $('chip').onclick = () => toggle(!$('pn').classList.contains('open'));
    $('close').onclick = () => toggle(false);
    sel.onchange = async () => {
      const { meterLimits } = await chrome.storage.sync.get('meterLimits');
      const all = meterLimits || {};
      if (+sel.value) all[ui.last.site] = +sel.value; else delete all[ui.last.site];
      await chrome.storage.sync.set({ meterLimits: all });
      updateMeter();
    };
    $('off').onclick = async () => {
      const { meterOff } = await chrome.storage.sync.get('meterOff');
      const all = meterOff || {}; all[ui.last.site] = true;
      await chrome.storage.sync.set({ meterOff: all });
      host.style.display = 'none'; ui.hidden = true;
    };
    return ui;
  }

  async function updateMeter() {
    const ui = meterUI; if (!ui) return;
    let d = null;
    try { d = await readMeter(); } catch { return; }
    if (!d || !d.count) { ui.host.style.display = 'none'; return; }
    ui.last = d; ui.host.style.display = 'block';
    const c = { green: '#34d399', amber: '#fbbf24', red: '#f87171' }[d.level];
    ui.host.style.setProperty('--c', c);
    const r = ui.root, $ = ui.$, K = CV.compactNum;
    $('ring').style.cssText = `--p:${Math.min(100, d.pct)};--c:${c}`;
    $('fill').style.cssText = `width:${Math.min(100, d.pct)}%;--c:${c}`;
    $('lbl').textContent = `${K(d.total)} / ${K(d.window)}`;
    $('big').textContent = '~' + K(d.total); $('of').textContent = `of ${K(d.window)} tokens · ${d.pct < 1 ? '<1' : Math.round(d.pct)}%`;
    $('you').textContent = '~' + K(d.you); $('ai').textContent = '~' + K(d.ai); $('cnt').textContent = d.count;
    $('left').textContent = `~${K(d.left)} (about ${d.turnsLeft} more ${d.turnsLeft === 1 ? 'exchange' : 'exchanges'})`;
    $('warn').classList.toggle('on', d.level !== 'green');
    $('src').textContent = d.source + (d.model ? ': ' + d.model : '') + ` · ${K(d.window)}`;
    const wsel = $('win');
    [...wsel.options].forEach((o) => { if (o.dataset.custom) o.remove(); });
    if (d.userSite && !CV.WINDOW_CHOICES.some((x) => x[0] === d.userSite)) { const o = document.createElement('option'); o.value = d.userSite; o.dataset.custom = '1'; o.textContent = K(d.userSite) + ' tokens (custom)'; wsel.append(o); }
    wsel.value = String(d.userSite || 0);
  }

  let meterTimer = null, meterWatching = false;
  function watchMeter() {
    if (meterWatching) return; meterWatching = true;
    const kick = () => { if (!meterTimer) meterTimer = setTimeout(() => { meterTimer = null; if (!document.hidden && meterUI && !meterUI.hidden) updateMeter(); }, 2000); };
    new MutationObserver(kick).observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener('visibilitychange', kick);
  }
  /** Show the meter on this page now (any site). */
  async function showMeter() {
    const ui = mountMeter(); ui.hidden = false; watchMeter();
    const { meterOff } = await chrome.storage.sync.get('meterOff');
    const a = CV.currentAdapter();
    if (meterOff && a && meterOff[a.id]) { delete meterOff[a.id]; await chrome.storage.sync.set({ meterOff }); }
    await updateMeter();
    return { ok: !!ui.last };
  }
  async function initMeter() {
    try {
      if (!CV.isKnownSite()) return;                       // other pages: on demand from the popup
      const cfg = await chrome.storage.sync.get(['meter', 'meterOff']);
      const a = CV.currentAdapter();
      if (cfg.meter === false || (cfg.meterOff || {})[a.id]) return;
      mountMeter(); watchMeter(); updateMeter();
      chrome.storage.onChanged.addListener((ch) => { if (ch.meter && ch.meter.newValue === false && meterUI) meterUI.host.style.display = 'none'; });
    } catch { /* extension context gone */ }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'pick') { startPick(); sendResponse({ ok: true }); return false; }
    if (msg.type === 'scan') { scan().then(sendResponse); return true; }
    if (msg.type === 'meter') { readMeter().then(sendResponse).catch(() => sendResponse(null)); return true; }
    if (msg.type === 'meter-show') { showMeter().then(sendResponse).catch(() => sendResponse({ ok: false })); return true; }
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
        button{all:unset;cursor:pointer;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#6d4aff;box-shadow:0 8px 24px rgba(109,74,255,.45),0 0 0 1px rgba(109,74,255,.18);font:700 11px system-ui,sans-serif;transition:transform .12s}
        button:hover{transform:scale(1.08)} button:focus-visible{outline:2px solid #fff;outline-offset:2px}
        img{width:28px;height:28px;object-fit:contain;display:block}
      </style><button title="Export this chat with Archiv AI" aria-label="Export this chat with Archiv AI"><img alt="" src="data:image/png;base64,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"></button>`;
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
  initMeter();
})();
