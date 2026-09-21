// Thin driver over core/tools/elevenlabs.mjs say(): the tool's CLI self-guard
// (import.meta.url vs process.argv[1]) does not fire on Windows paths. Same function,
// same cache, same settings — no hand-rolled HTTP, no key ever touched here.
import fs from 'node:fs';
import path from 'node:path';
import { say } from '../../../tools/elevenlabs.mjs';

const runDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const lines = JSON.parse(fs.readFileSync(path.join(runDir, 'tts.lines.json'), 'utf8'));

const out = [];
for (const { id, text } of lines) {
  const r = await say(text, path.join(runDir, 'audio', `${id}.mp3`));
  out.push({ id, seconds: r.seconds, chars: r.chars, cached: r.cached });
}
console.log(JSON.stringify(out, null, 2));
console.log('TOTAL_SPEECH', out.reduce((a, b) => a + b.seconds, 0).toFixed(3));
