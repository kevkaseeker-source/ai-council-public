const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, utimesSync } = require('node:fs');
const { join } = require('node:path');
const os = require('node:os');
const { recentFiles, buildInventory, resolveFile } = require('../src/inventory');

const tmp = mkdtempSync(join(os.tmpdir(), 'council-inv-'));
mkdirSync(join(tmp, 'woche1')); mkdirSync(join(tmp, 'woche1', 'tief')); mkdirSync(join(tmp, 'woche1', 'tief', 'tiefer'));
writeFileSync(join(tmp, 'alt.md'), ''); writeFileSync(join(tmp, 'woche1', 'neu.png'), ''); writeFileSync(join(tmp, 'woche1', 'tief', 'zu-tief.txt'), '');
utimesSync(join(tmp, 'alt.md'), new Date('2020-01-01'), new Date('2020-01-01'));

test('recentFiles: newest first, depth 2', () => {
  assert.deepEqual(recentFiles([tmp]).map(f => f.rel), ['woche1/neu.png', 'alt.md']);
});

test('buildInventory: folders, files, activity only from sessions inside the area', () => {
  const b = { id: 'c', pfade: [tmp] };
  const events = [
    { ts: '1', agent: 'haiku', session: 's1', text: 'liest X' },
    { ts: '2', agent: 'codex', session: 's2', text: 'anderswo' },
    { ts: '3', agent: 'opus', session: 's1', text: 'prüft' },
  ];
  const inv = buildInventory(b, { events, sessionCwd: new Map([['s1', join(tmp, 'woche1')], ['s2', 'C:/sonstwo']]) });
  assert.deepEqual(inv.folders, [{ name: 'woche1', files: 1 }]);
  assert.equal(inv.files[0].rel, 'woche1/neu.png');
  assert.deepEqual(inv.activity.map(a => a.agent), ['opus', 'haiku']);
});

test('resolveFile never leaves the area', () => {
  const b = { pfade: [tmp] };
  assert.equal(resolveFile(b, 0, 'woche1/neu.png'), join(tmp, 'woche1', 'neu.png'));
  assert.equal(resolveFile(b, 0, '../draussen.txt'), null);
  assert.equal(resolveFile(b, 3, 'x'), null);
});
