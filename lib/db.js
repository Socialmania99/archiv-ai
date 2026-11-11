// IndexedDB library of saved chats. Everything stays on this device.
const DB_NAME = 'archiv-ai';
const LEGACY_DBS = ['archiv', 'cairn'];   // names used before the renames
const STORE = 'chats';

function openRaw(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      const s = db.createObjectStore(STORE, { keyPath: 'id' });
      s.createIndex('savedAt', 'savedAt');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// One-time copy of chats saved under an older name ("archiv", "cairn"), then the old database is removed.
let migration = null;
async function copyFrom(legacy, names) {
  if (!names.includes(legacy)) return;
  const old = await openRaw(legacy);
  const rows = await new Promise((res, rej) => {
    const r = old.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  old.close();
  const fresh = await openRaw(DB_NAME);
  await new Promise((res, rej) => {
    const t = fresh.transaction(STORE, 'readwrite');
    const s = t.objectStore(STORE);
    rows.forEach((row) => s.put(row));   // put: keeps existing rows if run twice
    t.oncomplete = res; t.onerror = () => rej(t.error);
  });
  fresh.close();
  await new Promise((res) => { const r = indexedDB.deleteDatabase(legacy); r.onsuccess = r.onerror = r.onblocked = res; });
}
function migrateLegacy() {
  if (!migration) {
    migration = (async () => {
      try {
        if (!indexedDB.databases) return;
        const names = (await indexedDB.databases()).map((d) => d.name);
        for (const legacy of LEGACY_DBS) await copyFrom(legacy, names);
      } catch { /* migration is best-effort: never block saving or reading */ }
    })();
  }
  return migration;
}

async function open() {
  await migrateLegacy();
  return openRaw(DB_NAME);
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(store)).then((r) => { result = r; });
    t.oncomplete = () => { db.close(); resolve(result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export function makeSearchText(chat) {
  return (chat.title + '\n' + chat.messages.map((m) => m.markdown).join('\n')).toLowerCase();
}

export async function saveChat(chat) {
  const rec = { ...chat, id: chat.id || crypto.randomUUID(), savedAt: chat.savedAt || Date.now(), tags: chat.tags || [], folder: chat.folder || '' };
  rec.searchText = makeSearchText(rec);
  await tx('readwrite', (s) => wrap(s.put(rec)));
  return rec;
}
export const getAll = () => tx('readonly', (s) => wrap(s.getAll())).then((a) => a.sort((x, y) => y.savedAt - x.savedAt));
export const getChat = (id) => tx('readonly', (s) => wrap(s.get(id)));
export const deleteChat = (id) => tx('readwrite', (s) => wrap(s.delete(id)));
export const clearAll = () => tx('readwrite', (s) => wrap(s.clear()));

// ---- duplicate-aware saving ----
import { chatKey, mergeInto } from './identity.js';
import { suggestTags, mergeTags } from './topics.js';

/**
 * Save an exported chat. If the same chat (same key) is already stored:
 *   same content   -> replace silently (refresh savedAt)
 *   new messages   -> keep original, append new ones flagged `updated`
 *   diverged       -> replace content, keep tags/folder
 * Returns { rec, status: 'new'|'same'|'updated'|'replaced', added }.
 */
export async function saveOrMerge(chat, extra = {}) {
  const key = chatKey(chat);
  const all = await getAll();
  const hit = all.find((r) => (r.key || chatKey(r)) === key);
  const tags = mergeTags(chat.tags || [], extra.tags || [], suggestTags(chat));
  if (!hit) {
    const rec = await saveChat({ ...chat, key, tags, folder: extra.folder || chat.folder || '' });
    return { rec, status: 'new', added: 0 };
  }
  const res = mergeInto(hit, chat);
  const merged = { ...res.rec, key, tags: mergeTags(hit.tags, tags), folder: extra.folder || hit.folder };
  const rec = await saveChat(merged);
  return { rec, status: res.kind === 'same' ? 'same' : res.kind, added: res.added };
}
