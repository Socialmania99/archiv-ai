// Find-in-chat: pure functions, no DOM. Used by the library preview.
import { esc } from './render.js';

const MAX = 5000;
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** messages: [{markdown}] -> { total, byMsg: Map<msgIndex, [{start,end,n}]> }  (n = global match number) */
export function findInChat(messages, query, { caseSensitive = false } = {}) {
  const byMsg = new Map();
  const q = String(query || '');
  if (!q.trim()) return { total: 0, byMsg };
  let re;
  try { re = new RegExp(escRe(q), caseSensitive ? 'gu' : 'giu'); } catch { return { total: 0, byMsg }; }
  let n = 0;
  for (let i = 0; i < messages.length && n < MAX; i++) {
    const text = String(messages[i].markdown || '');
    const hits = [];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) && n < MAX) {
      if (!m[0].length) { re.lastIndex++; continue; }
      hits.push({ start: m.index, end: m.index + m[0].length, n: n++ });
    }
    if (hits.length) byMsg.set(i, hits);
  }
  return { total: n, byMsg };
}

/** Escaped HTML for `text` with <mark> around each range; the range with n === cur gets class "cur". */
export function highlightHtml(text, ranges, cur = -1) {
  if (!ranges || !ranges.length) return esc(text);
  let out = '', at = 0;
  for (const r of ranges) {
    out += esc(text.slice(at, r.start)) + `<mark${r.n === cur ? ' class="cur"' : ''}>` + esc(text.slice(r.start, r.end)) + '</mark>';
    at = r.end;
  }
  return out + esc(text.slice(at));
}

/** Wrap-around stepping through matches. */
export const stepMatch = (cur, total, dir) => (total ? (cur + dir + total) % total : 0);
