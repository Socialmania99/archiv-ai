// Obsidian notes: Markdown + YAML frontmatter, roles as callouts (or headings).
// Delivery: .md download, or obsidian://new with the note placed on the clipboard.
import { roleName } from './render.js';

const yamlStr = (s) => JSON.stringify(String(s == null ? '' : s));

/** Obsidian tag: no spaces, only letters, digits, _ - /, not purely numeric. */
export function obsidianTag(t) {
  const s = String(t).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_\-/]/gu, '').replace(/^[-/]+|[-/]+$/g, '');
  return s && !/^\d+$/.test(s) ? s : '';
}

/** Characters Obsidian refuses in note names: \ / : * ? " < > | # ^ [ ] */
export function safeNoteName(s, max = 100) {
  return String(s).replace(/[\\/:*?"<>|#^[\]\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, max).trim() || 'Chat';
}
export function safeFolder(s) {
  const bad = /[\\/:*?"<>|#^[\]\x00-\x1f]/g;
  return String(s || '').split(/[\\/]+/).map((p) => p.replace(bad, '').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 60).trim()).filter(Boolean).join('/');
}

export function toObsidianDoc(conv, msgs, { style = 'callouts', tags = [], extraTags = [] } = {}) {
  const tagList = [...new Set(['ai-chat', obsidianTag(conv.site || conv.siteName), ...tags.map(obsidianTag), ...extraTags.map(obsidianTag)].filter(Boolean))];
  const real = msgs.filter((m) => m.role !== 'section');
  const url = /^https?:\/\//i.test(conv.url || '') ? conv.url : '';
  const fm = ['---', `title: ${yamlStr(conv.title)}`, `site: ${yamlStr(conv.siteName)}`];
  if (url) fm.push(`source: ${yamlStr(url)}`);
  fm.push(`exported: ${String(conv.exportedAt || '').slice(0, 10)}`, `messages: ${real.length}`, 'tags:', ...tagList.map((t) => `  - ${t}`), '---', '');
  const out = [...fm, '# ' + conv.title, ''];
  for (const m of msgs) {
    if (m.role === 'section') { out.push('## ' + m.markdown, ''); continue; }
    const name = roleName(m.role, conv, m);
    if (style === 'headings') { out.push('### ' + name, '', m.markdown, ''); continue; }
    const kind = m.role === 'user' ? 'question' : 'note';
    out.push(`> [!${kind}] ${name}`, ...m.markdown.split('\n').map((l) => '> ' + l).map((l) => l.replace(/\s+$/, '')), '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** obsidian://new?... that creates the note from the clipboard. */
export function obsidianUri({ vault = '', folder = '', name }) {
  const dir = safeFolder(folder);
  const file = (dir ? dir + '/' : '') + safeNoteName(name);
  const q = [];
  if (vault.trim()) q.push('vault=' + encodeURIComponent(vault.trim()));
  q.push('file=' + encodeURIComponent(file), 'clipboard');
  return 'obsidian://new?' + q.join('&');
}
