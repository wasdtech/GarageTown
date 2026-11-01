// Fails when the client's built assets exceed the 3 MB budget (spec §0.5).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LIMIT = 3 * 1024 * 1024;
const dir = process.argv[2] ?? 'apps/client/dist';
const walk = (d) =>
  readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const total = walk(dir).reduce((sum, f) => sum + statSync(f).size, 0);
console.log(`bundle: ${(total / 1024).toFixed(0)} KB / ${(LIMIT / 1024).toFixed(0)} KB`);
if (total > LIMIT) process.exit(1);
