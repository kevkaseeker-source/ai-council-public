const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { parseEventLines } = require('../src/events');
const { readTitle, listSessions, assignExternal } = require('../src/sessions');
const dir = join(__dirname, 'fixtures', 'sessions');
const { events } = parseEventLines(readFileSync(join(dir, 'events.jsonl'), 'utf8'));
const projects = join(dir, 'projects');
const NOW = new Date('2026-10-20T10:10:00Z');

test('readTitle takes the last ai-title, null when unknown', () => {
  assert.equal(readTitle(projects, 's1'), 'Video-Kreation mit Google Flow');
  assert.equal(readTitle(projects, 's2'), 'CRM und MINT Produkt');
  assert.equal(readTitle(projects, 's9'), null);
});

test('listSessions: within 2h, newest first, active = event in last 5 min', () => {
  const list = listSessions(events, NOW, id => readTitle(projects, id));
  assert.deepEqual(list.map(s => s.sessionId), ['s1', 's2']);
  assert.equal(list[0].title, 'Video-Kreation mit Google Flow');
  assert.equal(list[0].active, true);
  assert.equal(list[1].active, false);
  assert.equal(list[0].lastTs, '2026-10-20T10:09:30.000Z');
});

test('listSessions falls back to short id when no title', () => {
  const list = listSessions(events, NOW, () => null);
  assert.equal(list[0].title, 's1');
});

test('assignExternal links a run to the session that called council-run within 10 s', () => {
  const m = assignExternal(events);
  assert.equal(m.get('r-111111'), 's1');
  assert.equal(m.get('r-222222'), null);
});
