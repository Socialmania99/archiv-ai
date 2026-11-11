// Real .docx writer (OOXML in a ZIP). No dependencies.
// Headings use Word heading styles, code uses shaded monospace paragraphs,
// tables become native Word tables. Images are written as text links.
import { zip } from './zip.js';
import { parseBlocks } from './markdown.js';
import { roleName, DEFAULT_STYLE } from './render.js';

const xmlEsc = (s) => String(s).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hex = (c, d) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c.slice(1).toUpperCase() : d);
const MONO = 'Consolas';

function runXml(r, ctx) {
  if (r.t === 'br') return '<w:r><w:br/></w:r>';
  const props = [];
  if (r.code) props.push(`<w:rFonts w:ascii="${MONO}" w:hAnsi="${MONO}" w:cs="${MONO}"/>`, '<w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/>');
  if (r.b || ctx.bold) props.push('<w:b/>');
  if (r.i) props.push('<w:i/>');
  if (r.href || r.t === 'img') props.push('<w:color w:val="2563EB"/>', '<w:u w:val="single"/>');
  else if (ctx.color) props.push(`<w:color w:val="${ctx.color}"/>`);
  if (ctx.size) props.push(`<w:sz w:val="${ctx.size}"/>`);
  let text = r.t === 'img' ? `[image: ${r.alt || r.src}]` : r.s;
  if (r.href && !r.code) text = text + (text.trim() === r.href ? '' : ` (${r.href})`);
  const rpr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
  return `<w:r>${rpr}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
}

const inl = (list, ctx = {}) => list.map((r) => runXml(r, ctx)).join('');

function para(inner, o = {}) {
  const p = [];
  if (o.style) p.push(`<w:pStyle w:val="${o.style}"/>`);
  if (o.keepNext) p.push('<w:keepNext/>');
  if (o.border) p.push(`<w:pBdr>${o.border}</w:pBdr>`);
  if (o.shade) p.push(`<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>`);
  if (o.spacing) p.push(`<w:spacing w:before="${o.spacing[0]}" w:after="${o.spacing[1]}"/>`);
  if (o.left != null) p.push(`<w:ind w:left="${o.left}"${o.hanging ? ` w:hanging="${o.hanging}"` : ''}/>`);
  return `<w:p>${p.length ? `<w:pPr>${p.join('')}</w:pPr>` : ''}${inner}</w:p>`;
}

function blocksXml(blocks, st, depth = 0, quote = false) {
  const left = 360 * depth + (quote ? 360 : 0);
  const qBorder = quote ? '<w:left w:val="single" w:sz="18" w:space="8" w:color="9CA3AF"/>' : '';
  const out = [];
  for (const b of blocks) {
    switch (b.t) {
      case 'h': out.push(para(inl(b.inl), { style: 'Heading' + Math.min(b.level + 1, 6), left, keepNext: true })); break;
      case 'p': out.push(para(inl(b.inl, quote ? { color: '4B5563' } : {}), { left, border: qBorder, spacing: [0, 120] })); break;
      case 'hr': out.push(para('', { border: '<w:bottom w:val="single" w:sz="6" w:space="1" w:color="D1D5DB"/>', left })); break;
      case 'code': {
        const lines = b.text.split('\n');
        lines.forEach((ln, i) => {
          const run = `<w:r><w:rPr><w:rFonts w:ascii="${MONO}" w:hAnsi="${MONO}" w:cs="${MONO}"/><w:sz w:val="19"/></w:rPr><w:t xml:space="preserve">${xmlEsc(ln.replace(/\t/g, '    ')) || ' '}</w:t></w:r>`;
          out.push(para(run, { shade: 'F6F8FA', left: left + 120, spacing: [0, i === lines.length - 1 ? 160 : 0] }));
        });
        break;
      }
      case 'quote': out.push(blocksXml(b.blocks, st, depth, true)); break;
      case 'ul': case 'ol':
        b.items.forEach((it, n) => {
          const marker = b.t === 'ol' ? n + 1 + '.' : '•';
          const first = it.blocks[0];
          const lead = `<w:r><w:t xml:space="preserve">${marker}\t</w:t></w:r>`;
          const itemLeft = 360 * (depth + 1) + 120;
          if (first && first.t === 'p') {
            out.push(`<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="${itemLeft}"/></w:tabs><w:spacing w:before="0" w:after="40"/><w:ind w:left="${itemLeft}" w:hanging="300"/></w:pPr>${lead}${inl(first.inl)}</w:p>`);
            out.push(blocksXml(it.blocks.slice(1), st, depth + 1));
          } else {
            out.push(`<w:p><w:pPr><w:ind w:left="${itemLeft}" w:hanging="300"/></w:pPr>${lead}</w:p>`);
            out.push(blocksXml(it.blocks, st, depth + 1));
          }
        });
        break;
      case 'table': {
        const cols = Math.max(b.head.length, ...b.rows.map((r) => r.length), 1);
        const w = Math.floor(9000 / cols);
        const cell = (c, head) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/>' : ''}</w:tcPr>${para(inl(c, head ? { bold: true } : {}), { spacing: [40, 40] })}</w:tc>`;
        const row = (r, head) => {
          const cells = r.slice();
          while (cells.length < cols) cells.push([]);
          return `<w:tr>${cells.map((c) => cell(c, head)).join('')}</w:tr>`;
        };
        const bd = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>`).join('');
        out.push(`<w:tbl><w:tblPr><w:tblW w:w="${w * cols}" w:type="dxa"/><w:tblBorders>${bd}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${Array(cols).fill(`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${row(b.head, true)}${b.rows.map((r) => row(r, false)).join('')}</w:tbl>`);
        out.push(para('', { spacing: [0, 80] }));
        break;
      }
    }
  }
  return out.join('');
}

function stylesXml(style) {
  const font = xmlEsc(style.font || 'Calibri');
  const sz = Math.round((Number(style.size) || 11) * 2);
  const color = hex(style.color, '1F2328');
  const heading = (n, size) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr></w:style>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/><w:color w:val="${color}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz + 20}"/></w:rPr></w:style>
${heading(1, sz + 12)}${heading(2, sz + 8)}${heading(3, sz + 4)}${heading(4, sz + 2)}${heading(5, sz)}${heading(6, sz)}
</w:styles>`;
}

export function toDocxBlob(conv, msgs, style = DEFAULT_STYLE) {
  const body = [];
  body.push(para(`<w:r><w:t xml:space="preserve">${xmlEsc(conv.title)}</w:t></w:r>`, { style: 'Title' }));
  if (style.header) {
    const meta = `Exported from ${conv.siteName} on ${conv.exportedAt.slice(0, 10)}${conv.url ? ' · ' + conv.url : ''}`;
    body.push(para(`<w:r><w:rPr><w:color w:val="6B7280"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${xmlEsc(meta)}</w:t></w:r>`, { spacing: [0, 240] }));
  }
  for (const m of msgs) {
    if (m.role === 'section') {
      body.push(para(`<w:r><w:t xml:space="preserve">${xmlEsc(m.markdown)}</w:t></w:r>`, { style: 'Heading1', keepNext: true }));
      continue;
    }
    const col = m.role === 'user' ? '4F46E5' : '059669';
    body.push(para(`<w:r><w:rPr><w:b/><w:color w:val="${col}"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${xmlEsc(roleName(m.role, conv, m).toUpperCase())}</w:t></w:r>`,
      { keepNext: true, spacing: [200, 40], border: `<w:bottom w:val="single" w:sz="6" w:space="1" w:color="${col}"/>` }));
    body.push(blocksXml(parseBlocks(m.markdown), style));
  }
  const pg = style.page === 'Letter' ? [12240, 15840] : [11906, 16838];
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="${pg[0]}" w:h="${pg[1]}"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  return zip([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'word/styles.xml', data: stylesXml(style) },
    { name: 'word/document.xml', data: document }
  ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
