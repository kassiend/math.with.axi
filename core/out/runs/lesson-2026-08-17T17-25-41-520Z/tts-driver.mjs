// Thin driver: the elevenlabs.mjs CLI guard (file://${argv[1]}) never fires on Windows paths,
// so the same tool is invoked through its module API. No HTTP is hand-rolled here.
import path from 'node:path';
import { say } from '../../../tools/elevenlabs.mjs';

const RUN = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const lines = JSON.parse(process.argv[2]);
const out = [];
for (const [id, text] of lines) {
  out.push({ id, ...(await say(text, path.join(RUN, 'audio', `${id}.mp3`))) });
}
console.log(JSON.stringify(out, null, 2));
