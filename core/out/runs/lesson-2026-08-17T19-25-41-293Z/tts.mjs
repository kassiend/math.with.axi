// Thin driver over core/tools/elevenlabs.mjs — its CLI guard does not fire on Windows paths.
// No HTTP here, no settings here: the tool owns the request, the cache and the ffprobe measure.
import path from 'node:path';
import { say } from '../../../tools/elevenlabs.mjs';

const RUN = path.resolve(import.meta.dirname);
const lines = JSON.parse(process.argv[2]);
const out = [];
for (const [id, text] of lines) {
  out.push({ id, ...(await say(text, path.join(RUN, 'audio', `${id}.mp3`))) });
}
console.log(JSON.stringify(out, null, 2));
