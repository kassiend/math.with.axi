// Thin runner: the tool's own CLI guard (import.meta.url === file://argv[1]) never matches a
// Windows argv path, so it exits 0 with no output. Same tool, same cache, same ffprobe measure —
// just invoked through the exported module API instead. No key is read, printed or stored here.
import path from 'node:path';
import fs from 'node:fs';
import { say } from '../../../tools/elevenlabs.mjs';

const RUN = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const lines = JSON.parse(fs.readFileSync(path.join(RUN, 'tts.lines.json'), 'utf8'));

const out = [];
for (const l of lines) {
  const r = await say(l.text, path.join(RUN, l.out));
  out.push({ id: l.id, ...r, file: l.out });
  console.log(JSON.stringify({ id: l.id, seconds: r.seconds, chars: r.chars, cached: r.cached }));
}
console.log(JSON.stringify({ total_seconds: Number(out.reduce((a, b) => a + b.seconds, 0).toFixed(3)) }));
fs.writeFileSync(path.join(RUN, 'tts.measured.json'), JSON.stringify(out, null, 2));
