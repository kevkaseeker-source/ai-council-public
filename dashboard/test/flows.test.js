const { test } = require('node:test');
const assert = require('node:assert/strict');
const { detectFlows } = require('../src/flows');

test('detectFlows finds recent cross-area path touches only', () => {
  const bereiche = [{ id: 'a', pfade: ['C:/work/a'] }, { id: 'b', pfade: ['C:/work/b'] }];
  const events = [{ ts: '2026-10-25T10:00:00Z', session: 's', detail: { target: 'C:/work/b/data.txt' } }];
  assert.deepEqual(detectFlows({ bereiche, events, sessionCwd: new Map([['s', 'C:/work/a']]), now: new Date('2026-10-25T10:10:00Z') }), [{ from: 'a', to: 'b', active: true }]);
});
