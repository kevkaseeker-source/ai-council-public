import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { neu, eintrag, rundeFertig } from './tisch.mjs';

test('neu + eintrag + rundeFertig produce readable lines and registry', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-')), dir = path.join(root, 's');
  neu(dir, { id: 'x1', titel: 'T', datum: '2026-10-26', blasen: ['b'], vertraulich: false, sitze: [{ id: 'a', rolle: 'R', modell: 'haiku', blase: 'b' }], runden: [{ nr: 1, titel: 'Eins' }] }, { root });
  eintrag(dir, { runde: 1, von: 'a', art: 'beitrag', text: 'hi', tokens: 5 });
  rundeFertig(dir, 1);
  const lines = fs.readFileSync(path.join(dir, 'eintraege.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  assert.equal(lines.length, 2); assert.ok(lines[0].ts);
  assert.equal(lines[1].art, 'eingriff'); assert.equal(lines[1].eingriff.auto, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'tische', 'x1.json'), 'utf8')), { pfad: dir });
});
test('eintrag rejects unknown art', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw2-'));
  assert.throws(() => eintrag(dir, { runde: 1, von: 'a', art: 'quatsch', text: '' }));
});
