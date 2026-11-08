#!/usr/bin/env node
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { appendStand } = require('../../dashboard/src/stand.js');
const [id, ...parts] = process.argv.slice(2);
const text = parts.join(' ');
if (!id || !text.trim()) {
  console.error('Usage: node tools/stand/stand.mjs <bereich> <text>');
  process.exitCode = 2;
} else {
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    appendStand(root, id, text);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
