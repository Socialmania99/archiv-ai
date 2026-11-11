// Brand tile for an AI tool: bundled logo on a white tile when we have one, else a coloured letter.
// Needs content/adapters.js (CV.colorFor) and content/icon-map.js (CV.ICONS) loaded as classic scripts.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function iconPath(id) { return (globalThis.CV && CV.ICONS && CV.ICONS[id]) || ''; }

export function avatarHtml(id, name, px = 28) {
  const p = iconPath(id), st = `width:${px}px;height:${px}px;font-size:${Math.round(px * 0.45)}px`;
  if (p) return `<span class="av logo" style="${st}"><img src="${esc(p)}" alt="" loading="lazy"></span>`;
  const color = (globalThis.CV && CV.colorFor) ? CV.colorFor(id) : '#6d4aff';
  return `<span class="av" style="${st};background:${esc(color)}">${esc((name || id || '?')[0].toUpperCase())}</span>`;
}
