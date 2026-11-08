const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chatAgentFor, buildPrompt, textFromJsonl, chatOptions, parseHandoffs, allowedAgent } = require('../src/chat');
test('chat agent respects privacy and override, then chooses Grok profile', () => {
  assert.equal(chatAgentFor({ extern: false, chat: 'grok-4.7' }, {}), 'claude');
  assert.equal(chatAgentFor({ extern: true, chat: 'claude' }, {}), 'claude');
  assert.equal(chatAgentFor({ extern: true }, { rollen: { 'texte-entwerfen': 'grok-4.7' } }), 'grok-4.7');
});
test('prompt keeps last six messages and includes explicit context', () => {
  const p = buildPrompt({ bereich: { label: 'Bereich' }, kontext: [{ path: 'public.txt', text: 'Öffentlich' }], verlauf: Array.from({ length: 8 }, (_, i) => ({ role: 'user', text: String(i) })), text: 'Neu' });
  assert.match(p, /Öffentlich/); assert.match(p, /Neu/); assert.doesNotMatch(p, /\n0\n/);
});
test('JSONL text chunks are extracted', () => assert.equal(textFromJsonl('{"type":"text","data":"Hallo"}\n{"type":"text","data":" Welt"}\n{"type":"item.completed","item":{"type":"agent_message","text":" Codex"}}'), 'Hallo Welt Codex'));
test('chat options enforce privacy, pause, and configured restrictions', () => {
  assert.deepEqual(chatOptions({ extern: false }, {}), ['claude']);
  assert.deepEqual(chatOptions({ status: 'pause' }, {}), []);
  assert.deepEqual(chatOptions({ chatOptions: ['codex', 'bad', 'claude'] }, {}), ['claude', 'codex']);
  assert.deepEqual(chatOptions({}, {}), ['claude', 'grok-4.7', 'codex']);
  assert.equal(allowedAgent({ extern: false }, {}, 'codex'), false);
});
test('handoffs parse aliases only for allowed agents and bound task length', () => {
  assert.deepEqual(parseHandoffs('@grok: Prüfe\n@codex: Baue\n@claude: Hilf', ['grok-4.7', 'codex']), [
    { agent: 'grok-4.7', auftrag: 'Prüfe' }, { agent: 'codex', auftrag: 'Baue' }
  ]);
  assert.deepEqual(parseHandoffs('@codex: ' + 'x'.repeat(2001), ['codex']), []);
});
test('prompt uses named council transcript and team', () => {
  const p = buildPrompt({ bereich: { label: 'Alpha' }, agent: 'codex', options: ['claude', 'codex'], team: ['Claude', 'Codex'], verlauf: [{ von: 'grok-4.7', text: 'Idee' }], text: 'Weiter' });
  assert.match(p, /Codex im Council/); assert.match(p, /Team: Claude, Codex/); assert.match(p, /Grok 4\.7: Idee/); assert.match(p, /@<agent>/);
});
