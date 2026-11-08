const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const os = require('node:os');
const { listFolders, expandFolders } = require('../src/folders');

const tmp = mkdtempSync(join(os.tmpdir(), 'council-folders-'));
mkdirSync(join(tmp, 'woche1')); mkdirSync(join(tmp, 'woche1', 'bilder')); mkdirSync(join(tmp, 'kampagne')); mkdirSync(join(tmp, '.git')); mkdirSync(join(tmp, 'node_modules'));
writeFileSync(join(tmp, 'woche1', 'a.png'), ''); writeFileSync(join(tmp, 'woche1', 'b.png'), ''); writeFileSync(join(tmp, 'x.md'), '');

test('listFolders: subfolders with file count, skips hidden and tool folders', () => {
  assert.deepEqual(listFolders(tmp).map(f => [f.name, f.files]), [['kampagne', 0], ['woche1', 2]]);
  assert.deepEqual(listFolders(join(tmp, 'gibtsnicht')), []);
});

test('expandFolders: only open nodes, nested ids', () => {
  const b = [{ id: 'content', pfade: [tmp] }];
  const closed = expandFolders(b, new Set());
  assert.deepEqual(closed.ordner, {});
  const one = expandFolders(b, new Set(['b:content']));
  assert.deepEqual(one.ordner['b:content'].map(o => o.id), ['o:content/kampagne', 'o:content/woche1']);
  const two = expandFolders(b, new Set(['b:content', 'o:content/woche1']));
  assert.deepEqual(two.ordner['o:content/woche1'], [{ id: 'o:content/woche1/bilder', label: 'bilder', files: 0 }]);
  assert.equal(two.dirs.get("o:content/woche1/bilder")[0], join(tmp, "woche1", "bilder"));
});
