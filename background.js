// Service worker. Keeps no state in memory (MV3 workers sleep).
// Content script -> here -> stores payload -> opens export page.
import { sendToTab } from './lib/inject.js';

const MENU_ID = 'archiv-ai-export';
function setupMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: 'Export this chat with Archiv AI', contexts: ['page', 'action'] }, () => void chrome.runtime.lastError);
  });
}

// Pending exports now live in the dashboard Inbox until the user saves, exports or discards them.
chrome.runtime.onInstalled.addListener(() => setupMenus());
chrome.runtime.onStartup.addListener(() => { setupMenus(); dropCombined(); });

// Combined documents are one-off; they never sit in the Inbox.
async function dropCombined() {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith('pending:') && all[k] && all[k].merged);
  if (keys.length) await chrome.storage.local.remove(keys);
}

async function exportTab(tab) {
  if (!tab || tab.id == null) return;
  try { await sendToTab(tab.id, tab.url, { type: 'export' }); }
  catch {
    chrome.action.setBadgeBackgroundColor({ color: '#e11d48' });
    chrome.action.setBadgeText({ text: '!', tabId: tab.id });
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }).catch(() => {}), 3000);
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => { if (info.menuItemId === MENU_ID) exportTab(tab); });

/** One Archiv AI tab only: reuse it if open (any Archiv AI page), otherwise create it. */
async function focusArchivAi(path) {
  const url = chrome.runtime.getURL(path);
  // tab.url is hidden without the "tabs" permission, so find our own pages through getContexts.
  const ctxs = await chrome.runtime.getContexts({ contextTypes: ['TAB'] }).catch(() => []);
  const mine = ctxs.find((c) => c.tabId >= 0 && c.documentUrl && c.documentUrl.startsWith(chrome.runtime.getURL('')));
  if (!mine) return chrome.tabs.create({ url });
  const tab = await chrome.tabs.update(mine.tabId, { active: true, url });
  const hash = url.split('#')[1];
  if (mine.documentUrl.split('#')[0] === url.split('#')[0] && hash) chrome.runtime.sendMessage({ type: 'hash', hash: '#' + hash }).catch(() => {});
  if (tab) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'open-export') {
    const id = crypto.randomUUID();
    chrome.storage.local
      .set({ ['pending:' + id]: { ...msg.payload, receivedAt: Date.now() } })
      .then(() => focusArchivAi(msg.payload.merged ? 'export.html?id=' + id : 'dashboard.html#inbox'))
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true; // async response
  }
  if (msg?.type === 'open-page' && /^[a-z]+\.html(\?[\w=%&.-]*)?(#[\w-]*)?$/.test(msg.path || '')) {
    focusArchivAi(msg.path).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'open-library' || msg?.type === 'open-dashboard') {
    focusArchivAi('dashboard.html' + (msg.hash || '')).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

chrome.commands.onCommand.addListener(async (cmd, tab) => {
  if (cmd !== 'export-full') return;
  const t = tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  exportTab(t);
});
