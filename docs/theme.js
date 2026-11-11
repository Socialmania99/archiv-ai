// Light / dark switcher shared by every Archiv AI page. Classic script, loaded in <head>
// so the theme is applied before first paint.
(function () {
  const KEY = 'archivAiUi';
  const OLD_KEY = 'archivUi'; // key used before the rename to Archiv AI
  const root = document.documentElement;
  const sys = () => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const resolved = () => root.dataset.ui || sys();
  let pref = 'auto';
  try { pref = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY) || 'auto'; } catch { /* storage blocked */ }
  function apply(p) {
    pref = p === 'light' || p === 'dark' ? p : 'auto';
    root.dataset.ui = pref === 'auto' ? sys() : pref;
    root.style.colorScheme = root.dataset.ui;
    root.dataset.theme = root.dataset.ui; // lets stylesheets that key off data-theme (the website) follow too
    document.querySelectorAll('[data-theme-toggle] input').forEach((i) => {
      i.checked = root.dataset.ui === 'dark';
      i.title = i.checked ? 'Switch to light mode' : 'Switch to dark mode';
    });
  }
  function save(p) {
    try { localStorage.setItem(KEY, p); } catch { /* ignore */ }
    try { chrome.storage.local.set({ [KEY]: p }); } catch { /* not an extension page */ }
  }
  apply(pref);
  try {
    chrome.storage.local.get(KEY).then((r) => { if (r[KEY] && r[KEY] !== pref) { apply(r[KEY]); try { localStorage.setItem(KEY, r[KEY]); } catch { /* ignore */ } } }).catch(() => {});
    chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && c[KEY] && c[KEY].newValue !== pref) apply(c[KEY].newValue); });
  } catch { /* ignore */ }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (pref === 'auto') apply('auto'); });

  // Neumorphic switch (switch.css): inset track with sun and moon, a coloured knob that slides between them.
  const SUN_P = '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>';
  const MOON_P = '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/><path d="M17.5 3.5v3M16 5h3M20.5 8.5v2.4M19.3 9.7h2.4" stroke-width="1.4"/>';
  const svg = (c, p) => '<svg class="' + c + '" viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>';
  const switchHtml = () => '<label class="tsw"><input type="checkbox" role="switch" aria-label="Dark mode">'
    + svg('ic sun', SUN_P) + svg('ic moon', MOON_P)
    + '<span class="knob">' + svg('k-sun', SUN_P) + svg('k-moon', MOON_P) + '</span></label>';
  function mount() {
    document.querySelectorAll('[data-theme-toggle]').forEach((h) => {
      if (h.dataset.mounted) return;
      h.dataset.mounted = '1';
      h.classList.add('tsw-host');
      h.innerHTML = switchHtml();
      const input = h.querySelector('input');
      input.onchange = () => { const next = input.checked ? 'dark' : 'light'; apply(next); save(next); };
    });
    apply(pref);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.ArchivAiTheme = { apply, mount };
})();
