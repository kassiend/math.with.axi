// Driver for core/tools/elevenlabs.mjs say(). The documented CLI form is a silent no-op on
// Windows (its `file://${process.argv[1]}` guard never matches a drive-letter argv path), so the
// module API is called directly: same cache, same ffprobe measurement, key never in argv.
import path from 'node:path';
import { say } from '../../../tools/elevenlabs.mjs';

const RUN = path.resolve(import.meta.dirname);

const lines = [
  ['intro', "[excited] Heey — ninety-seven times ninety-two, in your head? [pause] Watch this."],
  ['s1', "[curious] Look at them. [pause] Both sit just under a hundred. That's all you need."],
  ['s2', "[confident] How far is each one from a hundred? [pause] Three … and eight."],
  ['s3', "[confident] Now subtract crosswise. Ninety-seven minus eight is eighty-nine. [pause] That's the front."],
  ['s4', "[excited] Multiply the two gaps. Three times eight is twenty-four. [pause] Stick it on the back — eight-nine-two-four."],
  ['s5', "[thoughtful] One catch. Gaps of twelve and eleven give one thirty-two — over ninety-nine, so it carries: seven-eight-three-two. [warm] Try your own."],
];

const out = [];
for (const [id, text] of lines) {
  const r = await say(text, path.join(RUN, 'audio', `${id}.mp3`));
  out.push({ id, seconds: r.seconds, chars: r.chars, cached: r.cached });
}
console.log(JSON.stringify(out, null, 2));
console.log('speech_total', out.reduce((a, b) => a + b.seconds, 0).toFixed(3));
