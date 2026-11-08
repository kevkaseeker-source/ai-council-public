const fs = require('node:fs');

function readNew(file, offset) {
  try {
    const size = fs.statSync(file).size;
    const start = size < offset ? 0 : offset;
    const fd = fs.openSync(file, 'r');
    try { const b = Buffer.alloc(size - start); fs.readSync(fd, b, 0, b.length, start); return { text: b.toString('utf8'), offset: size }; }
    finally { fs.closeSync(fd); }
  } catch (e) { if (e.code === 'ENOENT') return { text: '', offset: 0 }; throw e; }
}

function oldLogs(fileNames, now, days = 14) {
  const cutoff = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - days * 86400000;
  return fileNames.filter(name => {
    const m = /^events-(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(name);
    return m && Date.parse(m[1] + 'T00:00:00Z') < cutoff;
  });
}

module.exports = { readNew, oldLogs };
