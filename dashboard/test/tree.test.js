const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { parseEventLines } = require('../src/events');
const { assignExternal } = require('../src/sessions');
const { groupOf, buildTree, GROUPS } = require('../src/tree');
const { events } = parseEventLines(readFileSync(join(__dirname, 'fixtures', 'sessions', 'events.jsonl'), 'utf8'));
const NOW = new Date('2026-10-20T10:10:00Z');
const ext = assignExternal(events);

test('group names and order', () => {
  assert.deepEqual(GROUPS, ['Suchen & Lesen', 'Bauen', 'Ausführen', 'Browser', 'Sonstiges']);
});

test('groupOf picks the main activity', () => {
  assert.equal(groupOf(['Grep', 'Read', 'Read']), 'Suchen & Lesen');
  assert.equal(groupOf(['Write', 'Edit', 'PowerShell']), 'Bauen');
  assert.equal(groupOf(['Bash']), 'Ausführen');
  assert.equal(groupOf(['mcp__claude-in-chrome__navigate']), 'Browser');
  assert.equal(groupOf(['Read', 'Write']), 'Suchen & Lesen');
  assert.equal(groupOf([]), 'Sonstiges');
  assert.equal(groupOf(['TodoWrite']), 'Sonstiges');
});

test('tree for one session', () => {
  const t = buildTree(events, { session: 's1', title: 'Video-Kreation', now: NOW, externalSession: ext });
  assert.equal(t.opus.title, 'Video-Kreation');
  assert.equal(t.opus.status, 'arbeitet');
  assert.equal(t.opus.activity, 'delegiert an haiku: example');
  assert.deepEqual(t.external.map(e => e.agent), ['codex', 'grok-4.7', 'grok-4.7-build-fast']);
  const codex = t.external[0];
  assert.equal(codex.status, 'fertig'); assert.equal(codex.durationMs, 27000); assert.deepEqual(codex.tokens, { in: 1000, out: 50, provider: 'openai' });
  assert.equal(t.external[1].status, 'wartet');
  assert.deepEqual(t.groups.map(g => g.name), ['Suchen & Lesen', 'Bauen', 'Browser']);
  const search = t.groups[0];
  assert.equal(search.hidden, 1);
  assert.equal(search.members.length, 1);
  assert.equal(search.members[0].label, 'Haiku #2');
  assert.equal(search.members[0].status, 'arbeitet');
  assert.equal(search.members[0].durationMs, 239000);
  assert.equal(search.members[0].activity, 'liest C:/work/c.txt');
  const build = t.groups[1].members[0];
  assert.equal(build.label, 'Sonnet #1'); assert.equal(build.status, 'fertig'); assert.equal(build.durationMs, 60000);
  assert.equal(t.groups[2].members[0].label, 'Browser #1');
});

test('tree for all sessions', () => {
  const t = buildTree(events, { session: null, title: null, now: NOW, externalSession: ext });
  assert.equal(t.opus.sessions, 1);
  assert.equal(t.external[1].agent, 'grok-4.7');
  assert.equal(t.external[1].status, 'arbeitet');
  assert.equal(t.groups[0].members[0].label, 'Haiku #2');
});

test('session s2 has no sub-agents and only waiting externals', () => {
  const t = buildTree(events, { session: 's2', title: 'CRM', now: NOW, externalSession: ext });
  assert.deepEqual(t.groups, []);
  assert.ok(t.external.every(e => e.status === 'wartet'));
  assert.equal(t.opus.status, 'unbekannt');
});

test('one worker = one node: browser/other events of the same run merge into the real agent', () => {
  const ev = (t, agent, type, tool, run = 'agent-h') => ({ ts: `2026-10-20T10:0${t}:00.000Z`, agent, run, type, text: tool || type,
    detail: tool ? { tool } : null, tokens: null, session: 's9', parent: 'opus' });
  const list = [ev(1, 'haiku', 'start'), ev(2, 'other', 'step', 'ToolSearch'), ev(3, 'browser', 'step', 'mcp__claude-in-chrome__navigate'),
    ev(4, 'haiku', 'step', 'mcp__claude-in-chrome__get_page_text'),
    { ts: '2026-10-20T10:05:00.000Z', agent: 'opus', run: 's9', type: 'step', text: 'Browser: navigate',
      detail: { tool: 'mcp__claude-in-chrome__navigate' }, tokens: null, session: 's9', parent: null }];
  const t = buildTree(list, { session: 's9', title: 'x', now: NOW });
  assert.deepEqual(t.groups.map(g => [g.name, g.members.map(m => m.label)]), [['Browser', ['Haiku #1']]]);
  assert.equal(t.opus.browserSteps, 1);
});
