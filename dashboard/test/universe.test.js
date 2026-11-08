const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildUniverse } = require('../src/universe');

const profile = [
  { id: 'code', label: 'Code', rollen: { bauen: 'codex', pruefen: 'opus', suche: 'haiku' }, bausteine: [] },
];
const bereiche = [
  { id: 'alpha', label: 'Alpha', profil: 'code', status: 'aktiv', extern: true, pfade: ['G:/Meine Ablage/Kevin\'s stuff/alpha'], ziele: [] },
  { id: 'firma', label: 'Firma', profil: 'code', status: 'aktiv', extern: false, pfade: ['G:/Staex All 2026/x'], ziele: [] },
  { id: 'ruhe', label: 'Ruhe', profil: null, status: 'pause', extern: true, pfade: [], ziele: [] },
];
const learnings = [
  { key: 'k1', bereich: 'code', confidence: 8, date: '2000-01-01', body: '' },
  { key: 'k2', bereich: 'alle', confidence: null, date: '2000-01-01', body: '' },
];
const agents = {
  opus: { agent: 'opus', status: 'arbeitet', activity: 'plant' },
  codex: { agent: 'codex', status: 'arbeitet', activity: 'baut universe.js' },
  haiku: { agent: 'haiku', status: 'fertig', activity: 'sucht' },
  other: { agent: 'other', status: 'wartet', activity: null },
};
const agentCwd = { opus: 'G:/Meine Ablage/Kevin\'s stuff/alpha/sub', codex: 'G:/Meine Ablage/Kevin\'s stuff/alpha' };
const ids = u => u.nodes.map(n => n.id).sort();
const node = (u, id) => u.nodes.find(n => n.id === id);

test('round table node appears only when sessions exist', () => {
  assert.equal(buildUniverse({}).nodes.some(n => n.id === 'tisch'), false);
  const u = buildUniverse({ tische: [{ id: 'a', titel: 'T', datum: '2026-10-26' }] });
  const n = u.nodes.find(x => x.id === 'tisch');
  assert.equal(n.kind, 'tisch'); assert.equal(n.detail.anzahl, 1);
  assert.ok(u.links.some(l => l.source === 'tisch' && l.target === 'council'));
  assert.equal(n.group, 'tisch');
  const s = u.nodes.find(x => x.id === 't:a'); assert.equal(s.kind, 'tischsitzung'); assert.equal(s.group, 'tisch'); assert.equal(s.detail.id, 'a');
  assert.ok(u.links.some(l => l.source === 't:a' && l.target === 'tisch'));
});

test('council repo core has the live agents around it', () => {
  const u = buildUniverse({ bereiche, profile, learnings, agents, agentCwd, windowArea: { id: 'kevin' }, revealed: false });
  assert.deepEqual(ids(u).filter(id => !id.startsWith('t:')), ['a:codex', 'a:haiku', 'a:opus', 'b:alpha', 'b:firma', 'b:ruhe', 'council', 'l:k1', 'l:k2']);
  const opus = node(u, 'council');
  assert.equal(opus.kind, 'kern'); assert.equal(opus.label, 'Council-Repo');
  assert.equal(node(u, 'a:codex').family, 'openai');
  assert.equal(node(u, 'a:codex').activity, 'baut universe.js');
  assert.equal(node(u, 'a:haiku').status, 'fertig');
  assert.ok(u.links.some(l => l.source === 'a:codex' && l.target === 'council' && l.kind === 'team'));
  assert.equal(node(u, 'b:ruhe').paused, true);
});

test('working agents get a task link to their area', () => {
  const u = buildUniverse({ bereiche, profile, learnings, agents, agentCwd, windowArea: { id: 'kevin' }, revealed: false });
  const tasks = u.links.filter(l => l.kind === 'task').map(l => `${l.source}>${l.target}`).sort();
  assert.deepEqual(tasks, ['a:codex>t:alpha:codex', 'a:opus>t:alpha:opus']);
});

test('agent detail lists its roles per area, external workers not in extern:false areas', () => {
  const u = buildUniverse({ bereiche, profile, learnings, agents, agentCwd, windowArea: { id: 'kevin' }, revealed: false });
  assert.deepEqual(node(u, 'a:codex').detail.rollen, [{ bereich: 'Alpha', rollen: ['bauen'] }]);
  assert.deepEqual(node(u, 'a:haiku').detail.rollen, [{ bereich: 'Alpha', rollen: ['suche'] }, { bereich: 'Firma', rollen: ['suche'] }]);
});

test('learnings hang on areas of their profile, else on the council', () => {
  const u = buildUniverse({ bereiche, profile, learnings, agents, agentCwd, windowArea: { id: 'kevin' }, revealed: false });
  assert.deepEqual(u.links.filter(l => l.source === 'l:k1').map(l => l.target).sort(), ['b:alpha', 'b:firma']);
  assert.deepEqual(u.links.filter(l => l.source === 'l:k2').map(l => l.target), ['council']);
});

test('company window hides private areas, their tasks and task texts', () => {
  const u = buildUniverse({ bereiche, profile, learnings, agents, agentCwd, windowArea: { id: 'staex' }, revealed: false });
  assert.ok(ids(u).includes('privat'));
  assert.ok(!ids(u).includes('b:alpha'));
  assert.equal(node(u, 'a:codex').activity, null);
  assert.ok(u.links.some(l => l.source === 'a:codex' && l.target === 'privat' && l.kind === 'task'));
  const s = JSON.stringify(u);
  assert.equal(s.includes('Alpha'), false);
  assert.equal(s.includes('universe.js'), false);
});

test('area with a later private path is hidden too', () => {
  const mixed = [{ id: 'mix', label: 'Gemischt', profil: 'code', status: 'aktiv', extern: true, pfade: ['G:/Staex All 2026/a', 'C:/Users/x/geheim'], ziele: [{ text: 'Geheimziel' }] }];
  const u = buildUniverse({ bereiche: mixed, profile, learnings: [], agents: {}, windowArea: { id: 'staex' }, revealed: false });
  assert.deepEqual(ids(u), ['a:opus', 'council', 'privat']);
  assert.equal(JSON.stringify(u).includes('Geheimziel'), false);
});

test('revealed shows private areas again', () => {
  const u = buildUniverse({ bereiche, profile, learnings, agents, agentCwd, windowArea: { id: 'staex' }, revealed: true });
  assert.ok(ids(u).includes('b:alpha'));
  assert.ok(!ids(u).includes('privat'));
});

test('no areas and no events still gives Opus and learnings', () => {
  const u = buildUniverse({ bereiche: [], profile: [], learnings, agents: {}, windowArea: { id: 'kevin' }, revealed: false });
  assert.deepEqual(ids(u), ['a:opus', 'council', 'l:k1', 'l:k2']);
  assert.equal(node(u, 'a:opus').status, 'wartet');
});

test('opened folders hang under their area, never under hidden areas', () => {
  const ordner = { 'b:alpha': [{ id: 'o:alpha/sub', label: 'sub', files: 3 }], 'o:alpha/sub': [{ id: 'o:alpha/sub/deep', label: 'deep', files: 1 }] };
  const u = buildUniverse({ bereiche, profile, learnings: [], agents: {}, ordner, windowArea: { id: 'kevin' }, revealed: false });
  assert.equal(node(u, 'o:alpha/sub').kind, 'ordner');
  assert.equal(node(u, 'o:alpha/sub').group, 'alpha');
  assert.ok(u.links.some(l => l.source === 'o:alpha/sub/deep' && l.target === 'o:alpha/sub' && l.kind === 'ordner'));
  const h = buildUniverse({ bereiche, profile, learnings: [], agents: {}, ordner, windowArea: { id: 'staex' }, revealed: false });
  assert.ok(!ids(h).some(id => id.startsWith('o:')));
});

test('each area shows its team; tasks beam to the team figure in area colour', () => {
  const coloured = bereiche.map(b => (b.id === 'alpha' ? { ...b, farbe: '#8b5cf6' } : b));
  const u = buildUniverse({ bereiche: coloured, profile, learnings: [], agents, agentCwd, windowArea: { id: 'kevin' }, revealed: false });
  assert.deepEqual(ids(u).filter(id => id.startsWith('t:')), ['t:alpha:codex', 't:alpha:haiku', 't:alpha:opus', 't:firma:haiku', 't:firma:opus']);
  assert.equal(node(u, 't:alpha:codex').status, 'arbeitet');
  assert.equal(node(u, 't:alpha:codex').activity, 'baut universe.js');
  assert.equal(node(u, 't:alpha:haiku').status, 'bereit');
  assert.equal(node(u, 'b:alpha').color, '#8b5cf6');
  const beam = u.links.find(l => l.kind === 'task' && l.source === 'a:codex');
  assert.equal(beam.target, 't:alpha:codex'); assert.equal(beam.color, '#8b5cf6');
  assert.ok(!ids(u).includes('t:ruhe:codex'));
  assert.deepEqual(node(u, 'b:alpha').detail.chat, { standard: 'claude', options: ['claude', 'grok-4.7', 'codex'] });
  assert.deepEqual(node(u, 'b:firma').detail.chat, { standard: 'claude', options: ['claude'] });
  assert.deepEqual(node(u, 'b:ruhe').detail.chat, { standard: null, options: [] });
});

test('a learning for several profiles is a bridge between zones', () => {
  const two = [{ ...bereiche[0] }, { id: 'web', label: 'Web', profil: 'social', status: 'aktiv', extern: true, pfade: [], ziele: [] }];
  const both = [{ key: 'b1', bereich: 'code, social', confidence: 7, date: '2000-01-01', body: '' }, { key: 'one', bereich: 'code', confidence: 7, date: '2000-01-01', body: '' }];
  const u = buildUniverse({ bereiche: two, profile, learnings: both, agents: {}, windowArea: { id: 'kevin' }, revealed: false });
  assert.equal(node(u, 'l:b1').bridge, true);
  assert.equal(node(u, 'l:one').bridge, undefined);
  assert.deepEqual(u.links.filter(l => l.source === 'l:b1').map(l => l.target).sort(), ['b:alpha', 'b:web']);
});

test('tools belong to active visible areas and browser agents get matching tool task targets', () => {
  const bs = [{ ...bereiche[0], pfade: ['C:/public'], werkzeuge: [{ name: 'Docs', url: 'https://docs.example.test/a' }], status: 'aktiv' }, { ...bereiche[1], pfade: ['G:/Staex private'] }];
  const u = buildUniverse({ bereiche: bs, profile, agents, agentCwd: { codex: bs[0].pfade[0] }, agentUrl: { codex: 'https://docs.example.test/x' }, windowArea: { id: 'staex' } });
  const tool = node(u, 'w:alpha:docs'); assert.equal(tool.kind, 'werkzeug'); assert.equal(tool.url, 'https://docs.example.test/a');
  assert.ok(u.links.some(l => l.kind === 'werkzeug' && l.source === tool.id && l.target === 'b:alpha'));
  assert.ok(u.links.some(l => l.kind === 'task' && l.source === 'a:codex' && l.target === tool.id));
  assert.equal(node(u, 'a:codex').url, 'https://docs.example.test/x');
  assert.equal(ids(u).some(id => id.startsWith('w:firma:')), false);
});

test('paused areas do not expose tool nodes', () => {
  const paused = [{ ...bereiche[2], werkzeuge: [{ name: 'Docs', url: 'https://docs.example.test' }] }];
  const u = buildUniverse({ bereiche: paused, profile: [], agents: {}, windowArea: { id: 'kevin' } });
  assert.equal(ids(u).some(id => id.startsWith('w:')), false);
});

test('fixed and detected flows merge, with hidden areas excluded', () => {
  const bs = [{ ...bereiche[0], nutzt: [{ bereich: 'firma', was: 'Datensatz' }] }, { ...bereiche[1], pfade: ['G:/Staex private'] }];
  const u = buildUniverse({ bereiche: bs, profile, agents: {}, flows: [{ from: 'alpha', to: 'firma', active: true }], windowArea: { id: 'staex' } });
  assert.deepEqual(u.links.filter(l => l.kind === 'fluss'), []);
  const v = buildUniverse({ bereiche: [{ ...bs[0], nutzt: [{ bereich: 'web', was: 'Daten' }] }, { id: 'web', label: 'Web', status: 'aktiv', pfade: [] }], profile: [], flows: [{ from: 'alpha', to: 'web', active: true }] });
  assert.deepEqual(v.links.filter(l => l.kind === 'fluss').map(l => [l.source, l.target, l.active, l.label]), [['b:alpha', 'b:web', true, 'Daten']]);
});

test('member role badge data identifies an assignment, not an agent', () => {
  const u = buildUniverse({ bereiche: [{ id: 'x', label: 'X', profil: 'p', status: 'aktiv', pfade: [] }], profile: [{ id: 'p', rollen: { pruefung: 'opus' } }], agents: {} });
  const m = u.nodes.find(n => n.kind === 'member');
  assert.equal(m.status, 'bereit'); assert.deepEqual(m.detail.rollen, ['pruefung']);
  assert.match(m.detail.description, /kein eigener Agent/);
});

test('Opus instances have separate task beams and private instances reveal no task', () => {
  const u = buildUniverse({ bereiche, profile, agents, opusInstances: [
    { session: 'one', status: 'arbeitet', activity: 'visible task', cwd: bereiche[0].pfade[0], hidden: false },
    { session: 'secret', status: 'arbeitet', activity: null, cwd: null, hidden: true },
  ], windowArea: { id: 'kevin' } });
  const instance = node(u, 'o:secret'); assert.equal(instance.label, '🔒 Privat');
  assert.ok(!u.links.some(l => l.source === 'o:secret' && l.kind === 'task'));
  assert.ok(u.links.some(l => l.source === 'o:one' && l.kind === 'task' && l.target === 't:alpha:opus'));
  assert.equal(JSON.stringify(u).includes('visible task'), true);
  assert.equal(JSON.stringify(u).includes('secret task'), false);
});

test('recent learning counts become sync links to visible profile areas', () => {
  const u = buildUniverse({ bereiche, profile, learnings: [], syncByProfile: { code: 2 }, git: { changed: 1, ahead: 2, behind: 0, lastCommit: '2026-10-25' } });
  assert.deepEqual(u.links.filter(l => l.kind === 'sync').map(l => [l.source, l.target, l.label]), [
    ['council', 'b:alpha', '2 neue Erkenntnisse'], ['council', 'b:firma', '2 neue Erkenntnisse'],
  ]);
  assert.deepEqual(node(u, 'council').detail.git, { changed: 1, ahead: 2, behind: 0, lastCommit: '2026-10-25' });
});

