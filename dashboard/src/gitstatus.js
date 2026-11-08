'use strict';
const { execFile } = require('node:child_process');

function command(run, dir, args) {
  return new Promise((resolve, reject) => run('git', args, { cwd: dir, timeout: 3000, windowsHide: true, encoding: 'utf8' }, (error, stdout) => error ? reject(error) : resolve(String(stdout || ''))));
}

async function readGitStatus(dir, run = execFile) {
  try {
    const status = await command(run, dir, ['status', '--porcelain']);
    const changed = status.split(/\r?\n/).filter(Boolean).length;
    let ahead = null, behind = null;
    try {
      const counts = (await command(run, dir, ['rev-list', '--left-right', '--count', 'HEAD...@{u}'])).trim().split(/\s+/).map(Number);
      if (counts.length === 2 && counts.every(Number.isFinite)) [ahead, behind] = counts;
    } catch {}
    const lastCommit = (await command(run, dir, ['log', '-1', '--format=%cI'])).trim() || null;
    return { changed, ahead, behind, lastCommit };
  } catch { return null; }
}

module.exports = { readGitStatus };
