// Thin runner around core/tools/elevenlabs.mjs `say()`.
// Exists only because that file's `import.meta.url === file://${process.argv[1]}` CLI guard
// never matches on Windows, so `node core/tools/elevenlabs.mjs say ...` exits 0 doing nothing.
// Same cache, same settings, same ffprobe measurement — no HTTP is hand-rolled here.
import fs from 'node:fs';
import path from 'node:path';
import { say } from '../../../tools/elevenlabs.mjs';

const dir = path.join(path.dirname(new URL(import.meta.url).pathname.slice(1)), 'audio');
const out = {};
for (const n of ['intro', 's1', 's2', 's3', 's4', 's5']) {
  const text = fs.readFileSync(path.join(dir, `${n}.txt`), 'utf8');
  const r = await say(text, path.join(dir, `${n}.mp3`));
  out[n] = { seconds: r.seconds, chars: r.chars, cached: r.cached };
}
console.log(JSON.stringify(out, null, 2));
