import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { once } from 'node:events';

const began = Date.now();
let browser;
let tmp;
const fail = message => { throw new Error(message); };
function argsFrom(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) fail(`Unexpected argument: ${key}`);
    const name = key.slice(2);
    if (['fps', 'from', 'to', 'lufs'].includes(name)) {
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[name] = Number(argv[++i]);
    } else if (['page', 'audio', 'out', 'chrome', 'ffmpeg'].includes(name)) {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) fail(`Missing value for ${key}`);
      out[name] = argv[++i];
    } else fail(`Unknown option: ${key}`);
  }
  for (const k of ['page', 'audio', 'out', 'chrome', 'ffmpeg']) if (!out[k]) fail(`Missing --${k}`);
  out.fps ??= 25; out.from ??= 0; out.lufs ??= -23;
  if (!(out.fps > 0) || out.from < 0 || !Number.isFinite(out.fps + out.from + out.lufs) || (out.to !== undefined && !(out.to > out.from))) fail('Invalid numeric option');
  return out;
}
function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: input ? ['pipe', 'ignore', 'pipe'] : ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8'); child.stderr.on('data', s => stderr += s);
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${stderr}`)));
    if (input) input(child.stdin);
  });
}
async function main() {
  const o = argsFrom(process.argv);
  const pageUrl = pathToFileURL(path.resolve(o.page)); pageUrl.hash = 'render';
  const outPath = path.resolve(o.out);
  tmp = path.join(path.dirname(outPath), `${path.basename(outPath, path.extname(outPath))}.tmp.mp4`);
  browser = await puppeteer.launch({ executablePath: o.chrome, headless: 'new', defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 }, args: ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files', '--disable-web-security', '--hide-scrollbars', '--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(pageUrl.href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => typeof window.__seek === 'function', { timeout: 30000 });
  const pageDuration = await page.evaluate(() => window.__duration);
  const duration = o.to ?? pageDuration;
  const length = duration - o.from;
  if (!(duration > o.from) || !Number.isFinite(length)) fail('Invalid render duration');
  const frames = Math.round(length * o.fps);
  await run(o.ffmpeg, ['-y', '-f', 'image2pipe', '-framerate', String(o.fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(o.fps), tmp], async stdin => {
    for (let i = 0; i < frames; i++) {
      await page.evaluate(t => window.__seek(t), o.from + i / o.fps);
      const jpg = await page.screenshot({ type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
      if (!stdin.write(jpg)) await once(stdin, 'drain');
      if ((i + 1) % 25 === 0) console.log(`frame ${i + 1}/${frames}`);
    }
    stdin.end();
  });
  const cues = JSON.parse(await readFile(path.resolve(o.audio), 'utf8'));
  if (!Array.isArray(cues)) fail('cues.json must contain an array');
  const active = cues.filter(c => Number(c.start) < duration).map(c => ({ ...c, start: Math.max(0, Number(c.start) - o.from) })).filter(c => c.start < length);
  const cmd = ['-y', '-i', tmp];
  for (const cue of active) cmd.push('-i', cue.file);
  let graph;
  if (active.length) {
    const filters = active.map((c, k) => `[${k + 1}:a]aresample=48000,volume=${Number(c.gain ?? 1)},adelay=${Math.round(c.start * 1000)}|${Math.round(c.start * 1000)}[a${k}]`);
    filters.push(`${active.map((_, k) => `[a${k}]`).join('')}amix=inputs=${active.length}:normalize=0:dropout_transition=0,apad,atrim=0:${length},loudnorm=I=${o.lufs}:TP=-1.5:LRA=11,aresample=48000,aformat=channel_layouts=stereo[aout]`);
    graph = filters.join(';');
  } else graph = `anullsrc=channel_layout=stereo:sample_rate=48000,atrim=0:${length},loudnorm=I=${o.lufs}:TP=-1.5:LRA=11,aresample=48000[aout]`;
  cmd.push('-filter_complex', graph, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-t', String(length), outPath);
  await run(o.ffmpeg, cmd);
}
try {
  await main();
  console.log(path.resolve(argsFrom(process.argv).out));
  console.log(`Total wall time: ${((Date.now() - began) / 1000).toFixed(2)}s`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (tmp) await unlink(tmp).catch(() => {});
}
