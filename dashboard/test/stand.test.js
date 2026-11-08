'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readStand, appendStand } = require('../src/stand');

test('stand appends dated handovers and reads only the last 30 lines', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'council-stand-'));
  try {
    appendStand(dir, 'code', 'done\nopen', new Date('2026-10-25T10:00:00Z'));
    assert.equal(readStand(dir, 'code'), '## 2026-10-25T10:00:00.000Z\ndone\nopen');
    fs.appendFileSync(path.join(dir, 'bereiche', 'code.stand.md'), Array.from({ length: 40 }, (_, i) => `line${i}`).join('\n'));
    const lines = readStand(dir, 'code').split('\n'); assert.equal(lines.length, 30); assert.equal(lines[0], 'line10');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('stand rejects path traversal and invalid text', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'council-stand-'));
  try { assert.throws(() => readStand(dir, '../secret'), /invalid area id/); assert.throws(() => appendStand(dir, 'x/y', 'no'), /invalid area id/); assert.equal(appendStand(dir, 'x', ''), false); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
