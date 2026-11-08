'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { opusInstances } = require('../src/instances');

test('opus instances keep recent sessions, newest first, and fall back to the last session', () => {
  const now = new Date('2026-10-25T12:00:00Z');
  const events = [
    { agent: 'opus', session: 'old', type: 'end', text: 'done', ts: '2026-10-25T10:00:00Z' },
    { agent: 'opus', session: 'a', type: 'step', text: 'A', ts: '2026-10-25T11:40:00Z' },
    { agent: 'opus', session: 'b', type: 'thinking', text: 'B', ts: '2026-10-25T11:50:00Z' },
    { agent: 'haiku', session: 'x', type: 'step', ts: now.toISOString() },
  ];
  const rows = opusInstances(events, { now, sessionCwd: { a: '/a', b: '/b' } });
  assert.deepEqual(rows.map(x => x.session), ['b', 'a']);
  assert.equal(rows[0].activity, 'B'); assert.equal(rows[0].cwd, '/b');
  assert.deepEqual(opusInstances(events.slice(0, 1), { now }).map(x => x.session), ['old']);
});

test('opus instance privacy removes cwd and activity', () => {
  const rows = opusInstances([{ agent: 'opus', session: 'secret', type: 'step', text: 'secret task', ts: '2026-10-25T11:50:00Z' }], {
    now: new Date('2026-10-25T12:00:00Z'), sessionCwd: { secret: '/private' }, hiddenIds: new Set(['secret']),
  });
  assert.deepEqual(rows[0], { session: 'secret', status: 'arbeitet', activity: null, cwd: null, hidden: true });
});
