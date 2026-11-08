const { test } = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { readHistory, readCwd } = require('../src/history');
const file = join(__dirname, 'fixtures', 'history', 's1.jsonl');

test('readHistory returns the visible conversation in order', () => {
  assert.deepEqual(readHistory(file), [
    { role: 'user', text: 'Hallo, bitte hilf mir beim Video', ts: '2026-10-20T10:00:00.000Z' },
    { role: 'assistant', text: 'Gern, ich schaue mir das an.', ts: '2026-10-20T10:00:05.000Z' },
    { role: 'user', text: 'Mach weiter', ts: '2026-10-20T10:01:00.000Z' },
    { role: 'assistant', text: 'Erledigt.', ts: '2026-10-20T10:02:00.000Z' },
  ]);
});

test('readHistory keeps only the last N messages', () => {
  const h = readHistory(file, { limit: 2 });
  assert.deepEqual(h.map(m => m.text), ['Mach weiter', 'Erledigt.']);
});

test('readHistory reads only the tail of big files and skips the cut first line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hist-'));
  const big = join(dir, 'big.jsonl');
  const filler = JSON.stringify({ type: 'user', timestamp: '2026-10-20T09:00:00.000Z', message: { role: 'user', content: 'x'.repeat(1000) } }) + '\n';
  writeFileSync(big, filler.repeat(2000) + JSON.stringify({ type: 'assistant', timestamp: '2026-10-20T11:00:00.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Ende' }] } }) + '\n');
  const h = readHistory(big, { maxBytes: 50000, limit: 3 });
  assert.equal(h.length, 3);
  assert.equal(h.at(-1).text, 'Ende');
});

test('long messages are cut to 4000 chars', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hist-'));
  const f = join(dir, 'l.jsonl');
  writeFileSync(f, JSON.stringify({ type: 'assistant', timestamp: 't', message: { role: 'assistant', content: [{ type: 'text', text: 'y'.repeat(9000) }] } }) + '\n');
  assert.equal(readHistory(f)[0].text.length, 4001);
  assert.ok(readHistory(f)[0].text.endsWith('…'));
});

test('missing file -> empty', () => assert.deepEqual(readHistory(join(__dirname, 'nope.jsonl')), []));

test('readCwd returns the first cwd in the transcript', () => {
  assert.equal(readCwd(file), 'G:/Drive/staex all 2026');
  assert.equal(readCwd(join(__dirname, 'nope.jsonl')), null);
});
