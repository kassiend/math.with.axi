// Drives core/tools/elevenlabs.mjs say() through its module API.
// The documented CLI form exits 0 with no output on Windows: the file's
// `import.meta.url === file://${process.argv[1]}` guard never matches a `C:\...` argv path.
// Same known guard failure recorded in plan.out.json dedup_check for ledger.mjs.
import path from 'node:path';
import { say } from '../../../tools/elevenlabs.mjs';

const RUN = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const lines = [
  ['intro', '[excited] Eighty percent off — sixty-eight pounds. [pause] What was it before?'],
  ['s1', '[curious] You know the sale price. [pause] You want the ticket price.'],
  ['s2', '[confident] Eighty off means you keep twenty percent. [pause] Divide by that.'],
  ['s3', '[excited] Dividing by zero point two is times five. Sixty-eight times five is three hundred and forty.'],
  ['s4', '[confident] Three hundred and forty pounds. [pause] Take eighty percent off — sixty-eight.'],
  ['s5', '[thoughtful] One catch: a hundred percent off. [pause] You keep nothing, so there is nothing to divide by.'],
];

const out = [];
for (const [id, text] of lines) {
  const r = await say(text, path.join(RUN, 'audio', `${id}.mp3`));
  out.push({ id, seconds: r.seconds, chars: r.chars, cached: r.cached });
}
console.log(JSON.stringify(out, null, 2));
console.log('total_speech=' + out.reduce((a, b) => a + b.seconds, 0).toFixed(3));
