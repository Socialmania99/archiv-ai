// Notion connection settings. storage.local only: the token must never reach sync.
import { NOTION_ORIGIN } from './notion.js';

const KEY = 'notionCfg';
export async function getNotion() {
  const r = await chrome.storage.local.get(KEY);
  const c = r[KEY];
  return c && c.token && c.parentId ? c : null;
}
export const setNotion = (cfg) => chrome.storage.local.set({ [KEY]: cfg });
export const clearNotion = () => chrome.storage.local.remove(KEY);

/** Must run inside a user click: the browser shows its own permission prompt. */
export async function ensureNotionAccess() {
  const q = { origins: [NOTION_ORIGIN] };
  if (await chrome.permissions.contains(q)) return true;
  return chrome.permissions.request(q);
}
export const revokeNotionAccess = () => chrome.permissions.remove({ origins: [NOTION_ORIGIN] });
