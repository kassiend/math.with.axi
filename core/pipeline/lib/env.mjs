/**
 * Read `.env` at the repository root. Nothing here is exported to process.env — callers ask for
 * the one key they need, so a secret never leaks into a child process that did not ask for it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.mjs';

let cache = null;

export function envValue(key) {
  if (process.env[key] != null) return process.env[key];
  if (!cache) {
    cache = {};
    const file = path.join(ROOT, '.env');
    if (fs.existsSync(file)) {
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const i = t.indexOf('=');
        if (i > 0) cache[t.slice(0, i).trim()] = t.slice(i + 1).trim();
      }
    }
  }
  return cache[key];
}
