// Thin driver over core/tools/elevenlabs.mjs `say`.
// The tool's CLI guard (`import.meta.url === "file://" + process.argv[1]`) never fires on
// Windows, where argv[1] is a backslashed drive path, so the module API is used directly.
// No HTTP is hand-rolled here and no credential is read, printed or stored by this file.
import path from 'node:path';
import { say } from '../../../tools/elevenlabs.mjs';

const RUN = path.resolve(import.meta.dirname);

const lines = [
  ['intro', "[excited] Heey — how do you spot a multiple of eleven? [pause] No dividing needed."],
  ['s1', "[curious] Three thousand nine hundred fifty-eight. [pause] Does eleven go in?"],
  ['s2', "[confident] From the right, alternate plus and minus. [pause] Eight minus five plus nine minus three."],
  ['s3', "[confident] Add it up. [pause] That's nine."],
  ['s4', "[thoughtful] Nine isn't a multiple of eleven. [pause] So no — and nine is the remainder."],
  ['s5', "[warm] One catch — zero isn't the only pass. [pause] Two thousand nine hundred fifteen gives eleven, which passes too."],
];

const out = [];
for (const [id, text] of lines) {
  const r = await say(text, path.join(RUN, 'audio', `${id}.mp3`));
  out.push({ id, seconds: r.seconds, chars: r.chars, cached: r.cached });
}
console.log(JSON.stringify({ clips: out, total: Number(out.reduce((a, c) => a + c.seconds, 0).toFixed(3)) }, null, 2));
