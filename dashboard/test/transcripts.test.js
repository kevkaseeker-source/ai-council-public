const { test } = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { transcriptPath, readTranscript } = require('../src/transcripts');
const projects = join(__dirname, 'fixtures', 'projects');

// Fixture file is agent-0001.jsonl, i.e. agent id '0001' (real ids look like 'a93c…', file 'agent-a93c….jsonl').
test('transcriptPath finds sub-agent file', () => {
  assert.equal(transcriptPath(projects, 'session-0001', '0001'), join(projects, 'proj-a', 'session-0001', 'subagents', 'agent-0001.jsonl'));
  assert.equal(transcriptPath(projects, 'session-9999', '0001'), null);
});

test('readTranscript model, thoughts, tokens', () => {
  const t = readTranscript(transcriptPath(projects, 'session-0001', '0001'));
  assert.equal(t.model, 'haiku');
  assert.deepEqual(t.thoughts, ['first thought', 'second thought']);
  assert.deepEqual(t.tokens, { in: 150, out: 15, provider: 'anthropic' });
});

test('readTranscript missing file', () => {
  assert.deepEqual(readTranscript(join(projects, 'nope.jsonl')), { model: null, thoughts: [], tokens: null });
});
