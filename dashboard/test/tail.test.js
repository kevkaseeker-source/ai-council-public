const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, appendFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { readNew, oldLogs } = require('../src/tail');

test('readNew reads only appended bytes', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'tail-')), 'a.jsonl');
  writeFileSync(f, 'one\n');
  const a = readNew(f, 0);
  assert.equal(a.text, 'one\n');
  appendFileSync(f, 'zwei-ü\n');
  const b = readNew(f, a.offset);
  assert.equal(b.text, 'zwei-ü\n');
  assert.equal(readNew(f, b.offset).text, '');
});

test('readNew restarts after truncation, handles missing file', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'tail-')), 'a.jsonl');
  writeFileSync(f, 'long line here\n');
  const a = readNew(f, 0);
  writeFileSync(f, 'new\n');
  assert.equal(readNew(f, a.offset).text, 'new\n');
  assert.deepEqual(readNew(f + '.missing', 5), { text: '', offset: 0 });
});

// 14 days before 2026-10-20 is 2026-10-06; strictly older files are deleted.
test('oldLogs picks files older than 14 days', () => {
  const names = ['events-2026-10-01.jsonl', 'events-2026-10-05.jsonl', 'events-2026-10-06.jsonl', 'events-2026-10-20.jsonl', 'agents-state.json'];
  assert.deepEqual(oldLogs(names, new Date('2026-10-20T12:00:00Z')).sort(), ['events-2026-10-01.jsonl', 'events-2026-10-05.jsonl']);
});
