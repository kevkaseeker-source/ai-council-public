const { test } = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { loadProfiles, loadBereiche } = require('../src/bereiche');
const fx = join(__dirname, 'fixtures');

test('loadBereiche fills defaults and skips broken files', () => {
  const b = loadBereiche(join(fx, 'bereiche'));
  assert.equal(b.length, 1);
  assert.deepEqual(b[0], { id: 'alpha', label: 'Alpha', profil: 'code', status: 'aktiv', extern: true, pfade: ['C:/work/alpha'], ziele: [{ text: 'Ziel 1', pruefen: 'woechentlich' }] });
});

test('loadProfiles defaults bausteine', () => {
  const p = loadProfiles(join(fx, 'profile'));
  assert.deepEqual(p, [{ id: 'code', label: 'Code', rollen: { bauen: 'codex', pruefen: 'grok-4.7' }, bausteine: [] }]);
});

test('missing folder gives empty list', () => {
  assert.deepEqual(loadBereiche(join(fx, 'gibtsnicht')), []);
  assert.deepEqual(loadProfiles(join(fx, 'gibtsnicht')), []);
});

test('loadBereiche keeps the colour field', () => {
  const dir = require('node:fs').mkdtempSync(join(require('node:os').tmpdir(), 'b-'));
  require('node:fs').writeFileSync(join(dir, 'c.json'), JSON.stringify({ id: 'c', farbe: '#8b5cf6' }));
  assert.equal(loadBereiche(dir)[0].farbe, '#8b5cf6');
});

test('loadBereiche passes through tools, uses, chat and explicit context', () => {
  const dir = require('node:fs').mkdtempSync(join(require('node:os').tmpdir(), 'b-'));
  require('node:fs').writeFileSync(join(dir, 'c.json'), JSON.stringify({ id: 'c', werkzeuge: [{ name: 'Docs', url: 'https://example.test' }, { name: 'Bad', url: 'http://example.test' }], nutzt: [{ bereich: 'a', was: 'Daten' }], chat: 'grok-4.7', chatKontext: ['public.md'] }));
  const b = loadBereiche(dir)[0];
  assert.deepEqual(b.werkzeuge, [{ name: 'Docs', url: 'https://example.test' }]);
  assert.deepEqual(b.nutzt, [{ bereich: 'a', was: 'Daten' }]);
  assert.equal(b.chat, 'grok-4.7'); assert.deepEqual(b.chatKontext, ['public.md']);
});
