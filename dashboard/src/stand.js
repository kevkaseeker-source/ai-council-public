'use strict';
const fs = require('node:fs');
const path = require('node:path');

function fileFor(dir, id) {
  const safe = path.basename(String(id || ''));
  if (!safe || safe !== String(id) || !/^[A-Za-z0-9_-]+$/.test(safe)) throw new Error('invalid area id');
  return path.join(dir, 'bereiche', `${safe}.stand.md`);
}

function readStand(dir, id) {
  let text;
  try { text = fs.readFileSync(fileFor(dir, id), 'utf8'); } catch (e) { if (e.code === 'ENOENT') return ''; throw e; }
  return text.split(/\r?\n/).slice(-30).join('\n').trim();
}

function appendStand(dir, id, text, now = new Date()) {
  if (typeof text !== 'string' || !text.trim()) return false;
  const file = fileFor(dir, id); fs.mkdirSync(path.dirname(file), { recursive: true });
  const prior = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\s*$/, '\n\n') : '';
  fs.appendFileSync(file, `${prior}## ${now.toISOString()}\n${text.trim().slice(0, 12000)}\n`, 'utf8');
  return true;
}

module.exports = { readStand, appendStand };
