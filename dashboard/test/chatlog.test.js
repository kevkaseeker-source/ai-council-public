const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { appendChat, readChat } = require('../src/chatlog');

test('chat log appends valid entries and reads the bounded tail past damaged lines', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'council-chatlog-'));
  try {
    for (let i = 0; i < 4; i++) appendChat(dir, 'alpha', { von: i ? 'claude' : 'kevin', text: String(i) });
    fs.appendFileSync(path.join(dir, 'logs', 'chat-alpha.jsonl'), 'broken\n');
    assert.deepEqual(readChat(dir, 'alpha', 2).map(x => x.text), ['2', '3']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
