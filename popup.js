import { sendToTab, isInjectable } from './lib/inject.js';

const $ = (id) => document.getElementById(id);
let tab = null;
let site = null;

const tag = (text, warn) => { const s = document.createElement('span'); s.className = 'tag' + (warn ? ' warn' : ''); s.textContent = text; return s; };

function setIdle(name, msg) {
  $('sname').textContent = name;
  $('stitle').textContent = '';
  $('count').textContent = '–';
  $('tags').replaceChildren();
  $('status').textContent = msg;
  $('avatar').textContent = '?';
}

async function scan() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !isInjectable(tab.url)) {
    setIdle('Nothing to export here', 'Open a chat on ChatGPT, Claude, Gemini, DeepSeek, Grok, Perplexity or any other AI site, then click Archiv again.');
    return;
  }
  let info = null;
  try { info = await sendToTab(tab.id, tab.url, { type: 'scan' }); } catch { /* handled below */ }
  if (!info || !info.supported) {
    setIdle('Cannot read this tab', 'Reload the tab and try again. Some pages (store pages, PDF viewers) block extensions.');
    return;
  }
  site = info.site;
  $('sname').textContent = info.siteName;
  $('stitle').textContent = info.title || 'Untitled chat';
  $('count').textContent = String(info.count);
  $('countLbl').textContent = info.count === 1 ? 'message found' : 'messages found';
  const icon = globalThis.CV && CV.ICONS && CV.ICONS[info.site];
  if (icon) { const im = document.createElement('img'); im.src = icon; im.alt = ''; $('avatar').replaceChildren(im); $('avatar').classList.add('logo'); }
  else $('avatar').textContent = (info.siteName || '?')[0].toUpperCase();
  $('avatar').style.background = icon ? '#fff' : 'rgba(255,255,255,.22)';
  const tags = $('tags'); tags.replaceChildren();
  if (info.auto) tags.append(tag('AUTO-DETECTED'));
  else if (info.generic) tags.append(tag('GENERIC PAGE'));
  if (info.beta) tags.append(tag('BETA', true));
  const status = $('status');
  if (info.count === 0) {
    status.textContent = 'No messages detected. Scroll the chat into view, or click Teach Archiv and pick one of your messages and one reply.';
    $('fix').open = false;
  } else if (info.auto) {
    status.textContent = 'Found by auto-detect. Check the preview. If it looks off, use Teach Archiv.';
  } else if (info.beta) {
    status.textContent = 'This site is new in Archiv. If messages are missing, use Teach Archiv.';
  } else status.textContent = '';
  $('export').disabled = false;
  $('teach').disabled = false;
  const { selectorOverrides } = await chrome.storage.sync.get('selectorOverrides');
  const o = (selectorOverrides || {})[site] || {};
  $('selUser').value = o.user || '';
  $('selAsst').value = o.assistant || '';
}

$('export').onclick = async () => {
  $('export').disabled = true;
  $('export').textContent = 'Reading chat…';
  let res = null;
  try { res = await sendToTab(tab.id, tab.url, { type: 'export', autoload: $('autoload').checked }); } catch { /* shown below */ }
  if (res && res.ok) { window.close(); return; }
  $('export').disabled = false;
  $('export').textContent = 'Export this chat';
  $('status').textContent = res && res.error === 'no-messages'
    ? 'No messages found. Use Teach Archiv, or fix selectors below.'
    : 'Could not read this tab. Reload it and try again.';
};

$('teach').onclick = async () => {
  try { await sendToTab(tab.id, tab.url, { type: 'pick' }); window.close(); }
  catch { $('status').textContent = 'Could not start Teach mode on this tab. Reload it and try again.'; }
};

$('library').onclick = () => { chrome.runtime.sendMessage({ type: 'open-dashboard' }); window.close(); };

$('saveSel').onclick = async () => {
  if (!site) return;
  const { selectorOverrides } = await chrome.storage.sync.get('selectorOverrides');
  const all = selectorOverrides || {};
  all[site] = { user: $('selUser').value.trim() || undefined, assistant: $('selAsst').value.trim() || undefined };
  await chrome.storage.sync.set({ selectorOverrides: all });
  await scan();
};
$('resetSel').onclick = async () => {
  if (!site) return;
  const { selectorOverrides } = await chrome.storage.sync.get('selectorOverrides');
  const all = selectorOverrides || {};
  delete all[site];
  await chrome.storage.sync.set({ selectorOverrides: all });
  await scan();
};

scan().catch(() => setIdle('Something went wrong', 'Reload the tab and open Archiv again.'));
