// Draws the Archiv AI icon (archive box on a purple gradient) at 16/48/128 px.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#5b37f0"/></linearGradient></defs>
<rect width="128" height="128" rx="30" fill="url(#g)"/>
<rect x="22" y="30" width="84" height="22" rx="7" fill="#fff"/>
<path d="M30 58h68v34a9 9 0 0 1-9 9H39a9 9 0 0 1-9-9z" fill="#fff" opacity=".92"/>
<rect x="52" y="69" width="24" height="9" rx="4.5" fill="#6d4aff"/>
</svg>`;
const br = await chromium.launch({ channel: 'chromium' });
for (const s of [16, 48, 128]) {
  const p = await br.newPage({ viewport: { width: s, height: s } });
  await p.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${s}px;height:${s}px;display:block}</style>${svg}`);
  await p.screenshot({ path: path.join(ROOT, 'icons', `${s}.png`), omitBackground: true });
}
await br.close();
console.log('icons written');
