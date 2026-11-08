'use strict';
const fs = require('fs');
const path = require('path');
const VALID = new Set(['kevin', 'claude', 'grok-4.7', 'codex']);
function fileFor(dir, id) { const safe = path.basename(String(id || '')); if (!safe || safe !== String(id)) throw new Error('invalid area id'); return path.join(dir, 'logs', `chat-${safe}.jsonl`); }
function appendChat(dir, bereichId, entry) {
  if (!entry || !VALID.has(entry.von) || typeof entry.text !== 'string') return;
  const file = fileFor(dir, bereichId); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ ts: entry.ts || new Date().toISOString(), von: entry.von, text: entry.text.slice(0, 12000) }) + '\n', 'utf8');
}
function readChat(dir, bereichId, limit = 20) {
  const file = fileFor(dir, bereichId); let lines; try { lines = fs.readFileSync(file, 'utf8').split(/\r?\n/); } catch { return []; }
  const rows = []; for (const line of lines) try { const x = JSON.parse(line); if (VALID.has(x.von) && typeof x.text === 'string' && typeof x.ts === 'string') rows.push(x); } catch {}
  return rows.slice(-Math.max(0, Number(limit) || 0));
}
module.exports = { appendChat, readChat };
