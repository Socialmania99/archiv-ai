// Chat -> PNG, fully local. HTML is measured in a hidden iframe, wrapped in an
// SVG <foreignObject>, drawn to a canvas. Long chats are cut into slices so the
// canvas never exceeds browser limits. Remote images are replaced by alt text
// (they would taint the canvas).
import { conversationBodyHtml, styleCss, palette, DEFAULT_STYLE } from './render.js';

const XHTML = 'http://www.w3.org/1999/xhtml';

function rootCss(style) {
  return styleCss(style)
    .replace(/@page[^}]*}/, '')
    .replace(/\nhtml \{[^}]*}/, '')
    .replace(/\nbody \{/, '\n.cr {')
    .replace(/@media print[\s\S]*$/, '');
}

/**
 * @returns {Promise<Blob[]>} one PNG per slice
 */
export async function toPngBlobs(conv, msgs, style = DEFAULT_STYLE, opts = {}) {
  const width = opts.width || 900;
  const scale = opts.scale || 2;
  const maxSlice = opts.maxSlice || 7000;
  const p = palette(style);

  const bodyHtml = conversationBodyHtml(conv, msgs, style).replace(/<img [^>]*alt="([^"]*)"[^>]*>/g, '[image: $1]');
  const css = rootCss(style);

  // measure
  const frame = document.createElement('iframe');
  frame.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;height:600px;border:0`;
  frame.srcdoc = `<!doctype html><meta charset="utf-8"><style>${css}</style><div class="cr" style="max-width:none;margin:0;width:${width}px">${bodyHtml}</div>`;
  document.body.appendChild(frame);
  await new Promise((r) => { frame.onload = r; });
  const cr = frame.contentDocument.querySelector('.cr');
  const serialized = new XMLSerializer().serializeToString(cr);
  const height = Math.ceil(cr.scrollHeight);
  frame.remove();

  const inner = `<div xmlns="${XHTML}"><style>${css.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</style>${serialized.replace(/^<div[^>]*>/, `<div xmlns="${XHTML}" class="cr" style="max-width:none;margin:0;width:${width}px">`)}</div>`;

  const blobs = [];
  for (let y = 0; y < height; y += maxSlice) {
    const h = Math.min(maxSlice, height - y);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}"><foreignObject x="0" y="${-y}" width="${width}" height="${height}">${inner}</foreignObject></svg>`;
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    blobs.push(await new Promise((res) => canvas.toBlob(res, 'image/png')));
  }
  return blobs;
}
