// Make sure the Archiv AI content script is running in a tab. Sites in the registry
// get it automatically; every other http(s) page gets it on demand through
// activeTab, so no broad host permission is needed.
export const CONTENT_FILES = ['content/registry.js', 'content/adapters.js', 'content/md.js', 'content/content.js'];

export function isInjectable(url) {
  return /^https?:\/\//i.test(url || '') && !/^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i.test(url);
}

/** Send `msg` to the tab's content script, injecting it first if nobody answers. */
export async function sendToTab(tabId, url, msg) {
  try { return await chrome.tabs.sendMessage(tabId, msg); } catch { /* not there yet */ }
  if (!isInjectable(url)) throw new Error('not-injectable');
  await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
  return chrome.tabs.sendMessage(tabId, msg);
}
