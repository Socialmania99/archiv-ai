// Copies the shared theme switcher (theme.js, switch.css) into docs/ so the website and the
// extension use one implementation. Run after editing any of them: node tools/sync-site.mjs
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
copyFileSync(join(root, 'theme.js'), join(root, 'docs/theme.js'));
copyFileSync(join(root, 'switch.css'), join(root, 'docs/switch.css'));
console.log('site synced');
