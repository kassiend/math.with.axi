#!/usr/bin/env node
/**
 * Measures the story mascot clip and writes the geometry the page and the composition both need.
 *
 * assets/video/10s.mp4 is one continuous take: the mascot walks in from the left, opens a book,
 * reads, then walks off left again. The three phases are found by tracking the alpha bounding box
 * frame by frame rather than guessed from the brief — a naive "sustained leftward motion" test
 * fires on the book-opening arm movement at 2.7 s, which is nowhere near the exit.
 *
 * Output: core/video/public/mascot/story-mascot.json
 *
 *   node core/tools/story-mascot.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CORE, PYTHON } from '../pipeline/lib/paths.mjs';
import { FFMPEG } from '../pipeline/lib/platform.mjs';

const KEYED = path.join(CORE, 'video', 'public', 'mascot', '10s.webm');
const OUT = path.join(CORE, 'video', 'public', 'mascot', 'story-mascot.json');
const WORK = path.join(CORE, 'out', 'logs', 'stories', 'mascot-frames');

/** Design frame both the page and the composition work in. */
const FRAME_W = 720;
const FRAME_H = 1280;

/** Where the mascot must sit at rest — the band measured from story_example.png. */
const REST = { x: 328, y: 157, w: 69, h: 107 };

if (!fs.existsSync(KEYED)) {
  console.error(`missing ${KEYED} — run "npm run chromakey" first`);
  process.exit(2);
}

fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });
execFileSync(FFMPEG, ['-y', '-v', 'error', '-c:v', 'libvpx-vp9', '-i', KEYED,
  '-vf', 'format=rgba', path.join(WORK, 'f_%04d.png')], { stdio: ['ignore', 'inherit', 'inherit'] });

const measured = JSON.parse(execFileSync(PYTHON, ['-c', `
import json, glob
from PIL import Image

rows = []
for i, f in enumerate(sorted(glob.glob(${JSON.stringify(path.join(WORK, 'f_*.png'))}))):
    a = Image.open(f).convert("RGBA").getchannel("A").point(lambda v: 255 if v > 40 else 0)
    bb = a.getbbox()
    rows.append({"i": i, "bbox": list(bb) if bb else None})
print(json.dumps({"frames": rows}))
`], { encoding: 'utf8', maxBuffer: 1 << 26 }));

const rows = measured.frames.filter((r) => r.bbox);
const cx = (r) => (r.bbox[0] + r.bbox[2]) / 2;
const total = measured.frames.length;

/**
 * The exit is the LAST sustained leftward run, not the first bit of movement. Searching backwards
 * from the end is what distinguishes it from the arm motion of opening the book.
 */
let exitStart = total - 1;
for (let i = rows.length - 1; i > 1; i--) {
  const drift = cx(rows[i]) - cx(rows[i - 1]);
  if (drift > -6) { exitStart = rows[i].i; break; }
}

/**
 * The rest segment is the MAXIMAL stable tail before the exit, found by extending backwards from
 * it while the silhouette stays put. Scanning forwards instead finds the plateau *before* the
 * book is opened — the arms widen the bounding box at ~2.7 s, so a short forward window settles
 * on a pose the mascot is about to leave.
 */
const at = (frame) => rows.find((r) => r.i === frame) ?? rows[rows.length - 1];
// Anchor half a second BEFORE the exit: the last frames before it are already the turn, and
// anchoring on those collapses the rest segment to nothing.
const anchor = at(Math.max(0, exitStart - 12));
const anchorW = anchor.bbox[2] - anchor.bbox[0];
const anchorCx = cx(anchor);

let restStart = anchor.i;
for (let i = rows.findIndex((r) => r.i === anchor.i); i >= 0; i--) {
  const w = rows[i].bbox[2] - rows[i].bbox[0];
  if (Math.abs(w - anchorW) > 20 || Math.abs(cx(rows[i]) - anchorCx) > 20) break;
  restStart = rows[i].i;
}

// A loop shorter than a second reads as a stutter. If the stable stretch is that short, the clip
// is not what this template assumes and the run should stop rather than ship a twitch.
if (exitStart - restStart < 24) {
  throw new Error(
    `only ${exitStart - restStart} stable frames between the book opening and the exit — ` +
    'too short to loop. Re-cut the clip with a longer hold.'
  );
}

// Geometry: solve the video transform from where the mascot must land at rest.
const restRow = rows.find((r) => r.i >= restStart) ?? rows[0];
const [x0, y0, x1, y1] = restRow.bbox;
const probe = JSON.parse(execFileSync(PYTHON, ['-c', `
import json
from PIL import Image
im = Image.open(${JSON.stringify(path.join(WORK, 'f_0001.png'))})
print(json.dumps({"w": im.size[0], "h": im.size[1]}))
`], { encoding: 'utf8' }));

const scale = REST.h / (y1 - y0);
const box = {
  width: +(probe.w * scale).toFixed(2),
  height: +(probe.h * scale).toFixed(2),
  left: +(REST.x - x0 * scale).toFixed(2),
  top: +(REST.y - y0 * scale).toFixed(2),
};

const fpsSrc = 24;
const out = {
  source: 'mascot/10s.webm',
  source_fps: fpsSrc,
  source_frames: total,
  /** Phase boundaries in SOURCE frames at 24 fps. */
  phases: {
    enter: { from: 0, to: restStart },
    rest:  { from: restStart, to: exitStart },
    exit:  { from: exitStart, to: total },
  },
  seconds: {
    enter: +(restStart / fpsSrc).toFixed(2),
    rest:  +((exitStart - restStart) / fpsSrc).toFixed(2),
    exit:  +((total - exitStart) / fpsSrc).toFixed(2),
  },
  /** Absolute CSS box, design units, so the mascot lands on REST while at rest. */
  box,
  rest_rect: REST,
  frame: { w: FRAME_W, h: FRAME_H },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
fs.rmSync(WORK, { recursive: true, force: true });

console.log(`✓ ${path.relative(CORE, OUT)}`);
console.log(`  enter 0-${restStart} (${out.seconds.enter}s)  rest ${restStart}-${exitStart} (${out.seconds.rest}s)  exit ${exitStart}-${total} (${out.seconds.exit}s)`);
console.log(`  video box  left ${box.left} top ${box.top} ${box.width}x${box.height}`);
