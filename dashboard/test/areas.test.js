const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_AREAS, normalize, classify, applyPrivacy, folderList } = require('../src/areas');

const STAEX = 'G:\\.shortcut-targets-by-id\\ABC\\staex all 2026';
const KEVIN = "G:\\Meine Ablage\\Kevin's stuff";
const PRIV = 'C:\\Users\\kevka\\council';

test('default areas in priority order', () => {
  assert.deepEqual(DEFAULT_AREAS.map(a => a.id), ['kevin', 'staex', 'privat']);
  for (const a of DEFAULT_AREAS) { assert.ok(a.label && a.icon && Array.isArray(a.match)); }
});

test('normalize: forward slashes, lower case, no trailing slash', () => {
  assert.equal(normalize('G:\\Foo\\Bar\\'), 'g:/foo/bar');
  assert.equal(normalize(null), '');
});

test('classify by first matching area', () => {
  assert.equal(classify(STAEX).id, 'staex');
  assert.equal(classify(STAEX + '\\01_Sales').id, 'staex');
  assert.equal(classify(KEVIN + '\\RoboPay').id, 'kevin');
  assert.equal(classify(PRIV).id, 'privat');
  assert.equal(classify('D:\\other').id, 'unbekannt');
  assert.equal(classify(null).id, 'unbekannt');
  assert.equal(classify('X:\\y', [{ id: 'x', label: 'X', icon: 'x', match: ['x:/'] }]).id, 'x');
});

const sessions = [
  { sessionId: 's1', title: 'Video-Kreation', cwd: STAEX, active: true, lastTs: 't3' },
  { sessionId: 's2', title: 'RoboPay Wallet', cwd: KEVIN + '\\RoboPay', active: false, lastTs: 't2' },
  { sessionId: 's3', title: 'Council Dashboard', cwd: PRIV, active: true, lastTs: 't1' },
  { sessionId: 's4', title: 'Neue Sitzung', cwd: null, active: false, lastTs: 't0' },
];

test('applyPrivacy in a Staex window hides private titles and cwd unless revealed', () => {
  const out = applyPrivacy(sessions, classify(STAEX), { revealed: false, areaFilter: 'alle' });
  assert.deepEqual(out.map(s => s.sessionId), ['s1', 's2', 's3', 's4']);
  assert.equal(out[0].title, 'Video-Kreation'); assert.equal(out[0].hidden, false); assert.equal(out[0].area.id, 'staex');
  for (const s of [out[1], out[2]]) { assert.equal(s.hidden, true); assert.equal(s.title, '🔒 Privat'); assert.equal(s.cwd, null); }
  assert.equal(out[3].hidden, false); assert.equal(out[3].area.id, 'unbekannt');
  const shown = applyPrivacy(sessions, classify(STAEX), { revealed: true, areaFilter: 'alle' });
  assert.equal(shown[1].title, 'RoboPay Wallet'); assert.equal(shown[1].hidden, false);
});

test('applyPrivacy in a private window hides nothing', () => {
  const out = applyPrivacy(sessions, classify(PRIV), { revealed: false, areaFilter: 'alle' });
  assert.ok(out.every(s => !s.hidden));
});

test('applyPrivacy area filter: staex / privat (privat = kevin + privat)', () => {
  const st = applyPrivacy(sessions, classify(PRIV), { revealed: false, areaFilter: 'staex' });
  assert.deepEqual(st.map(s => s.sessionId), ['s1']);
  const pr = applyPrivacy(sessions, classify(PRIV), { revealed: false, areaFilter: 'privat' });
  assert.deepEqual(pr.map(s => s.sessionId), ['s2', 's3']);
});

test('folderList: current, favorites, recent (deduplicated, private recent hidden in Staex window)', () => {
  const favs = [STAEX, KEVIN, PRIV];
  const l = folderList({ workspacePath: STAEX, favorites: favs, sessions, revealed: false });
  assert.equal(l.current.path, STAEX); assert.equal(l.current.area.id, 'staex');
  assert.deepEqual(l.favorites.map(f => f.path), favs);
  assert.ok(l.favorites.every(f => f.favorite === true));
  assert.deepEqual(l.recent.map(f => f.path), []);
  assert.equal(l.privateHidden, true);
  const r = folderList({ workspacePath: STAEX, favorites: [STAEX], sessions, revealed: true });
  assert.deepEqual(r.recent.map(f => f.path), [KEVIN + '\\RoboPay', PRIV]);
  assert.equal(r.privateHidden, false);
  const none = folderList({ workspacePath: null, favorites: [], sessions: [], revealed: false });
  assert.equal(none.current, null);
});
