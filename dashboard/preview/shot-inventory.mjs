// Screenshot der Bestandsliste einer Blase (simulierte Antwort der Erweiterung).
// Usage: node dashboard/preview/shot-inventory.mjs <outDir>
import puppeteer from '../../tools/render/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const [outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(here, 'state.js'), 'window.__state = ' + execFileSync(process.execPath, [join(here, 'make-state.js')], { encoding: 'utf8' }) + ';\n');
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', defaultViewport: { width: 1100, height: 900 }, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(pathToFileURL(join(here, 'index.html')).href, { waitUntil: 'load' });
await page.evaluate(() => document.querySelector('.tab[data-tab="network"]').click());
await new Promise(r => setTimeout(r, 3500));
await page.evaluate(() => window.CouncilUniverse.showInventory({ type: 'inventory', id: 'b:content', data: {
  folders: [{ name: 'kampagne', files: 9 }, { name: 'woche1', files: 24 }, { name: 'paket_02', files: 6 }],
  files: [{ root: 0, rel: 'kampagne/planer.html', mtime: Date.now() - 600000 }, { root: 0, rel: 'woche2/mo_a.jpg', mtime: Date.now() - 86400000 }],
  activity: [{ ts: new Date().toISOString(), agent: 'haiku', text: 'liest X-Posts von @boardyai' }],
} }));
await new Promise(r => setTimeout(r, 400));
await page.screenshot({ path: join(outDir, 'council-inventory.png') });
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
