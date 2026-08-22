#!/usr/bin/env node
/**
 * Measures the story mascot clip and writes the geometry the page and the composition both need.
 *
 * assets/video/10s.mp4 is one continuous take: the mascot walks in from the left, opens a book,
 * reads, then walks off left again — 10.08 s in total.
 *
 * The post does not loop any of it. It PLAYS the take to the pause point, FREEZES there for as
 * long as the story runs, then RESUMES so the remaining footage carries him off exactly as the
 * video ends. Since the pause point is at 6 s and the take is 10.08 s, the resume needs the last
 * 4.08 s — which is why the mascot leaves "with four seconds to go" without anyone timing it.
 *
 * Only the geometry is measured here: where the mascot sits at rest, so the clip can be placed to
 * put him in the card's mascot band.
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

/**
 * Where the mascot sits once the book is open. Larger than story_example.png's 69x107: at that
 * size he was a detail in the corner rather than someone reading to you.
 */
const REST = { x: 310, y: 150, w: 100, h: 155 };

/** Where the take is paused, in seconds. Everything after it is saved for the exit. */
const PAUSE_AT = 6.0;

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

// The pause point splits the take: play up to it, freeze on it, resume from it.
const pauseFrameSrc = Math.round(PAUSE_AT * 24);

// The rest pose is whatever frame the take is paused on — that is the frame held on screen.
const restStart = pauseFrameSrc;
const exitStart = pauseFrameSrc;

// Geometry: solve the video transform from where the mascot must land at rest.
const restRow = rows.find((r) => r.i >= restStart) ?? rows[rows.length - 1];
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
  /** Where the take is cut, in SOURCE frames at 24 fps. */
  pause_at_seconds: PAUSE_AT,
  phases: {
    play:   { from: 0, to: pauseFrameSrc },
    freeze: { from: pauseFrameSrc, to: pauseFrameSrc },
    resume: { from: pauseFrameSrc, to: total },
  },
  seconds: {
    play:   +(pauseFrameSrc / fpsSrc).toFixed(2),
    resume: +((total - pauseFrameSrc) / fpsSrc).toFixed(2),
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
console.log(`  play 0-${pauseFrameSrc} (${out.seconds.play}s)  freeze at ${pauseFrameSrc}  resume ${pauseFrameSrc}-${total} (${out.seconds.resume}s)`);
console.log(`  video box  left ${box.left} top ${box.top} ${box.width}x${box.height}`);
