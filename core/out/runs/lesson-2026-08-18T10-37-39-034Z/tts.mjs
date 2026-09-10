/**
 * Driver for the narrator's per-step TTS.
 *
 * core/tools/elevenlabs.mjs guards its CLI with `import.meta.url === file://${process.argv[1]}`,
 * which never matches on Windows, so the CLI prints nothing. This imports say() from that same
 * module — same cache, same settings, same ffprobe measurement, no hand-rolled HTTP, no key
 * anywhere in argv or output.
 *
 *   node <run>/tts.mjs <run>/lines.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { say } from '../../../tools/elevenlabs.mjs';

const runDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const lines = JSON.parse(fs.readFileSync(process.argv[2] ?? path.join(runDir, 'lines.json'), 'utf8'));

const out = [];
for (const { id, narration } of lines) {
  const r = await say(narration, path.join(runDir, 'audio', `${id}.mp3`));
  out.push({ id, seconds: r.seconds, chars: r.chars, cached: r.cached });
  console.log(`${id.padEnd(6)} ${String(r.seconds).padStart(7)}s  ${String(r.chars).padStart(4)} chars  ${r.cached ? 'cached' : 'synthesized'}`);
}
console.log(JSON.stringify(out));
console.log('speech total', out.reduce((a, b) => a + b.seconds, 0).toFixed(3));
