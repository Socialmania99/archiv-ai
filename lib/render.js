// Conversation -> Markdown / TXT / JSON / HTML. Pure functions, no DOM needed.
import { parseBlocks, blocksToText } from './markdown.js';

export const FONTS = {
  'Segoe UI': "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif",
  Calibri: "Calibri, 'Segoe UI', sans-serif",
  Arial: 'Arial, Helvetica, sans-serif',
  Georgia: "Georgia, 'Times New Roman', serif",
  'Times New Roman': "'Times New Roman', Times, serif",
  Verdana: 'Verdana, Geneva, sans-serif'
};

export const THEMES = {
  light:  { label: 'Light',  bg: '#ffffff', fg: '#1f2328', muted: '#6b7280', line: '#e5e7eb', code: '#f6f8fa', inline: '#f3f4f6', user: '#4f46e5', ai: '#10b981', link: '#2563eb' },
  dark:   { label: 'Dark',   bg: '#0f1117', fg: '#e6e8ee', muted: '#9aa3b2', line: '#2a2f3a', code: '#171b24', inline: '#1d2230', user: '#818cf8', ai: '#34d399', link: '#8ab4ff' },
  sepia:  { label: 'Sepia',  bg: '#f5ecd9', fg: '#433422', muted: '#8a7650', line: '#dccdb0', code: '#ece0c4', inline: '#e8dcc0', user: '#9a5b13', ai: '#4d7c0f', link: '#8a4b08' },
  sakura: { label: 'Sakura', bg: '#fff5f8', fg: '#3b2230', muted: '#a0708a', line: '#f3cfdb', code: '#ffe9f0', inline: '#ffe2ec', user: '#d6457a', ai: '#9d4edd', link: '#c2185b' }
};

export const DEFAULT_STYLE = { font: 'Segoe UI', size: 11, color: '#1f2328', page: 'A4', header: true, theme: 'light' };

/** Resolve palette. Custom text colour only applies to the light theme. */
export function palette(style = DEFAULT_STYLE) {
  const t = { ...(THEMES[style.theme] || THEMES.light) };
  if ((style.theme || 'light') === 'light' && /^#[0-9a-f]{6}$/i.test(style.color || '')) t.fg = style.color;
  return t;
}

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const safeUrl = (u) => (/^(https?:|mailto:)/i.test(u) ? u : '');
const safeImg = (u) => (/^https?:/i.test(u) || /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(u) ? u : '');

export function roleName(role, conv, m) { return role === 'section' ? '' : role === 'user' ? 'You' : ((m && m.siteName) || conv.siteName || 'AI'); }

/** keep = 'both' | 'assistant' | 'user' ; selected = Set of message indexes or null (all) */
export function pickMessages(conv, keep = 'both', selected = null) {
  return conv.messages.filter((m) => (m.role === 'section' || keep === 'both' || m.role === keep) && (!selected || selected.has(m.i)));
}

export function toMarkdownDoc(conv, msgs, style = DEFAULT_STYLE) {
  const lines = ['# ' + conv.title, ''];
  if (style.header) lines.push(`> Exported from ${conv.siteName} on ${conv.exportedAt.slice(0, 10)}${conv.url ? ' · ' + conv.url : ''}`, '');
  for (const m of msgs) {
    if (m.role === 'section') lines.push('# ' + m.markdown, '');
    else lines.push('## ' + roleName(m.role, conv, m), '', m.markdown, '');
  }
  return lines.join('\n').trim() + '\n';
}

export function toTextDoc(conv, msgs, style = DEFAULT_STYLE) {
  const lines = [conv.title, '='.repeat(Math.min(conv.title.length, 60))];
  if (style.header) lines.push(`Exported from ${conv.siteName} on ${conv.exportedAt.slice(0, 10)}`);
  lines.push('');
  for (const m of msgs) {
    if (m.role === 'section') lines.push('', m.markdown.toUpperCase(), '-'.repeat(Math.min(m.markdown.length, 60)), '');
    else lines.push(roleName(m.role, conv, m).toUpperCase() + ':', blocksToText(parseBlocks(m.markdown)), '');
  }
  return lines.join('\n').trim() + '\n';
}

export function toJsonDoc(conv, msgs) {
  return JSON.stringify({
    title: conv.title, site: conv.site, url: conv.url, exportedAt: conv.exportedAt,
    messages: msgs.map((m) => ({ role: m.role, markdown: m.markdown }))
  }, null, 2);
}

// ---------- HTML ----------
export function inlineHtml(inl) {
  return inl.map((r) => {
    if (r.t === 'br') return '<br>';
    if (r.t === 'img') { const s = safeImg(r.src); return s ? `<img src="${esc(s)}" alt="${esc(r.alt)}">` : `[${esc(r.alt || 'image')}]`; }
    let h = esc(r.s);
    if (r.code) h = `<code>${h}</code>`;
    if (r.b) h = `<strong>${h}</strong>`;
    if (r.i) h = `<em>${h}</em>`;
    if (r.href) { const u = safeUrl(r.href); if (u) h = `<a href="${esc(u)}" rel="noopener noreferrer">${h}</a>`; }
    return h;
  }).join('');
}

export function blocksHtml(blocks) {
  return blocks.map((b) => {
    switch (b.t) {
      case 'h': return `<h${Math.min(b.level + 2, 6)}>${inlineHtml(b.inl)}</h${Math.min(b.level + 2, 6)}>`;
      case 'p': return `<p>${inlineHtml(b.inl)}</p>`;
      case 'hr': return '<hr>';
      case 'code': return `<pre><code>${esc(b.text)}</code></pre>`;
      case 'quote': return `<blockquote>${blocksHtml(b.blocks)}</blockquote>`;
      case 'ul': case 'ol': return `<${b.t}>${b.items.map((it) => `<li>${blocksHtml(it.blocks)}</li>`).join('')}</${b.t}>`;
      case 'table':
        return `<table><thead><tr>${b.head.map((c) => `<th>${inlineHtml(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inlineHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      default: return '';
    }
  }).join('\n');
}

export function conversationBodyHtml(conv, msgs, style = DEFAULT_STYLE) {
  const head = `<h1>${esc(conv.title)}</h1>` + (style.header
    ? `<p class="meta">Exported from ${esc(conv.siteName)} on ${esc(conv.exportedAt.slice(0, 10))}${safeUrl(conv.url || '') ? ` · <a href="${esc(conv.url)}">${esc(conv.url)}</a>` : ''}</p>`
    : '');
  const body = msgs.map((m) => m.role === 'section' ? `<h2 class="docsec">${esc(m.markdown)}</h2>` : `<section class="msg ${m.role}"><div class="role">${esc(roleName(m.role, conv, m))}</div>${blocksHtml(parseBlocks(m.markdown))}</section>`).join('\n');
  return head + body;
}

export function styleCss(style = DEFAULT_STYLE, bleed = false) {
  const stack = FONTS[style.font] || FONTS['Segoe UI'];
  const page = style.page === 'Letter' ? 'Letter' : 'A4';
  const p = palette(style);
  return `
@page { size: ${page}; margin: ${bleed ? '0' : '18mm'}; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html { background: ${p.bg}; }
body { font-family: ${stack}; font-size: ${Number(style.size) || 11}pt; color: ${p.fg}; background: ${p.bg}; line-height: 1.55; margin: 0 auto; max-width: 820px; padding: 24px; }
h1 { font-size: 1.7em; margin: 0 0 .2em; } .meta { color: ${p.muted}; font-size: .85em; margin: 0 0 1.4em; }
h2.docsec { font-size: 1.35em; margin: 1.6em 0 .6em; padding-bottom: .25em; border-bottom: 2px solid ${p.user}; }
h3,h4,h5,h6 { margin: 1em 0 .4em; line-height: 1.25; }
.msg { margin: 0 0 1.1em; padding: .1em 0 .1em 1em; border-left: 3px solid ${p.line}; break-inside: auto; }
.msg.user { border-left-color: ${p.user}; } .msg.assistant { border-left-color: ${p.ai}; }
.role { font-weight: 700; font-size: .8em; letter-spacing: .04em; text-transform: uppercase; color: ${p.muted}; margin-bottom: .25em; }
p { margin: .5em 0; } ul, ol { margin: .4em 0; padding-left: 1.5em; }
code { font-family: Consolas, 'SFMono-Regular', Menlo, monospace; font-size: .9em; background: ${p.inline}; padding: .1em .3em; border-radius: 3px; }
pre { background: ${p.code}; border: 1px solid ${p.line}; border-radius: 6px; padding: .7em .9em; overflow-x: auto; white-space: pre-wrap; word-break: break-word; break-inside: avoid; }
pre code { background: none; padding: 0; }
blockquote { margin: .6em 0; padding: .1em 1em; border-left: 3px solid ${p.muted}; color: ${p.muted}; }
table { border-collapse: collapse; margin: .6em 0; width: 100%; break-inside: avoid; } th, td { border: 1px solid ${p.line}; padding: .35em .6em; text-align: left; vertical-align: top; } th { background: ${p.inline}; }
img { max-width: 100%; } a { color: ${p.link}; } hr { border: 0; border-top: 1px solid ${p.line}; margin: 1em 0; }
@media print { body { padding: ${bleed ? '0 18mm' : '0'}; max-width: none; } a { text-decoration: none; } }
table.pg { width: 100%; margin: 0; border-collapse: collapse; break-inside: auto; }
table.pg > thead > tr > td, table.pg > tbody > tr > td, table.pg > tfoot > tr > td { padding: 0; border: 0; background: none; }
.sp { display: none; }
@media print { .sp { display: block; height: 18mm; } }`;
}

const LOGO = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='%236d4aff'/><path d='M6 8h12v3H6zM7 11h10v6a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z' fill='white'/></svg>";
const cssStr = (t, n) => String(t).replace(/[\\"\n\r{}<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
/** Branded PDF page furniture: logo + name top-left, source top-right, "Page n of N" bottom. Needs margin boxes (Chrome 131+). */
export function brandCss(conv) {
  const font = "9pt 'Segoe UI', system-ui, sans-serif";
  return `@page { @top-left { content: url("data:image/svg+xml,${LOGO}"); vertical-align: middle; width: 16px; }
  @top-center { content: "Archiv"; font: 700 ${font}; color: #6d4aff; }
  @top-right { content: "${cssStr(conv.siteName, 40)} · ${cssStr(conv.title, 50)}"; font: ${font}; color: #8a88a6; }
  @bottom-center { content: "Page " counter(page) " of " counter(pages); font: ${font}; color: #8a88a6; } }`;
}

export function toHtmlDoc(conv, msgs, style = DEFAULT_STYLE) {
  const bleed = (style.theme || 'light') !== 'light';
  const content = conversationBodyHtml(conv, msgs, style);
  // Coloured themes: page margin 0 so the background reaches the paper edge; a
  // repeating header/footer spacer row restores the margins on every page.
  const body = bleed
    ? `<table class="pg"><thead><tr><td><div class="sp"></div></td></tr></thead><tbody><tr><td>${content}</td></tr></tbody><tfoot><tr><td><div class="sp"></div></td></tr></tfoot></table>`
    : content;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(conv.title)}</title><style>${styleCss(style, bleed)}${style.brand && !bleed ? brandCss(conv) : ''}</style></head>
<body>${body}</body></html>`;
}

export function safeFilename(s, max = 80) {
  return String(s).replace(/[\\/:*?"<>|\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) || 'chat';
}

export function makeFilename(template, conv, ext) {
  const name = (template || '{site} - {title} - {date}')
    .replace('{site}', conv.siteName).replace('{title}', conv.title).replace('{date}', conv.exportedAt.slice(0, 10));
  return safeFilename(name) + '.' + ext;
}

export function stats(msgsAll) {
  const msgs = msgsAll.filter((m) => m.role !== 'section');
  const text = msgs.map((m) => m.markdown).join(' ');
  const words = (text.match(/\S+/g) || []).length;
  return { messages: msgs.length, words, tokens: Math.ceil(text.length / 4) };
}
