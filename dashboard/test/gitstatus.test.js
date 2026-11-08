'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readGitStatus } = require('../src/gitstatus');

test('readGitStatus returns local changes, upstream counts and commit date', async () => {
  const calls = [];
  const run = (file, args, options, cb) => { calls.push(args); cb(null, args[0] === 'status' ? ' M file\n?? new\n' : args[0] === 'rev-list' ? '2\t3\n' : '2026-10-25T10:00:00Z\n'); };
  assert.deepEqual(await readGitStatus('/repo', run), { changed: 2, ahead: 2, behind: 3, lastCommit: '2026-10-25T10:00:00Z' });
  assert.equal(calls.length, 3);
});

test('readGitStatus tolerates missing upstream and returns null on errors', async () => {
  const run = (file, args, options, cb) => args[0] === 'rev-list' ? cb(new Error('no upstream')) : cb(null, '');
  assert.deepEqual(await readGitStatus('/repo', run), { changed: 0, ahead: null, behind: null, lastCommit: null });
  assert.equal(await readGitStatus('/repo', (_f, _a, _o, cb) => cb(new Error('broken'))), null);
});
