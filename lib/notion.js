// Send a conversation to Notion with an internal-integration token.
// No OAuth server needed: the user creates an integration, shares one page with it,
// and pastes the token + page link. The token stays in storage.local (never synced).
import { parseBlocks } from './markdown.js';
import { roleName } from './render.js';

export const NOTION_ORIGIN = 'https://api.notion.com/*';
const API = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';
const MAX_TEXT = 2000, MAX_CHILDREN = 100, MAX_DEPTH = 2;

/** Accepts a Notion page URL or a raw id. Returns a dashed UUID or null. */
export function parsePageId(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  const m = s.replace(/-/g, '').match(/([0-9a-f]{32})(?![0-9a-f])/i);
  if (!m) return null;
  const h = m[1].toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const LANGS = new Set(['abap', 'arduino', 'bash', 'basic', 'c', 'clojure', 'coffeescript', 'c++', 'c#', 'css', 'dart', 'diff', 'docker', 'elixir', 'elm', 'erlang', 'flow', 'fortran', 'f#', 'gherkin', 'glsl', 'go', 'graphql', 'groovy', 'haskell', 'html', 'java', 'javascript', 'json', 'julia', 'kotlin', 'latex', 'less', 'lisp', 'livescript', 'lua', 'makefile', 'markdown', 'markup', 'matlab', 'mermaid', 'nix', 'objective-c', 'ocaml', 'pascal', 'perl', 'php', 'plain text', 'powershell', 'prolog', 'protobuf', 'python', 'r', 'reason', 'ruby', 'rust', 'sass', 'scala', 'scheme', 'scss', 'shell', 'sql', 'swift', 'typescript', 'vb.net', 'verilog', 'vhdl', 'visual basic', 'webassembly', 'xml', 'yaml']);
const LANG_ALIAS = { js: 'javascript', jsx: 'javascript', mjs: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', python3: 'python', sh: 'shell', zsh: 'shell', console: 'shell', yml: 'yaml', cpp: 'c++', cc: 'c++', cs: 'c#', csharp: 'c#', fsharp: 'f#', rb: 'ruby', rs: 'rust', golang: 'go', kt: 'kotlin', md: 'markdown', tex: 'latex', objc: 'objective-c', dockerfile: 'docker', ps1: 'powershell', text: 'plain text', txt: 'plain text', plaintext: 'plain text', '': 'plain text' };
export function notionLang(l) {
  const k = String(l || '').toLowerCase();
  const v = LANG_ALIAS[k] || k;
  return LANGS.has(v) ? v : 'plain text';
}

const goodUrl = (u) => {
  if (!/^(https?:|mailto:)/i.test(u || '')) return null;
  try { new URL(u); return u; } catch { return null; }
};
const isImgUrl = (u) => /^https?:\/\//i.test(u || '') && u.length < 1900;

function chunkText(s) {
  const out = [];
  for (let i = 0; i < s.length; i += MAX_TEXT) out.push(s.slice(i, i + MAX_TEXT));
  return out.length ? out : [''];
}

/** inline AST -> Notion rich_text. Images become their alt text (standalone images are handled by the caller). */
export function richText(inl, plain = false) {
  const out = [];
  for (const r of inl) {
    if (r.t === 'br') { out.push({ type: 'text', text: { content: '\n' } }); continue; }
    const s = r.t === 'img' ? (r.alt ? `[${r.alt}]` : '[image]') : r.s;
    if (!s) continue;
    const ann = {};
    if (!plain) { if (r.b) ann.bold = true; if (r.i) ann.italic = true; if (r.code) ann.code = true; }
    const link = !plain && r.href ? goodUrl(r.href) : null;
    for (const piece of chunkText(s)) {
      const o = { type: 'text', text: { content: piece } };
      if (link) o.text.link = { url: link };
      if (Object.keys(ann).length) o.annotations = ann;
      out.push(o);
    }
  }
  if (out.length > MAX_CHILDREN) return richText(inl, true).slice(0, MAX_CHILDREN);
  return out;
}

const plainRich = (s) => chunkText(String(s)).map((c) => ({ type: 'text', text: { content: c } }));
const para = (rt) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: rt } });

/** Splits oversized child lists: first 100 stay as children, the rest become siblings. */
function withChildren(block, kids, depth, out) {
  const type = block.type;
  if (kids.length && depth < MAX_DEPTH) {
    block[type].children = kids.slice(0, MAX_CHILDREN);
    out.push(block);
    out.push(...kids.slice(MAX_CHILDREN));
  } else {
    out.push(block, ...kids);
  }
}

export function blocksToNotion(blocks, depth = 0) {
  const out = [];
  for (const b of blocks) {
    switch (b.t) {
      case 'p': {
        if (b.inl.length === 1 && b.inl[0].t === 'img' && isImgUrl(b.inl[0].src)) {
          out.push({ object: 'block', type: 'image', image: { type: 'external', external: { url: b.inl[0].src } } });
        } else {
          const rt = richText(b.inl);
          if (rt.length) out.push(para(rt));
        }
        break;
      }
      case 'h': out.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: richText(b.inl) } }); break;
      case 'hr': out.push({ object: 'block', type: 'divider', divider: {} }); break;
      case 'code':
        out.push({ object: 'block', type: 'code', code: { rich_text: plainRich(b.text || ' ').slice(0, MAX_CHILDREN), language: notionLang(b.lang) } });
        break;
      case 'quote': {
        const first = b.blocks[0] && b.blocks[0].t === 'p' ? b.blocks[0] : null;
        const kids = blocksToNotion(first ? b.blocks.slice(1) : b.blocks, depth + 1);
        withChildren({ object: 'block', type: 'quote', quote: { rich_text: first ? richText(first.inl) : [] } }, kids, depth, out);
        break;
      }
      case 'ul': case 'ol': {
        const type = b.t === 'ul' ? 'bulleted_list_item' : 'numbered_list_item';
        for (const it of b.items) {
          const first = it.blocks[0] && it.blocks[0].t === 'p' ? it.blocks[0] : null;
          const kids = blocksToNotion(first ? it.blocks.slice(1) : it.blocks, depth + 1);
          withChildren({ object: 'block', type, [type]: { rich_text: first ? richText(first.inl) : [] } }, kids, depth, out);
        }
        break;
      }
      case 'table': {
        const width = Math.max(1, b.head.length, ...b.rows.map((r) => r.length));
        const row = (cells) => ({ object: 'block', type: 'table_row', table_row: { cells: Array.from({ length: width }, (_, k) => (cells[k] ? richText(cells[k]) : [])) } });
        const body = b.rows.map(row);
        for (let i = 0; i === 0 || i < body.length; i += MAX_CHILDREN - 1) {
          out.push({ object: 'block', type: 'table', table: { table_width: width, has_column_header: true, has_row_header: false, children: [row(b.head), ...body.slice(i, i + MAX_CHILDREN - 1)] } });
        }
        break;
      }
      default: break;
    }
  }
  return out;
}

/** Whole conversation -> { title, children } */
export function conversationToNotion(conv, msgs, style = {}) {
  const children = [];
  if (style.header !== false) {
    const date = String(conv.exportedAt || '').slice(0, 10);
    const link = goodUrl(conv.url);
    const rt = [{ type: 'text', text: { content: `Exported from ${conv.siteName} on ${date}` }, annotations: { italic: true, color: 'gray' } }];
    if (link) rt.push({ type: 'text', text: { content: ' · ' }, annotations: { color: 'gray' } }, { type: 'text', text: { content: link.slice(0, 300), link: { url: link } }, annotations: { color: 'gray' } });
    children.push(para(rt));
  }
  for (const m of msgs) {
    if (m.role === 'section') { children.push({ object: 'block', type: 'heading_1', heading_1: { rich_text: plainRich(m.markdown) } }); continue; }
    children.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: plainRich(roleName(m.role, conv, m)) } });
    children.push(...blocksToNotion(parseBlocks(m.markdown)));
  }
  return { title: String(conv.title || 'Untitled chat').slice(0, MAX_TEXT), children };
}

export class NotionError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

function friendly(status, body) {
  const msg = (body && body.message) || '';
  if (status === 401) return 'Notion rejected the token. Check that you pasted the integration secret.';
  if (status === 404) return 'Notion cannot see that page. Open it in Notion, click ••• › Connections, and add your integration.';
  if (status === 403) return 'The integration has no permission to add content. Enable "Insert content" for it in Notion.';
  if (status === 400) return 'Notion refused the content: ' + msg;
  if (status === 429) return 'Notion is rate-limiting requests. Try again in a minute.';
  return `Notion error ${status}${msg ? ': ' + msg : ''}`;
}

async function call(fetchImpl, token, method, path, body, sleep) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetchImpl(API + path, {
        method,
        headers: { Authorization: 'Bearer ' + token, 'Notion-Version': VERSION, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      throw new NotionError('Could not reach Notion. Check your connection and that Archiv may access api.notion.com.', 0, 'network');
    }
    if (res.ok) return res.json();
    let data = null; try { data = await res.json(); } catch { /* not json */ }
    const retry = res.status === 429 || res.status >= 500;
    if (retry && attempt < 3) {
      const wait = Math.min(Number(res.headers.get && res.headers.get('retry-after')) || (attempt + 1), 10) * 1000;
      await sleep(wait);
      continue;
    }
    throw new NotionError(friendly(res.status, data), res.status, data && data.code);
  }
}

/** Check token + page access. Returns the page title if readable. */
export async function testNotion({ token, parentId, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const page = await call(fetchImpl, token, 'GET', '/pages/' + parentId, null, sleep);
  const t = page.properties && Object.values(page.properties).find((p) => p.type === 'title');
  return { title: (t && t.title && t.title.map((x) => x.plain_text).join('')) || 'Untitled' };
}

/** Create a child page under parentId and fill it. Returns { id, url }. */
export async function sendToNotion({ token, parentId, databaseId, props, title, children, fetchImpl = fetch, onProgress = () => {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const chunks = [];
  for (let i = 0; i < children.length; i += MAX_CHILDREN) chunks.push(children.slice(i, i + MAX_CHILDREN));
  if (!chunks.length) chunks.push([]);
  const page = await call(fetchImpl, token, 'POST', '/pages', {
    parent: databaseId ? { database_id: databaseId } : { page_id: parentId },
    properties: databaseId ? { ...(props || {}), Name: { title: [{ type: 'text', text: { content: title } }] } } : { title: { title: [{ type: 'text', text: { content: title } }] } },
    children: chunks[0]
  }, sleep);
  onProgress(1, chunks.length);
  for (let i = 1; i < chunks.length; i++) {
    await call(fetchImpl, token, 'PATCH', `/blocks/${page.id}/children`, { children: chunks[i] }, sleep);
    onProgress(i + 1, chunks.length);
  }
  return { id: page.id, url: page.url };
}


/** Database schema: one row per chat. */
export const DB_SCHEMA = {
  Name: { title: {} },
  Site: { select: {} },
  Tags: { multi_select: {} },
  Date: { date: {} },
  Messages: { number: { format: 'number' } },
  URL: { url: {} }
};

/** Create the "Archiv chats" database under the parent page. Returns its id. */
export async function createChatDatabase({ token, parentId, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const db = await call(fetchImpl, token, 'POST', '/databases', {
    parent: { type: 'page_id', page_id: parentId },
    title: [{ type: 'text', text: { content: 'Archiv chats' } }],
    properties: DB_SCHEMA
  }, sleep);
  return { id: db.id, url: db.url };
}

const optName = (s) => String(s).replace(/,/g, ' ').slice(0, 100);
/** Row properties for one chat: site, tags, date, message count, source link. */
export function chatProps(conv, tags = [], msgCount = 0) {
  const props = {
    Site: { select: { name: optName(conv.siteName || conv.site || 'Unknown') } },
    Tags: { multi_select: [...new Set(tags.map(optName).filter(Boolean))].slice(0, 20).map((name) => ({ name })) },
    Date: { date: { start: String(conv.exportedAt || new Date().toISOString()).slice(0, 10) } },
    Messages: { number: msgCount }
  };
  if (/^https?:\/\//.test(conv.url || '')) props.URL = { url: conv.url.slice(0, 2000) };
  return props;
}
