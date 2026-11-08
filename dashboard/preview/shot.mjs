// Screenshot the Council UI preview at the size of Kevin's side panel, one image per bottom tab.
// Usage: node dashboard/preview/shot.mjs <outDir> [width] [height]
import puppeteer from '../../tools/render/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const [outDir, w = '600', h = '900'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const state = execFileSync(process.execPath, [join(here, 'make-state.js')], { encoding: 'utf8' });
writeFileSync(join(here, 'state.js'), 'window.__state = ' + state + ';\n');

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  defaultViewport: { width: Number(w), height: Number(h), deviceScaleFactor: 1 },
  args: ['--allow-file-access-from-files'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(join(here, 'index.html')).href, { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 600));
// select the first real session so the tree has content
await page.evaluate(() => { const s = document.querySelector('select'); if (s && s.options[1]) { s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })); } });
for (const tab of ['activity', 'learnings', 'network']) {
  await page.evaluate(t => document.querySelector(`.tab[data-tab="${t}"]`)?.click(), tab);
  await new Promise(r => setTimeout(r, tab === "network" ? 4000 : 500));
  await page.screenshot({ path: join(outDir, `council-${tab}.png`), fullPage: true });
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
