// Small Markdown parser -> block AST. Covers exactly what content/md.js emits:
// headings, paragraphs, fenced code, nested lists, tables, quotes, hr, inline
// bold/italic/code/links/images. One AST feeds the HTML and DOCX writers.

const LI = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const indentOf = (s) => s.match(/^\s*/)[0].length;
const isBlank = (s) => /^\s*$/.test(s);

export function parseBlocks(md) {
  return parseLines(String(md).replace(/\r\n?/g, '\n').split('\n'));
}

function isBlockStart(lines, i) {
  const l = lines[i];
  return /^\s*(`{3,}|~{3,})/.test(l) || /^#{1,6}\s/.test(l) || /^>/.test(l) || LI.test(l) ||
    /^\s*([-*_])(\s*\1){2,}\s*$/.test(l) || (l.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]));
}

function parseLines(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { i++; continue; }
    let m;

    if ((m = line.match(/^(\s*)(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/))) {
      const ind = m[1].length, fence = m[2], lang = m[3];
      const close = new RegExp('^\\s*' + fence[0] + '{' + fence.length + ',}\\s*$');
      const buf = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) {
        buf.push(lines[i].slice(Math.min(ind, indentOf(lines[i]))));
        i++;
      }
      i++;
      out.push({ t: 'code', lang, text: buf.join('\n') });
      continue;
    }
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      out.push({ t: 'h', level: m[1].length, inl: parseInline(m[2].trim()) });
      i++; continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push({ t: 'hr' }); i++; continue; }
    if (/^>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push({ t: 'quote', blocks: parseLines(buf) });
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) { rows.push(splitRow(lines[i])); i++; }
      out.push({ t: 'table', head: head.map(cellInl), rows: rows.map((r) => r.map(cellInl)) });
      continue;
    }
    if (LI.test(line)) { i = parseList(lines, i, out); continue; }

    const buf = [line];
    i++;
    while (i < lines.length && !isBlank(lines[i]) && !isBlockStart(lines, i)) { buf.push(lines[i]); i++; }
    out.push({ t: 'p', inl: parseInline(buf.join('\n')) });
  }
  return out;
}

function splitRow(s) {
  return s.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
}
const cellInl = (c) => parseInline(c.replace(/\s*<br>\s*/gi, '\n'));

function parseList(lines, i, out) {
  const first = lines[i].match(LI);
  const base = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items = [];
  while (i < lines.length) {
    const m = lines[i].match(LI);
    if (!m || m[1].length !== base || /\d/.test(m[2]) !== ordered) break;
    const strip = base + m[2].length + 1;
    const content = [m[3]];
    i++;
    while (i < lines.length) {
      const l = lines[i];
      if (isBlank(l)) {
        let j = i;
        while (j < lines.length && isBlank(lines[j])) j++;
        if (j < lines.length && indentOf(lines[j]) > base) { content.push(''); i++; continue; }
        break;
      }
      if (indentOf(l) > base) { content.push(l.slice(Math.min(strip, indentOf(l)))); i++; continue; }
      break;
    }
    items.push({ blocks: parseLines(content) });
    while (i < lines.length && isBlank(lines[i]) && i + 1 < lines.length && LI.test(lines[i + 1]) && lines[i + 1].match(LI)[1].length === base) i++;
  }
  out.push({ t: ordered ? 'ol' : 'ul', items });
  return i;
}

// ---------- inline ----------
export function parseInline(src) {
  const out = [];
  run(String(src), {}, out);
  return out;
}

function run(str, st, out) {
  let i = 0, buf = '';
  const flush = () => { if (buf) { out.push({ t: 'text', s: buf, ...st }); buf = ''; } };
  while (i < str.length) {
    const c = str[i];
    if (c === '\\' && i + 1 < str.length && /[\\`*_{}[\]()#+\-.!|$<>]/.test(str[i + 1])) { buf += str[i + 1]; i += 2; continue; }
    if (c === '`') {
      const m = str.slice(i).match(/^(`+)([\s\S]*?[^`])\1(?!`)/);
      if (m) { flush(); out.push({ t: 'text', s: m[2].replace(/^ (.*) $/s, '$1'), ...st, code: true }); i += m[0].length; continue; }
    }
    if (c === '!' && str[i + 1] === '[') {
      const m = str.slice(i).match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
      if (m) { flush(); out.push({ t: 'img', alt: m[1], src: m[2] }); i += m[0].length; continue; }
    }
    if (c === '[') {
      const m = str.slice(i).match(/^\[((?:[^[\]]|\[[^\]]*\])*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
      if (m) { flush(); run(m[1], { ...st, href: m[2] }, out); i += m[0].length; continue; }
    }
    if (c === '*' || c === '_') {
      const dbl = str[i + 1] === c;
      const mark = dbl ? c + c : c;
      const rest = str.slice(i + mark.length);
      const prev = i > 0 ? str[i - 1] : '';
      if (rest[0] && !/\s/.test(rest[0]) && !(c === '_' && /\w/.test(prev)) && !(rest[0] === c && !dbl)) {
        let j = rest.indexOf(mark);
        while (j > 0 && (/\s/.test(rest[j - 1]) || (c === '_' && /\w/.test(rest[j + mark.length] || '')))) j = rest.indexOf(mark, j + 1);
        if (j > 0) {
          flush();
          run(rest.slice(0, j), { ...st, [dbl ? 'b' : 'i']: true }, out);
          i += mark.length + j + mark.length;
          continue;
        }
      }
    }
    if (c === '\n') { flush(); out.push({ t: 'br' }); i++; continue; }
    buf += c; i++;
  }
  flush();
}

export function inlineToText(inl) {
  return inl.map((r) => (r.t === 'br' ? '\n' : r.t === 'img' ? '[' + (r.alt || 'image') + ']' : r.s)).join('');
}

export function blocksToText(blocks, depth = 0) {
  const pad = '  '.repeat(depth);
  const out = [];
  for (const b of blocks) {
    switch (b.t) {
      case 'h': case 'p': out.push(pad + inlineToText(b.inl)); break;
      case 'code': out.push(b.text.split('\n').map((l) => pad + '    ' + l).join('\n')); break;
      case 'hr': out.push(pad + '----------'); break;
      case 'quote': out.push(blocksToText(b.blocks, depth).split('\n').map((l) => '> ' + l).join('\n')); break;
      case 'ul': case 'ol':
        b.items.forEach((it, n) => {
          const mk = b.t === 'ol' ? n + 1 + '. ' : '• ';
          const inner = blocksToText(it.blocks, depth + 1).split('\n');
          inner[0] = pad + mk + inner[0].trimStart();
          out.push(inner.join('\n'));
        });
        break;
      case 'table':
        out.push([b.head, ...b.rows].map((r) => pad + r.map(inlineToText).join(' | ')).join('\n'));
        break;
    }
  }
  return out.join('\n\n');
}
