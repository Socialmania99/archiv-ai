// DOM -> Markdown. No dependencies. Handles headings, lists (nested), code
// fences, tables, links, images, blockquotes and KaTeX math.
globalThis.CV = globalThis.CV || {};

CV.toMarkdown = function (root) {
  const SKIP = new Set(['script', 'style', 'button', 'svg', 'noscript', 'textarea', 'input', 'select', 'canvas', 'video', 'audio', 'iframe', 'nav']);
  const BLOCK = new Set(['div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'figure', 'figcaption', 'details', 'summary', 'dl', 'dt', 'dd']);

  const kids = (n, st) => Array.from(n.childNodes).map((c) => walk(c, st)).join('');

  function fenceFor(text) {
    let len = 3;
    const runs = text.match(/`+/g) || [];
    runs.forEach((r) => { if (r.length >= len) len = r.length + 1; });
    return '`'.repeat(len);
  }

  function walk(n, st) {
    if (n.nodeType === 3) return st.pre ? n.nodeValue : n.nodeValue.replace(/\s+/g, ' ');
    if (n.nodeType !== 1) return '';
    const tag = n.tagName.toLowerCase();
    if (SKIP.has(tag)) return '';

    // KaTeX: take the TeX source from the MathML annotation, skip the visual copy
    if (n.classList && n.classList.contains('katex')) {
      const ann = n.querySelector('annotation[encoding="application/x-tex"]');
      if (ann) {
        const tex = ann.textContent.trim();
        return n.closest('.katex-display') ? '\n\n$$' + tex + '$$\n\n' : '$' + tex + '$';
      }
    }
    if (n.hidden || (n.style && n.style.display === 'none')) return '';
    if (n.classList && n.classList.contains('sr-only')) return '';

    switch (tag) {
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
        const t = kids(n, st).trim();
        return t ? '\n\n' + '#'.repeat(+tag[1]) + ' ' + t + '\n\n' : '';
      }
      case 'p': {
        const t = kids(n, st).trim();
        return t ? '\n\n' + t + '\n\n' : '';
      }
      case 'br': return '\n';
      case 'hr': return '\n\n---\n\n';
      case 'strong': case 'b': {
        const t = kids(n, st).trim();
        return t ? '**' + t + '**' : '';
      }
      case 'em': case 'i': {
        const t = kids(n, st).trim();
        return t ? '*' + t + '*' : '';
      }
      case 'del': case 's': return kids(n, st);
      case 'code': {
        const t = n.textContent;
        if (!t) return '';
        if (t.includes('`')) return '`` ' + t + ' ``';
        return '`' + t + '`';
      }
      case 'pre': {
        const codeEl = n.querySelector('code') || n;
        const text = codeEl.textContent.replace(/\n$/, '');
        let lang = '';
        const m = (codeEl.className || '').match(/language-([\w+#.-]+)/);
        if (m) lang = m[1];
        const f = fenceFor(text);
        return '\n\n' + f + lang + '\n' + text + '\n' + f + '\n\n';
      }
      case 'a': {
        const t = kids(n, st).trim();
        const href = n.href || n.getAttribute('href') || '';
        if (!t) return '';
        if (!/^https?:|^mailto:/i.test(href)) return t;
        return '[' + t + '](' + href + ')';
      }
      case 'img': {
        const src = n.currentSrc || n.src || '';
        if (!src || src.startsWith('data:') && src.length > 2000) return '';
        return '![' + (n.alt || '') + '](' + src + ')';
      }
      case 'ul': case 'ol': {
        const ordered = tag === 'ol';
        let idx = ordered ? parseInt(n.getAttribute('start') || '1', 10) : 0;
        const items = [];
        Array.from(n.children).forEach((li) => {
          if (li.tagName.toLowerCase() !== 'li') return;
          let c = kids(li, st).trim();
          if (!c.includes('```')) c = c.replace(/\n{2,}/g, '\n');
          const marker = ordered ? idx++ + '. ' : '- ';
          const pad = ' '.repeat(marker.length);
          items.push(marker + c.split('\n').join('\n' + pad));
        });
        return '\n\n' + items.join('\n') + '\n\n';
      }
      case 'blockquote': {
        const t = kids(n, st).trim();
        return t ? '\n\n' + t.split('\n').map((l) => '> ' + l).join('\n') + '\n\n' : '';
      }
      case 'table': {
        const rows = Array.from(n.querySelectorAll('tr')).map((tr) =>
          Array.from(tr.children)
            .filter((c) => /^(td|th)$/i.test(c.tagName))
            .map((c) => kids(c, st).trim().replace(/\n+/g, ' <br> ').replace(/\|/g, '\\|'))
        ).filter((r) => r.length);
        if (!rows.length) return '';
        const cols = Math.max(...rows.map((r) => r.length));
        const pad = (r) => { while (r.length < cols) r.push(''); return r; };
        const line = (r) => '| ' + pad(r).join(' | ') + ' |';
        const out = [line(rows[0]), '| ' + Array(cols).fill('---').join(' | ') + ' |'];
        rows.slice(1).forEach((r) => out.push(line(r)));
        return '\n\n' + out.join('\n') + '\n\n';
      }
      default:
        return BLOCK.has(tag) ? '\n' + kids(n, st) + '\n' : kids(n, st);
    }
  }

  return collapse(walk(root, {}));
};

// Collapse blank-line runs and trim line-end spaces OUTSIDE code fences.
function collapse(md) {
  const lines = md.split('\n');
  const out = [];
  let inFence = false, fenceLen = 0, blank = 0;
  for (const raw of lines) {
    const m = raw.match(/^(`{3,})/);
    if (!inFence && m) { inFence = true; fenceLen = m[1].length; blank = 0; out.push(raw); continue; }
    if (inFence) {
      if (m && m[1].length >= fenceLen && raw.trim() === m[1]) inFence = false;
      out.push(raw);
      continue;
    }
    const line = raw.replace(/[ \t]+$/, '');
    if (line === '') { blank++; if (blank <= 1) out.push(line); } else { blank = 0; out.push(line); }
  }
  return out.join('\n').trim();
}
