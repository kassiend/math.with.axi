// Thin driver: the elevenlabs.mjs CLI guard compares import.meta.url to a Windows argv path
// and never fires on this platform, so call the exported say() instead. Same cache, same ffprobe.
import path from 'node:path';
import { say } from '../../../tools/elevenlabs.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const lines = JSON.parse(process.argv[2]);
const out = [];
for (const [id, text] of lines) {
  const r = await say(text, path.join(HERE, 'audio', `${id}.mp3`));
  out.push({ id, seconds: r.seconds, chars: r.chars, cached: r.cached });
}
console.log(JSON.stringify(out, null, 2));
