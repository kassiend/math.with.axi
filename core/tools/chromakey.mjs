#!/usr/bin/env node
/**
 * Chroma-key the mascot clips into alpha WebMs that Remotion can composite.
 *
 * The source clips carry no alpha (see tools/probe-assets.mjs), so the alpha has to be made.
 * This is a pre-process, not a render-time filter: keying once into a file means the result is
 * inspectable before it reaches a video, and the render stage stays a straight composite.
 *
 * Key colour is sampled from the top-left 8x8 of the first frame rather than assumed to be
 * green — none of these clips are green screens, and guessing produces a confidently wrong matte.
 *
 * FILTER CHOICE MATTERS MORE THAN THE TUNING. ffmpeg's `chromakey` compares chroma only and
 * ignores luma, so on a white or black background it removes every desaturated pixel in the
 * frame — a white shirt, grey trousers and pale fur all vanish while saturated patches survive.
 * `colorkey` compares full RGB and is the correct filter for an achromatic background. This tool
 * picks by the sampled colour's saturation and says which one it used.
 *
 * Usage:
 *   node core/tools/chromakey.mjs                        # key every video in assets/video
 *   node core/tools/chromakey.mjs --file mas.mp4
 *   node core/tools/chromakey.mjs --similarity 0.16 --blend 0.08
 *   node core/tools/chromakey.mjs --key 0x00ff00          # override the sampled colour
 *   node core/tools/chromakey.mjs --mode chroma           # force chromakey (green/blue screens)
 *
 * Tuning: raise --similarity until the background is gone, then raise --blend just enough to
 * soften the edge. Too much similarity eats the subject; too much blend makes it translucent.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ASSETS, CORE } from '../pipeline/lib/paths.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };

const SIMILARITY = Number(flag('similarity', 0.14));
const BLEND = Number(flag('blend', 0.06));
const KEY_OVERRIDE = flag('key', null);
const ONLY = flag('file', null);
const MODE = flag('mode', 'auto');            // auto | color | chroma
/** Below this HSV saturation the background is achromatic and chromakey is the wrong filter. */
const SATURATION_THRESHOLD = 0.25;

const SRC_DIR = path.join(ASSETS, 'video');
const OUT_DIR = path.join(CORE, 'video', 'public', 'mascot');
const PREVIEW_DIR = path.join(CORE, 'out', 'logs', 'chromakey-previews');
/** Previews are composited over the lesson background so edge fringing is visible. */
const PREVIEW_BG = '0x0b0d12';

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(PREVIEW_DIR, { recursive: true });

/** Sample the top-left corner of frame 0 as raw RGB. Corners are background far more often than not. */
function sampleKeyColour(file) {
  const buf = execFileSync('ffmpeg', [
    '-v', 'error', '-i', file,
    '-vf', 'crop=8:8:0:0,scale=1:1,format=rgb24',
    '-frames:v', '1', '-f', 'rawvideo', '-',
  ], { maxBuffer: 1 << 20 });
  if (buf.length < 3) throw new Error('could not sample a pixel');
  const hex = [...buf.subarray(0, 3)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `0x${hex}`;
}

/** HSV saturation of a 0xRRGGBB string, 0..1. */
function saturationOf(hex) {
  const n = parseInt(hex.replace(/^0x/, ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function keyOne(file) {
  // Keep the subdirectory in the name so assets/video/hurry/papapa.webm becomes
  // mascot/hurry-papapa.webm rather than colliding with a top-level papapa.
  const rel = path.relative(SRC_DIR, file);
  const name = rel.replace(/\.[^.]+$/, '').replace(/[\\/]/g, '-');
  const key = KEY_OVERRIDE ?? sampleKeyColour(file);
  const sat = saturationOf(key);
  const mode = MODE === 'auto' ? (sat < SATURATION_THRESHOLD ? 'color' : 'chroma') : MODE;
  const out = path.join(OUT_DIR, `${name}.webm`);
  const preview = path.join(PREVIEW_DIR, `${name}.png`);

  const filter = mode === 'chroma'
    // Green/blue screen: chroma-only comparison, plus despill for the colour cast on edges.
    ? [`chromakey=${key}:${SIMILARITY}:${BLEND}`, 'despill', 'format=yuva420p'].join(',')
    // Achromatic background: full-RGB comparison. despill would do nothing useful here.
    : [`colorkey=${key}:${SIMILARITY}:${BLEND}`, 'format=yuva420p'].join(',');

  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-i', file,
    '-vf', filter,
    '-c:v', 'libvpx-vp9',
    '-pix_fmt', 'yuva420p',
    '-auto-alt-ref', '0',            // required for alpha in VP9
    '-b:v', '0', '-crf', '28',
    '-an',
    out,
  ], { stdio: ['ignore', 'inherit', 'inherit'] });

  // A still from the middle of the clip, over the real background. Edges are judged by eye;
  // there is no metric here that substitutes for looking at it.
  // -c:v libvpx-vp9 on the INPUT is mandatory. ffmpeg's native vp9 decoder silently ignores the
  // alpha layer, so without this the preview shows the un-keyed background and looks like the
  // key failed when it did not. (Chrome, and therefore Remotion, decodes the alpha correctly.)
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-f', 'lavfi', '-i', `color=c=${PREVIEW_BG}:s=512x512`,
    '-c:v', 'libvpx-vp9', '-i', out,
    '-filter_complex', '[1:v]scale=512:-1,format=yuva420p[fg];[0:v][fg]overlay=(W-w)/2:(H-h)/2',
    '-frames:v', '1',
    preview,
  ], { stdio: ['ignore', 'inherit', 'inherit'] });

  const stat = fs.statSync(out);
  return {
    source: path.relative(ASSETS, file), out: path.relative(CORE, out),
    key, saturation: Number(sat.toFixed(3)), filter: mode === 'chroma' ? 'chromakey' : 'colorkey',
    bytes: stat.size, preview: path.relative(CORE, preview),
  };
}

/** Recurse: clips are grouped into subdirectories (hurry/, ...), not flat. */
function walkVideos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walkVideos(p);
    return /\.(mp4|mov|webm|mkv)$/i.test(e.name) ? [p] : [];
  });
}

const files = walkVideos(SRC_DIR)
  .filter((f) => !ONLY || path.basename(f) === ONLY || path.relative(SRC_DIR, f) === ONLY);

if (!files.length) {
  console.error(`no source clips in ${SRC_DIR}`);
  process.exit(2);
}

const report = [];
for (const f of files) {
  try {
    const r = keyOne(f);
    report.push(r);
    console.log(`✓ ${r.source} → ${r.out}   key=${r.key} sat=${r.saturation} filter=${r.filter}  similarity=${SIMILARITY} blend=${BLEND}`);
    console.log(`  preview: ${r.preview}`);
  } catch (err) {
    report.push({ source: path.relative(ASSETS, f), error: err.message.split('\n')[0] });
    console.error(`✗ ${path.basename(f)}: ${err.message.split('\n')[0]}`);
  }
}

fs.writeFileSync(path.join(PREVIEW_DIR, 'report.json'),
  JSON.stringify({ similarity: SIMILARITY, blend: BLEND, results: report }, null, 2));

console.log(`\nLook at the previews before wiring a clip into video/mascot.json.`);
console.log(`A key that looks fine at 512px can fringe badly once it is composited at 1080x1920.`);
