// Collects brand icons into icons/tools/<id>.svg and writes content/icon-map.js.
// Sources (priority): svgl (github.com/pheralb/svgl), lobe-icons (@lobehub/icons-static-svg), simple-icons.
// Expects: /tmp/svgl (git clone), /tmp/icons/node_modules (npm i @lobehub/icons-static-svg simple-icons).
// Logos are trademarks of their owners and are shown only to identify each service.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const require = createRequire('/tmp/icons/x.js');
await import(path.join(ROOT, 'content/registry.js'));
const OUT = path.join(ROOT, 'icons/tools'); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });

// svgl titles
let src = fs.readFileSync('/tmp/svgl/src/data/svgs.ts', 'utf8').replace(/^import .*\n/m, '').replace('export const svgs: iSVG[] =', 'return');
const svgl = new Function(src)();
const svglBy = (title) => svgl.find((s) => s.title === title && !s.subTitle && typeof s.route === 'string') || svgl.find((s) => s.title === title && !s.subTitle);
const lobeDir = '/tmp/icons/node_modules/@lobehub/icons-static-svg/icons';
const si = require('simple-icons');
const siBy = (slug) => Object.values(si).find((v) => v && v.slug === slug);

const S = {   // id: svgl title
  chatgpt: 'OpenAI', gemini: 'Gemini', copilot: 'Microsoft Copilot', claude: 'Claude AI', metaai: 'Meta', deepseek: 'DeepSeek', grok: 'Grok', mistral: 'Mistral AI', pi: 'Pi', huggingchat: 'Hugging Face', kimi: 'Kimi', qwen: 'Qwen',
  githubcopilot: 'GitHub Copilot', googleai: 'Google', cursor: 'Cursor', windsurf: 'Windsurf', amazonq: 'Amazon Q', manus: 'Manus', lovable: 'Lovable', v0: 'v0', bolt: 'bolt', cody: 'Cody', replit: 'Replit',
  perplexity: 'Perplexity AI', openwebui: 'Open WebUI', ollama: 'Ollama', n8n: 'n8n', midjourney: 'Midjourney', notionai: 'Notion', granola: 'Granola', suno: 'Suno', runwayimg: 'Runway', veo3: 'Runway',
  stability: 'Stability AI', canva: 'Canva', voicemod: 'Voicemod', clickup: 'ClickUp', einstein: 'Salesforce', watsonx: 'IBM', whisper: 'OpenAI', snapchatmyai: 'Snapchat', leo: 'Brave Browser', duckai: 'DuckDuckGo', nanobanana: 'Gemini'
};
const L = {   // id: lobe-icons name
  aistudio: 'aistudio', notebooklm: 'notebooklm', poe: 'poe', phind: 'phind', devin: 'devin', deepai: 'deepai', doubao: 'doubao', chatglm: 'chatglm', hunyuan: 'hunyuan', ernie: 'wenxin', spark: 'spark', stepchat: 'stepfun',
  yi: 'yi', yuanbao: 'yuanbao', alice: 'yandex', monica: 'monica', novelai: 'novelai', flux: 'bfl', krea: 'krea', recraft: 'recraft', clipdrop: 'clipdrop', kling: 'kling', luma: 'dreammachine', pika: 'pika', pixverse: 'pixverse',
  elevenlabs: 'elevenlabs', udio: 'udio', lmstudio: 'lmstudio', sillytavern: 'sillytavern', capcut: 'capcut', firefly: 'adobefirefly', dalle3: 'dalle', sora: 'sora', zapier: 'zapier', kanana: null
};
const I = { coderabbit: 'coderabbit', langflow: 'langflow', coda: 'coda', picsart: 'picsart', veed: 'veed', zendesk: 'zendesk', hubspot: 'hubspot', intercom: 'intercomfin'.slice(0, 8), servicenow: 'servicenow', freshdesk: 'freshdesk', khanmigo: 'khanacademy', descript: 'descript', speechify: 'speechify', heygen: 'heygen', gamma: 'gamma', fireflies: 'firefliesai', otter: 'otterai', superhuman: 'superhuman', julius: 'juliusai', taskade: 'taskade', surfer: 'surferseo', wordtune: 'wordtune', jasper: 'jasper', copyai: 'copydotai', writesonic: 'writesonic', quillbot: 'quillbot', grammarly: 'grammarly', character: 'characterdotai', replika: 'replika', elicit: 'elicit', scispace: 'scispace', runway: 'runway', lindy: 'lindy', retell: 'retellai', vapi: 'vapi', synthesia: 'synthesia', tavus: 'tavus', luma: 'luma' };

const unsafe = /<script|on[a-z]+\s*=|javascript:|<foreignObject|<!ENTITY/i;
const out = {}, how = {}, skipped = [];
const put = (id, svg, from) => {
  if (unsafe.test(svg) || svg.length > 60000) { skipped.push(id + ' (' + from + ')'); return false; }
  fs.writeFileSync(path.join(OUT, id + '.svg'), svg); out[id] = 'icons/tools/' + id + '.svg'; how[id] = from; return true;
};
const ids = new Set(CV.REGISTRY.map((r) => r.id));
for (const [id, title] of Object.entries(S)) {
  if (!ids.has(id)) continue;
  const e = svglBy(title); if (!e) continue;
  const route = typeof e.route === 'string' ? e.route : e.route.light;
  const f = '/tmp/svgl/static' + route; if (fs.existsSync(f)) put(id, fs.readFileSync(f, 'utf8'), 'svgl:' + title);
}
for (const [id, name] of Object.entries(L)) {
  if (!ids.has(id) || !name) continue;
  const color = path.join(lobeDir, name + '-color.svg'), mono = path.join(lobeDir, name + '.svg');
  const f = fs.existsSync(color) ? color : fs.existsSync(mono) ? mono : null;
  if (f && !out[id] || (f && how[id]?.startsWith('svgl') && id === 'sora')) put(id, fs.readFileSync(f, 'utf8'), 'lobe:' + name);
}
for (const [id, slug] of Object.entries(I)) {
  if (!ids.has(id) || out[id]) continue;
  const v = siBy(slug); if (!v) continue;
  put(id, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#${v.hex}" d="${v.path}"/></svg>`, 'simple-icons:' + slug);
}
// lobe mono icons use currentColor: pin to a dark ink so they render inside <img>
for (const id of Object.keys(out)) {
  const f = path.join(OUT, id + '.svg'); let s = fs.readFileSync(f, 'utf8');
  if (/currentColor/.test(s)) { s = s.replace(/currentColor/g, '#1c1b2e'); fs.writeFileSync(f, s); }
}
const map = `// Generated by tools/build-icons.mjs. id -> bundled brand icon (shown on a white tile).\n// Logos are trademarks of their owners and are used only to identify each service.\n(globalThis.CV = globalThis.CV || {}).ICONS = ${JSON.stringify(out, null, 1)};\n`;
fs.writeFileSync(path.join(ROOT, 'content/icon-map.js'), map);
const bySrc = {}; Object.values(how).forEach((h) => { const k = h.split(':')[0]; bySrc[k] = (bySrc[k] || 0) + 1; });
console.log('icons:', Object.keys(out).length, 'of', ids.size, bySrc, 'skipped:', skipped);
console.log('no icon (letter avatar):', [...ids].filter((i) => !out[i]).length);
