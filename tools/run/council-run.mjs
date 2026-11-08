import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

const cut = s => String(s).slice(0, 200);
export function isForbiddenCwd(dir) { return /^[gG]:[\\/]/.test(String(dir)); }
export function toWslPath(p) {
  const m = /^([a-zA-Z]):[\\/](.*)$/.exec(String(p));
  return m ? `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}` : String(p);
}
// Codex inside WSL (Linux sandbox): can run toolchains that only exist in WSL (Rust, Anchor). Never danger-full-access.
const WSL_SANDBOXES = ['read-only', 'workspace-write'];
export function buildCommand(worker, taskText, opts = {}) {
  if (worker === 'codex-wsl') {
    const sandbox = opts.sandbox ?? 'read-only';
    if (!WSL_SANDBOXES.includes(sandbox)) throw new Error('codex-wsl: sandbox not allowed: ' + sandbox);
    const net = opts.network ? ' -c sandbox_workspace_write.network_access=true' : '';
    // Extra writable roots (e.g. ~/.cache/solana for build-sbf). Only plain absolute Linux paths, nothing the shell could interpret.
    const roots = opts.writable ?? [];
    for (const r of roots) if (!/^\/[A-Za-z0-9._\/-]+$/.test(r) || r === '/' || r.includes('..')) throw new Error('codex-wsl: writable root not allowed: ' + r);
    const wr = roots.length ? ` -c 'sandbox_workspace_write.writable_roots=[${roots.map(r => `"${r}"`).join(',')}]'` : '';
    const inner = `. "$HOME/.nvm/nvm.sh" && exec codex exec --json --skip-git-repo-check --sandbox ${sandbox}${net}${wr} -`;
    return { cmd: opts.bin ?? 'wsl', args: ['-d', opts.distro ?? 'Ubuntu', '--cd', toWslPath(opts.cwd ?? process.cwd()), '--exec', 'bash', '-lc', inner], stdin: taskText };
  }
  if (worker === 'codex') return { cmd: opts.bin ?? 'codex', args: ['exec', '--json', '--skip-git-repo-check', '--sandbox', opts.sandbox ?? 'read-only', '-'], stdin: taskText };
  if (worker === 'grok-4.7' || worker === 'grok-4.7-build-fast') return { cmd: opts.bin ?? process.env.GROK_BIN ?? join(os.homedir(), '.grok', 'bin', 'grok.exe'), args: ['-p', taskText, '--model', worker, '--permission-mode', 'plan', '--sandbox', 'read-only', '--output-format', 'streaming-json'], stdin: null };
  throw new Error('unknown worker: ' + worker);
}
export function parseLine(worker, line) {
  let j; try { j = JSON.parse(line); } catch { return null; }
  const item = j.item ?? {};
  if (worker.startsWith('grok')) {
    if (j.type === 'thought') return { type: 'thinking', text: cut(j.data) };
    if (j.type === 'text') return { type: 'result', text: cut(j.data) };
    if (j.type === 'tool_call') return { type: 'step', text: cut(j.kind === 'execute' && j.rawInput?.command ? 'führt aus: ' + j.rawInput.command : (j.title ?? j.toolName ?? 'Werkzeug')) };
    if (j.type === 'tool_call_update' && j.status === 'failed') return { type: 'error', text: cut(j.content?.[0]?.content?.text ?? 'Fehler') };
    return null;
  }
  if (j.type === 'error' || (j.type === 'item.completed' && item.type === 'error')) return { type: 'error', text: cut(j.message ?? item.message ?? 'Fehler') };
  if (j.type === 'item.completed' && item.type === 'agent_message') return { type: 'result', text: cut(item.text) };
  if (j.type === 'item.completed' && item.type === 'reasoning') return { type: 'thinking', text: cut(item.text) };
  if (j.type === 'item.started' && item.type === 'command_execution') return { type: 'step', text: cut('führt aus: ' + item.command) };
  if (j.type === 'item.completed' && item.type === 'file_change') return { type: 'step', text: cut('schreibt ' + (item.changes ?? []).map(c => c.path).join(', ')) };
  return null;
}
export function parseUsage(worker, line) {
  let j; try { j = JSON.parse(line); } catch { return null; }
  if (worker.startsWith('codex') && j.type === 'turn.completed' && j.usage) return { in: j.usage.input_tokens, out: j.usage.output_tokens, provider: 'openai' };
  if (worker.startsWith('grok') && j.type === 'usage' && j.usage) return { in: j.usage.input_tokens, out: j.usage.output_tokens, provider: 'xai' };
  return null;
}

async function main() {
  const [worker, taskFile, ...rest] = process.argv.slice(2);
  const opts = { cwd: dirname(taskFile ?? process.cwd()) };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--cwd') opts.cwd = rest[++i];
    else if (rest[i] === '--sandbox') opts.sandbox = rest[++i];
    else if (rest[i] === '--bin') opts.bin = rest[++i];
    else if (rest[i] === '--network') opts.network = true;
    else if (rest[i] === '--distro') opts.distro = rest[++i];
    else if (rest[i] === '--writable') (opts.writable ??= []).push(rest[++i]);
    else if (rest[i] === '--fake-args') opts.fakeArgs = rest[++i];
  }
  // Absolute cwd: a relative "." breaks `wsl --cd` (E_INVALIDARG).
  opts.cwd = resolve(opts.cwd);
  if (isForbiddenCwd(opts.cwd) || isForbiddenCwd(taskFile)) { process.stderr.write('Forbidden working directory.\n'); process.exitCode = 2; return; }
  const taskText = readFileSync(taskFile, 'utf8');
  let { cmd, args, stdin } = buildCommand(worker, taskText, opts);
  if (opts.fakeArgs !== undefined) args = opts.fakeArgs.split('|');
  const script = dirname(fileURLToPath(import.meta.url));
  const logsDir = process.env.COUNCIL_LOGS ?? join(script, '..', '..', 'logs');
  mkdirSync(logsDir, { recursive: true });
  const logFile = join(logsDir, `events-${new Date().toISOString().slice(0, 10)}.jsonl`);
  const run = 'r-' + randomBytes(3).toString('hex');
  const started = Date.now();
  const writeEvent = (type, text, extra = {}) => appendFileSync(logFile, JSON.stringify({ ts: new Date().toISOString(), agent: worker, run, type, text: cut(text), detail: null, tokens: null, session: null, parent: 'opus', ...extra }) + '\n');
  writeEvent('start', 'startet: ' + taskText.split(/\r?\n/, 1)[0]);
  // Windows: npm shims like codex.cmd can only be spawned through a shell (Node >= 18.20 security fix); codex args contain no spaces.
  const viaShell = process.platform === 'win32' && cmd === 'codex';
  const child = spawn(viaShell ? 'codex.cmd' : cmd, args, { cwd: opts.cwd, stdio: ['pipe', 'pipe', 'inherit'], shell: viaShell });
  let buffer = '', pending = null, usage = null;
  const flush = () => { if (pending) writeEvent(pending.type, pending.text); pending = null; };
  child.stdout.on('data', chunk => {
    process.stdout.write(chunk);
    buffer += chunk.toString('utf8');
    const lines = buffer.split(/\r?\n/); buffer = lines.pop();
    for (const line of lines) {
      usage = parseUsage(worker, line) ?? usage;
      const ev = parseLine(worker, line);
      if (!ev) continue;
      if (['thinking', 'result'].includes(ev.type) && pending?.type === ev.type) pending.text = cut(pending.text + ev.text);
      else { flush(); pending = ev; }
    }
  });
  if (stdin !== null) child.stdin.write(stdin);
  child.stdin.end();
  child.on('error', err => { process.stderr.write(String(err) + '\n'); });
  child.on('close', code => {
    if (buffer) { usage = parseUsage(worker, buffer) ?? usage; const ev = parseLine(worker, buffer); if (ev) { if (['thinking', 'result'].includes(ev.type) && pending?.type === ev.type) pending.text = cut(pending.text + ev.text); else { flush(); pending = ev; } } }
    flush();
    writeEvent('end', `fertig (Exit ${code})`, { durationMs: Date.now() - started, tokens: usage });
    process.exitCode = code ?? 1;
  });
}
if (process.argv[1] && import.meta.url.toLowerCase() === pathToFileURL(process.argv[1]).href.toLowerCase()) main().catch(err => { process.stderr.write(String(err) + '\n'); process.exitCode = 1; });
