// Same-chat detection and merge. Pure functions, no storage access.

/** FNV-1a 32-bit hash of a string, as 8 hex chars. */
export function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Fingerprint of one message: role + normalised text. */
export function msgPrint(m) { return fnv(m.role + '|' + norm(m.markdown)); }

/** Stable key for a chat: site + URL without query/hash. Falls back to site + title. */
export function chatKey(c) {
  let path = '';
  try { const u = new URL(c.url); path = u.origin + u.pathname.replace(/\/+$/, ''); } catch { /* no url */ }
  const generic = !path || /^https?:\/\/[^/]+$/.test(path);   // home page of a site: not a chat id
  return c.site + '|' + (generic ? 't:' + norm(c.title) : path);
}

/**
 * Compare an incoming chat with a saved one.
 * 'same'    – identical messages
 * 'updated' – saved messages are a prefix/subset of incoming (new messages added)
 * 'changed' – same key but content diverges (edited / regenerated)
 */
export function compareChats(saved, incoming) {
  const a = saved.messages.map(msgPrint), b = incoming.messages.map(msgPrint);
  if (a.length === b.length && a.every((x, i) => x === b[i])) return { kind: 'same', added: [] };
  const seen = new Set(a);
  const added = incoming.messages.filter((m, i) => !seen.has(b[i]));
  const savedSet = new Set(b);
  const allKept = a.every((x) => savedSet.has(x));
  if (allKept && added.length) return { kind: 'updated', added };
  return { kind: 'changed', added };
}

/** Merge new messages into the saved record; they are flagged `updated` with a timestamp. */
export function mergeInto(saved, incoming, now = Date.now()) {
  const cmp = compareChats(saved, incoming);
  if (cmp.kind === 'same') return { rec: saved, kind: 'same', added: 0 };
  if (cmp.kind === 'changed') return { rec: { ...saved, ...incoming, id: saved.id, tags: saved.tags, folder: saved.folder, savedAt: now, key: saved.key, updatedAt: now, updatedCount: 0, messages: incoming.messages.map((m, i) => ({ ...m, i })) }, kind: 'replaced', added: 0 };
  const messages = incoming.messages.map((m) => {
    const old = saved.messages.find((s) => msgPrint(s) === msgPrint(m));
    if (old) return old;
    return { ...m, updated: true, addedAt: now };
  }).map((m, i) => ({ ...m, i }));
  return { rec: { ...saved, title: incoming.title || saved.title, messages, updatedAt: now, updatedCount: (saved.updatedCount || 0) + cmp.added.length, savedAt: now }, kind: 'updated', added: cmp.added.length };
}
