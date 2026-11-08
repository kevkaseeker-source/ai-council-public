import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isForbiddenCwd, buildCommand, parseLine, parseUsage, toWslPath } from '../council-run.mjs';

const FIX = fileURLToPath(new URL('./fixtures/', import.meta.url));
const SCRIPT = fileURLToPath(new URL('../council-run.mjs', import.meta.url));
const FAKE = fileURLToPath(new URL('./fake-worker.mjs', import.meta.url));
const lines = f => readFileSync(join(FIX, f), 'utf8').split(/\r?\n/).filter(Boolean);
const json = f => JSON.parse(readFileSync(join(FIX, f), 'utf8'));

function runFake(worker, sample, exitCode) {
  const work = mkdtempSync(join(tmpdir(), 'council-run-'));
  const logs = mkdtempSync(join(tmpdir(), 'council-logs-'));
  writeFileSync(join(work, 'TASK.md'), 'do it');
  const r = spawnSync(process.execPath, [SCRIPT, worker, join(work, 'TASK.md'), '--bin', process.execPath, '--fake-args', `${FAKE}|${join(FIX, sample)}|${exitCode}`],
    { env: { ...process.env, COUNCIL_LOGS: logs }, encoding: 'utf8' });
  const files = readdirSync(logs).filter(f => f.startsWith('events-'));
  const events = files.length ? readFileSync(join(logs, files[0]), 'utf8').trim().split('\n').map(JSON.parse) : [];
  return { r, events };
}

test('forbidden cwd', () => {
  assert.equal(isForbiddenCwd('G:\\Meine Ablage\\x'), true);
  assert.equal(isForbiddenCwd('g:/shared'), true);
  assert.equal(isForbiddenCwd('C:\\Users\\someone\\AppData\\Local\\Temp\\job'), false);
});

test('codex command', () => {
  const c = buildCommand('codex', 'TASK', { cwd: 'C:/tmp/j', sandbox: 'workspace-write' });
  assert.equal(c.cmd, 'codex');
  assert.deepEqual(c.args, ['exec', '--json', '--skip-git-repo-check', '--sandbox', 'workspace-write', '-']);
  assert.equal(c.stdin, 'TASK');
});

test('wsl path conversion', () => {
  assert.equal(toWslPath('C:\\Users\\me\\AppData\\Local\\Temp\\job'), '/mnt/c/Users/me/AppData/Local/Temp/job');
  assert.equal(toWslPath('d:/work'), '/mnt/d/work');
  assert.equal(toWslPath('/home/me/job'), '/home/me/job');
});

test('codex-wsl command', () => {
  const c = buildCommand('codex-wsl', 'TASK', { cwd: 'C:\\tmp\\j', sandbox: 'workspace-write', network: true });
  assert.equal(c.cmd, 'wsl');
  assert.deepEqual(c.args.slice(0, 7), ['-d', 'Ubuntu', '--cd', '/mnt/c/tmp/j', '--exec', 'bash', '-lc']);
  assert.equal(c.args[7], '. "$HOME/.nvm/nvm.sh" && exec codex exec --json --skip-git-repo-check --sandbox workspace-write -c sandbox_workspace_write.network_access=true -');
  assert.equal(c.stdin, 'TASK');
  const ro = buildCommand('codex-wsl', 'T', { cwd: '/home/me/j' });
  assert.equal(ro.args[7], '. "$HOME/.nvm/nvm.sh" && exec codex exec --json --skip-git-repo-check --sandbox read-only -');
});

test('codex-wsl rejects unsafe sandbox', () => {
  assert.throws(() => buildCommand('codex-wsl', 'T', { cwd: '/x', sandbox: 'danger-full-access' }));
  assert.throws(() => buildCommand('codex-wsl', 'T', { cwd: '/x', sandbox: 'read-only; rm -rf ~' }));
});

test('codex-wsl writable roots', () => {
  const c = buildCommand('codex-wsl', 'T', { cwd: '/x', sandbox: 'workspace-write', writable: ['/home/me/.cache/solana'] });
  assert.equal(c.args[7], `. "$HOME/.nvm/nvm.sh" && exec codex exec --json --skip-git-repo-check --sandbox workspace-write -c 'sandbox_workspace_write.writable_roots=["/home/me/.cache/solana"]' -`);
  for (const bad of ['/', 'relative/x', '/a/../etc', "/a'; rm -rf ~", '/a b', '$HOME/x'])
    assert.throws(() => buildCommand('codex-wsl', 'T', { cwd: '/x', writable: [bad] }), /writable root/);
});

test('codex-wsl usage is parsed like codex', () => {
  const line = JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 2 } });
  assert.deepEqual(parseUsage('codex-wsl', line), { in: 10, out: 2, provider: 'openai' });
});

test('grok command', () => {
  const c = buildCommand('grok-4.7-build-fast', 'TASK', { cwd: 'C:/tmp/j', bin: 'grok.exe' });
  assert.equal(c.cmd, 'grok.exe');
  assert.deepEqual(c.args, ['-p', 'TASK', '--model', 'grok-4.7-build-fast', '--permission-mode', 'plan', '--sandbox', 'read-only', '--output-format', 'streaming-json']);
  assert.equal(c.stdin, null);
});

test('unknown worker throws', () => assert.throws(() => buildCommand('gpt', 'T', { cwd: 'C:/x' }), /unknown worker/));

for (const [w, sample, worker] of [['codex', 'codex-sample.jsonl', 'codex'], ['grok', 'grok-sample.txt', 'grok-4.7']]) {
  test(`${w}: parseLine matches expected`, () => {
    const got = lines(sample).map(l => parseLine(worker, l)).filter(Boolean).map(e => ({ type: e.type, text: e.text }));
    assert.deepEqual(got, json(`${w}-sample.expected.json`));
  });
  test(`${w}: parseUsage of last usage line`, () => {
    const got = lines(sample).map(l => parseUsage(worker, l)).filter(Boolean).at(-1) ?? null;
    assert.deepEqual(got, json(`${w}-sample.usage.json`));
  });
}

test('parseLine ignores garbage', () => assert.equal(parseLine('codex', 'not json'), null));

test('CLI codex: passthrough, start/end, tokens, exit code', () => {
  const { r, events } = runFake('codex', 'codex-sample.jsonl', 3);
  assert.equal(r.status, 3);
  assert.equal(r.stdout, readFileSync(join(FIX, 'codex-sample.jsonl'), 'utf8'));
  assert.equal(events[0].type, 'start');
  assert.equal(events.at(-1).type, 'end');
  assert.equal(typeof events.at(-1).durationMs, 'number');
  assert.deepEqual(events.at(-1).tokens, json('codex-sample.usage.json'));
  assert.ok(events.some(e => e.type === 'step'));
  assert.ok(events.every(e => e.agent === 'codex' && e.parent === 'opus' && e.session === null && e.run === events[0].run));
  assert.match(events[0].run, /^r-[0-9a-f]{6}$/);
  assert.ok(events.every(e => e.text.length <= 200));
});

test('CLI grok: consecutive deltas of the same type are merged', () => {
  const { r, events } = runFake('grok-4.7', 'grok-sample.txt', 0);
  assert.equal(r.status, 0);
  const middle = events.slice(1, -1);
  for (let i = 1; i < middle.length; i++) {
    const both = ['thinking', 'result'].includes(middle[i].type);
    assert.ok(!(both && middle[i].type === middle[i - 1].type), `unmerged ${middle[i].type} at ${i}`);
  }
  assert.ok(middle.some(e => e.type === 'thinking'));
  assert.ok(middle.some(e => e.type === 'result' && e.text.includes(' ')));
  assert.equal(events.at(-1).tokens.provider, 'xai');
});

test('CLI: forbidden cwd -> exit 2, no events, nothing started', () => {
  const logs = mkdtempSync(join(tmpdir(), 'council-logs-'));
  const work = mkdtempSync(join(tmpdir(), 'council-run-'));
  writeFileSync(join(work, 'TASK.md'), 'x');
  const r = spawnSync(process.execPath, [SCRIPT, 'codex', join(work, 'TASK.md'), '--cwd', 'G:\\x'], { env: { ...process.env, COUNCIL_LOGS: logs }, encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.equal(readdirSync(logs).length, 0);
});
