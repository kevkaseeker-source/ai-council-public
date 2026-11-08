const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { parseLearning, buildGraph, isNew, noteFile, parseNote } = require('../src/graph');
const dir = join(__dirname, 'fixtures', 'learnings');
const load = f => parseLearning(readFileSync(join(dir, f), 'utf8'), f);

test('parseLearning', () => {
  const a = load('a.md');
  assert.equal(a.key, 'alpha-trick'); assert.equal(a.worker, 'codex'); assert.equal(a.arbeitsfeld, 'video'); assert.equal(a.bereich, 'alle'); assert.equal(a.confidence, 8);
  const c = load('c.md');
  assert.equal(c.key, 'c'); assert.equal(c.arbeitsfeld, 'allgemein');
  assert.match(a.body, /beta-pitfall/);
});

test('buildGraph nodes and edges', () => {
  const g = buildGraph(['a.md', 'b.md', 'c.md'].map(load));
  const ids = g.nodes.map(n => n.id).sort();
  assert.deepEqual(ids, ['f:allgemein', 'f:video', 'l:alpha-trick', 'l:beta-pitfall', 'l:c', 'w:codex', 'w:grok-4.7']);
  const has = (from, to, kind) => g.edges.some(e => e.from === from && e.to === to && e.kind === kind);
  assert.ok(has('l:alpha-trick', 'f:video', 'feld'));
  assert.ok(has('l:beta-pitfall', 'w:grok-4.7', 'worker'));
  assert.ok(has('l:alpha-trick', 'l:beta-pitfall', 'ref'));
  assert.ok(has('l:beta-pitfall', 'l:alpha-trick', 'ref'));
  assert.equal(new Set(g.edges.map(e => e.from + e.to + e.kind)).size, g.edges.length);
});

test('isNew', () => {
  assert.equal(isNew('2026-10-20', new Date('2026-10-20T15:00:00Z')), true);
  assert.equal(isNew('2026-10-18', new Date('2026-10-20T15:00:00Z')), false);
});

test('noteFile + parseNote roundtrip', () => {
  const n = noteFile('arbeitsfeld:Video & Schnitt!', 'Immer erst ein Testbild.', new Date('2026-10-20T15:00:00Z'));
  assert.equal(n.name, '2026-10-20-arbeitsfeld-video-schnitt.md');
  const p = parseNote(n.content, n.name);
  assert.equal(p.target, 'arbeitsfeld:Video & Schnitt!'); assert.equal(p.status, 'offen'); assert.equal(p.text, 'Immer erst ein Testbild.');
});
