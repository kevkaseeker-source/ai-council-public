// Builds a realistic but synthetic Council state for the UI preview (no real logs, no private data).
// Usage: node dashboard/preview/make-state.js > dashboard/preview/state.json
const fs = require('fs');
const path = require('path');
const { parseEventLines } = require('../src/events');
const { assignExternal } = require('../src/sessions');
const { buildTree } = require('../src/tree');
const { parseLearning, buildGraph } = require('../src/graph');

const root = path.join(__dirname, '..', '..');
const { events } = parseEventLines(fs.readFileSync(path.join(__dirname, '..', 'test', 'fixtures', 'sessions', 'events.jsonl'), 'utf8'));
const now = new Date('2026-10-20T10:10:00Z');
const externalSession = assignExternal(events);
const area = { id: 'staex', label: 'Staex', icon: '🏢' };
const sessions = [
  { sessionId: 's1', title: '🏢 Video-Kreation mit Google Flow', active: true, lastTs: '2026-10-20T10:09:30.000Z', cwd: 'G:/Drive/staex all 2026', area, hidden: false },
  { sessionId: 's2', title: '🏢 CRM und Produkt', active: false, lastTs: '2026-10-20T09:01:00.000Z', cwd: 'G:/Drive/staex all 2026', area, hidden: false },
];
const trees = { '*': buildTree(events, { session: null, title: 'Alle', now, externalSession }) };
for (const s of sessions) trees[s.sessionId] = buildTree(events, { session: s.sessionId, title: s.title, now, externalSession });
// one working external worker so the green state is visible
trees.s1.external[0] = { ...trees.s1.external[0], status: 'arbeitet', activity: 'schreibt media/graph.js', durationMs: 32000 };

const learnings = fs.readdirSync(path.join(root, 'learnings')).filter(f => f.endsWith('.md'))
  .map(f => parseLearning(fs.readFileSync(path.join(root, 'learnings', f), 'utf8'), f));
const newKeys = learnings.filter(l => l.date === '2026-10-20').map(l => l.key).slice(0, 5);
const learningsList = learnings.map(l => ({ key: l.key, type: l.type, worker: l.worker, arbeitsfeld: l.arbeitsfeld, date: l.date,
  isNew: newKeys.includes(l.key), summary: String(l.body || '').replace(/\s+/g, ' ').slice(0, 220) }));

const state = {
  type: 'state', agents: {
    opus: { agent: 'opus', status: 'arbeitet', activity: 'plant das Universum' },
    codex: { agent: 'codex', status: 'arbeitet', activity: 'baut universe.js' },
    'grok-4.7': { agent: 'grok-4.7', status: 'fertig', activity: 'Review' },
    'grok-4.7-build-fast': { agent: 'grok-4.7-build-fast', status: 'wartet', activity: null },
    haiku: { agent: 'haiku', status: 'arbeitet', activity: 'liest X-Posts' },
    browser: { agent: 'browser', status: 'wartet', activity: null },
    sonnet: { agent: 'sonnet', status: 'wartet', activity: null },
  }, skipped: 0, sessions, trees,
  log: events.map(e => ({ ...e, session: e.session || externalSession.get(e.run) || null })),
  graph: buildGraph(learnings), notes: [], newKeys, learningsList,
  history: [], historyInfo: null, areaFilter: 'alle',
  folders: { current: { path: 'G:/Drive/staex all 2026', area }, favorites: [], recent: [], privateHidden: true, revealed: false },
  today: { openai: 146000, xai: 0, anthropic: 12000 },
};
state.universe = require('../src/universe').buildUniverse({
  bereiche: [
    { id: 'projekt-a', label: 'Projekt A', farbe: '#3b82f6', profil: 'code', status: 'aktiv', extern: true, pfade: ['C:/demo/projekt-a'], werkzeuge: [{ name: 'Dokumentation', url: 'https://example.org/docs' }], nutzt: [{ bereich: 'content', was: 'Kampagnentexte' }], ziele: [] },
    { id: 'content', label: 'Content', farbe: '#8b5cf6', profil: 'social-content', status: 'aktiv', extern: true, pfade: ['C:/demo/content'], ziele: [] },
  ],
  profile: require('../src/bereiche').loadProfiles(path.join(root, 'profile')),
  learnings,
  agents: state.agents,
  agentCwd: { opus: 'C:/demo/projekt-a', codex: 'C:/demo/projekt-a', haiku: 'C:/demo/content' },
  opusInstances: [
    { session: 'demo-opus-public', status: 'arbeitet', activity: 'prüft die Vorschau', cwd: 'C:/demo/projekt-a', hidden: false },
    { session: 'demo-opus-private', status: 'arbeitet', activity: null, cwd: null, hidden: true },
  ],
  git: { changed: 3, ahead: 2, behind: 1, lastCommit: '2026-10-24T16:30:00+02:00' },
  syncByProfile: { code: 2, 'social-content': 1 },
  ordner: { 'b:content': [{ id: 'o:content/kampagne', label: 'kampagne', files: 9 }, { id: 'o:content/woche1', label: 'woche1', files: 24 }, { id: 'o:content/paket_02', label: 'paket_02', files: 6 }] },
  windowArea: { id: 'kevin' },
  revealed: false,
});
process.stdout.write(JSON.stringify(state));
