'use strict';

const fs = require('node:fs');

function readBuffer(file, maxBytes, fromEnd) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    const start = fromEnd ? Math.max(0, size - maxBytes) : 0;
    const length = Math.min(size - start, maxBytes);
    const buffer = Buffer.alloc(length);
    let offset = 0;
    while (offset < length) {
      const n = fs.readSync(fd, buffer, offset, length - offset, start + offset);
      if (!n) break;
      offset += n;
    }
    return { text: buffer.subarray(0, offset).toString('utf8'), start };
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function textBlocks(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter(block => block && block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text).join('\n');
}

function readHistory(file, { maxBytes = 1500000, limit = 40 } = {}) {
  const data = readBuffer(file, Math.max(0, Number(maxBytes) || 0), true);
  if (!data) return [];
  let lines = data.text.split(/\r?\n/);
  if (data.start > 0) lines.shift();
  const messages = [];
  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry || entry.isSidechain === true || entry.isMeta === true) continue;
    if (entry.type !== 'user' && entry.type !== 'assistant') continue;
    const content = entry.message && entry.message.content;
    let text = textBlocks(content);
    if (entry.type === 'user') text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
    if (!text.trim()) continue;
    if (text.length > 4000) text = text.slice(0, 4000) + '…';
    messages.push({ role: entry.type, text, ts: entry.timestamp });
  }
  const count = Math.max(0, Number(limit) || 0);
  return count ? messages.slice(-count) : [];
}

function readCwd(file) {
  const data = readBuffer(file, 65536, false);
  if (!data) return null;
  for (const line of data.text.split(/\r?\n/)) {
    try {
      const entry = JSON.parse(line);
      if (entry && typeof entry.cwd === 'string') return entry.cwd;
    } catch { /* Ignore malformed lines. */ }
  }
  return null;
}

module.exports = { readHistory, readCwd };
