const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { parseEventLines, reduceEvents } = require('../src/events');
const text = readFileSync(join(__dirname, 'fixtures', 'events.jsonl'), 'utf8');

test('parse skips bad lines', () => {
  const { events, skipped } = parseEventLines(text);
  assert.equal(events.length, 8);
  assert.equal(skipped, 2);
});

test('cards per agent', () => {
  const { events } = parseEventLines(text);
  const { agents } = reduceEvents(events, new Date('2026-10-20T10:04:00Z'));
  for (const a of ['opus', 'haiku', 'sonnet', 'browser', 'codex', 'grok-4.7', 'grok-4.7-build-fast', 'other']) assert.ok(agents[a], a);
  assert.equal(agents.codex.status, 'fertig');
  assert.deepEqual(agents.codex.tokens, { in: 1000, out: 50, provider: 'openai' });
  assert.equal(agents.codex.durationMs, 40000);
  assert.equal(agents.haiku.status, 'arbeitet');
  assert.equal(agents.haiku.activity, 'sucht example');
  assert.equal(agents.haiku.durationMs, 120000);
  assert.equal(agents['grok-4.7'].status, 'fehler');
  assert.equal(agents.sonnet.status, 'wartet');
  assert.equal(agents.opus.activity, 'liest C:/work/a.txt');
  assert.equal(agents.opus.model, null);
});

test('stale run -> unbekannt', () => {
  const { events } = parseEventLines(text);
  const { agents } = reduceEvents(events, new Date('2026-10-20T11:00:00Z'));
  assert.equal(agents.haiku.status, 'unbekannt');
  assert.equal(agents.codex.status, 'fertig');
});

test('log keeps last 300 in order', () => {
  const many = Array.from({ length: 350 }, (_, i) => ({ ts: new Date(Date.UTC(2026, 9, 20, 10, 0, i)).toISOString(), agent: 'opus', run: 's', type: 'step', text: 'x' + i }));
  const { log } = reduceEvents(many, new Date('2026-10-20T10:10:00Z'));
  assert.equal(log.length, 300);
  assert.equal(log[0].text, 'x50');
  assert.equal(log.at(-1).text, 'x349');
});

test('new agent names get a card', () => {
  const { agents } = reduceEvents([{ ts: '2026-10-20T10:00:00.000Z', agent: 'gemini', run: 'r', type: 'start', text: 'hi' }], new Date('2026-10-20T10:00:10Z'));
  assert.equal(agents.gemini.status, 'arbeitet');
});
