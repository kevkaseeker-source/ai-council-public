const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { readTisch, listTische, tischPfad } = require('../src/tische');

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tisch-'));
  const dir = path.join(root, 'sitzung-a'); fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'tisch.json'), JSON.stringify({ id: 'demo', titel: 'Demo', datum: '2026-10-26', blasen: ['b1'], vertraulich: true,
    sitze: [{ id: 'pro', rolle: 'Pro', modell: 'sonnet', blase: 'b1' }, { id: 'contra', rolle: 'Contra', modell: 'haiku', blase: 'b1' }],
    runden: [{ nr: 1, titel: 'Getrennt' }] }));
  fs.writeFileSync(path.join(dir, 'eintraege.jsonl'), [
    JSON.stringify({ ts: '2026-10-26T10:00:00Z', runde: 1, von: 'pro', art: 'beitrag', text: 'A', tokens: 100 }),
    'kaputt{',
    JSON.stringify({ ts: '2026-10-26T10:01:00Z', runde: 1, von: 'contra', art: 'beitrag', text: 'B', tokens: 50 }),
    JSON.stringify({ ts: '2026-10-26T10:02:00Z', runde: 1, von: 'moderator', art: 'eingriff', text: 'Runde 1 fertig', eingriff: { grund: 'x', optionen: ['a'], auto: true } })
  ].join('\n'));
  fs.mkdirSync(path.join(root, 'tische'));
  fs.writeFileSync(path.join(root, 'tische', 'demo.json'), JSON.stringify({ pfad: dir }));
  fs.writeFileSync(path.join(root, 'tische', 'weg.json'), JSON.stringify({ pfad: path.join(root, 'fehlt') }));
  return { root, dir };
}

test('readTisch parses meta, skips broken lines, sums tokens', () => {
  const { dir } = setup(); const t = readTisch(dir);
  assert.equal(t.erreichbar, true); assert.equal(t.meta.titel, 'Demo');
  assert.equal(t.eintraege.length, 3);
  assert.deepEqual(t.tokensProSitz, { pro: 100, contra: 50 });
  assert.deepEqual(t.tokensProRunde, { 1: 150 }); assert.equal(t.tokensGesamt, 150);
});
test('readTisch on missing folder is unreachable, not a throw', () => {
  const t = readTisch(path.join(os.tmpdir(), 'gibt-es-nicht-' + Date.now()));
  assert.equal(t.erreichbar, false); assert.deepEqual(t.eintraege, []);
});
test('listTische returns registered sessions incl. unreachable ones', () => {
  const { root } = setup(); const l = listTische(root);
  assert.equal(l.length, 2);
  const demo = l.find(x => x.id === 'demo');
  assert.equal(demo.sitze, 2); assert.equal(demo.tokensGesamt, 150); assert.equal(demo.vertraulich, true);
  assert.equal(l.find(x => x.id === 'weg').erreichbar, false);
});
test('tischPfad rejects unknown ids and path tricks', () => {
  const { root, dir } = setup();
  assert.equal(tischPfad(root, 'demo'), dir);
  assert.equal(tischPfad(root, '../x'), null); assert.equal(tischPfad(root, 'nope'), null);
});
