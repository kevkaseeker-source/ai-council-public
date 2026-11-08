import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { toEvent, newState } from '../council-hook.mjs';

const FIX = fileURLToPath(new URL('./fixtures/', import.meta.url));
const SCRIPT = fileURLToPath(new URL('../council-hook.mjs', import.meta.url));
const seq = JSON.parse(readFileSync(join(FIX, 'sequence.json'), 'utf8'));
const TYPE = { SessionStart: 'start', SubagentStart: 'start', PreToolUse: 'step', PostToolUse: 'result', SubagentStop: 'end', Stop: 'end' };
const load = f => JSON.parse(readFileSync(join(FIX, f), 'utf8'));
const hook = (input, dir) => spawnSync(process.execPath, [SCRIPT], { input, env: { ...process.env, COUNCIL_LOGS: dir }, encoding: 'utf8' });

test('enough fixtures', () => assert.ok(seq.length >= 15, `only ${seq.length}`));

test('sequence: every fixture maps to the agent and type in its file name', () => {
  const state = newState();
  for (const f of seq) {
    const [agent, hookEvent] = f.split('.');
    const ev = toEvent(load(f), new Date('2026-10-20T14:00:00Z'), state);
    assert.equal(ev.agent, agent, f);
    assert.equal(ev.type, TYPE[hookEvent], f);
    assert.equal(ev.ts, '2026-10-20T14:00:00.000Z', f);
    assert.equal(typeof ev.text, 'string', f);
    assert.ok(ev.text.length > 0 && ev.text.length <= 200, f);
    assert.equal(ev.parent, agent === 'opus' ? null : 'opus', f);
    assert.ok(ev.session && ev.run, f);
    assert.equal(ev.tokens, null, f);
  }
});

test('Agent delegation text names the model', () => {
  const ev = toEvent(load('opus.PreToolUse.agent-haiku.json'), new Date(), newState());
  assert.match(ev.text, /haiku/);
});

test('sub-agent without known delegation -> other', () => {
  const ev = toEvent(load('haiku.PreToolUse.grep.json'), new Date(), newState());
  assert.equal(ev.agent, 'other');
});

test('long input is cut to 200 chars', () => {
  const ev = toEvent({ hook_event_name: 'PreToolUse', session_id: 's1', tool_name: 'Bash', tool_input: { command: 'x'.repeat(5000) } }, new Date(), newState());
  assert.ok(ev.text.length <= 200);
  assert.ok(ev.detail.target.length <= 200);
});

test('file contents and background tasks are never logged', () => {
  const p = { hook_event_name: 'PreToolUse', session_id: 's1', tool_name: 'Edit',
    tool_input: { file_path: 'C:/work/a.txt', old_string: 'OLD-SECRET', new_string: 'NEW-SECRET', content: 'BODY-SECRET' },
    background_tasks: [{ description: 'URL-SECRET' }], tool_response: { x: 'RESP-SECRET' } };
  const s = JSON.stringify(toEvent(p, new Date(), newState()));
  for (const secret of ['OLD-SECRET', 'NEW-SECRET', 'BODY-SECRET', 'URL-SECRET', 'RESP-SECRET']) assert.ok(!s.includes(secret), secret);
});

test('payload without hook_event_name -> null', () => assert.equal(toEvent({}, new Date(), newState()), null));

test('toEvent is fast (1000 calls < 200 ms)', () => {
  const p = load(seq[1]); const st = newState(); const t = performance.now();
  for (let i = 0; i < 1000; i++) toEvent(p, new Date(), st);
  assert.ok(performance.now() - t < 200);
});

test('CLI: one line per call, no stdout, exit 0, state survives between calls', () => {
  const dir = mkdtempSync(join(tmpdir(), 'council-hook-'));
  for (const f of ['opus.PreToolUse.agent-haiku.json', 'haiku.SubagentStart.start.json', 'haiku.PreToolUse.grep.json']) {
    const r = hook(readFileSync(join(FIX, f), 'utf8'), dir);
    assert.equal(r.status, 0, f);
    assert.equal(r.stdout, '', f);
  }
  const logs = readdirSync(dir).filter(f => /^events-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f));
  assert.equal(logs.length, 1);
  const lines = readFileSync(join(dir, logs[0]), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(lines.length, 3);
  assert.equal(lines[2].agent, 'haiku');
});

test('CLI: garbage input -> exit 0, no stdout, no event file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'council-hook-'));
  const r = hook('not json', dir);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(readdirSync(dir).filter(f => f.startsWith('events-')).length, 0);
});
