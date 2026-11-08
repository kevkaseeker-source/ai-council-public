// Test double for a worker CLI: drains stdin, prints the fixture file given as argv[2], exits with argv[3] (default 0).
import { readFileSync } from 'node:fs';
process.stdin.resume();
process.stdin.on('end', () => {
  process.stdout.write(readFileSync(process.argv[2], 'utf8'));
  process.exitCode = Number(process.argv[3] ?? 0);
});
