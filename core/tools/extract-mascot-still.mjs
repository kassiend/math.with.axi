#!/usr/bin/env node
/**
 * Extracts the last frame of the keyed mascot clip, cropped tight to its alpha bounding box, and
 * records where that crop sits in the 720x1280 design frame when the clip is composited `cover`.
 *
 * The intro hands off from video to still: Remotion plays mas_chromo up to its last frame, then
 * the page takes over with this PNG and animates it into the footer. The seam is only invisible
 * if the still lands at exactly the size and position the video left it at — which is why the
 * geometry is computed here, from the real alpha channel, rather than eyeballed.
 *
 *   node core/tools/extract-mascot-still.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CORE, PYTHON } from '../pipeline/lib/paths.mjs';
import { FFMPEG } from '../pipeline/lib/platform.mjs';

const KEYED = path.join(CORE, 'video', 'public', 'mascot', 'mas_chromo.webm');
const OUT_PNG = path.join(CORE, 'web', 'public', 'mascot', 'axi-still.png');
const OUT_JSON = path.join(CORE, 'web', 'public', 'mascot', 'axi-still.json');

/** Design frame the page and the composition both work in. */
const FRAME_W = 720;
const FRAME_H = 1280;

/**
 * How tall the mascot stands during the intro, as a fraction of frame height, and where its feet
 * land. Set explicitly rather than inherited from `object-fit: cover` — cover scales a 16:9 clip
 * until it fills a 9:16 frame, which here made the fox 743 px wide in a 720 px frame and clipped
 * both ears. The intro placement is a composition decision, so it is stated as one.
 */
const INTRO_HEIGHT_RATIO = 0.72;
const INTRO_FEET_Y = 1150;

if (!fs.existsSync(KEYED)) {
  console.error(`missing ${KEYED} — run "npm run chromakey" first`);
  process.exit(2);
}

fs.mkdirSync(path.dirname(OUT_PNG), { recursive: true });

// -c:v libvpx-vp9 on the input is mandatory or the alpha layer is silently dropped.
const full = path.join(CORE, 'out', 'logs', 'mascot-lastframe.png');
fs.mkdirSync(path.dirname(full), { recursive: true });
execFileSync(FFMPEG, [
  '-y', '-v', 'error',
  '-c:v', 'libvpx-vp9', '-i', KEYED,
  '-vf', 'select=eq(n\\,120),format=rgba',   // 121 frames, 0-indexed
  '-frames:v', '1', '-update', '1',
  full,
], { stdio: ['ignore', 'inherit', 'inherit'] });

const info = JSON.parse(execFileSync(PYTHON, ['-c', `
import json
from PIL import Image
im = Image.open(${JSON.stringify(full)}).convert("RGBA")
W, H = im.size
alpha = im.getchannel("A")
# Ignore near-transparent fringe pixels; they would inflate the box by the glow of the matte.
bbox = alpha.point(lambda a: 255 if a > 24 else 0).getbbox()
im.crop(bbox).save(${JSON.stringify(OUT_PNG)})
print(json.dumps({"video_w": W, "video_h": H, "bbox": bbox}))
`], { encoding: 'utf8' }).trim());

const { video_w: vw, video_h: vh, bbox } = info;
const [x0, y0, x1, y1] = bbox;

// Place the mascot first, then derive the video transform that puts it there. Doing it in this
// order is what keeps the video-to-still hand-off seamless: both are solved from the same rect.
const foxW = x1 - x0;
const foxH = y1 - y0;

const rect = {
  h: +(FRAME_H * INTRO_HEIGHT_RATIO).toFixed(2),
  w: +((FRAME_H * INTRO_HEIGHT_RATIO) * (foxW / foxH)).toFixed(2),
  x: 0,
  y: 0,
};
rect.x = +((FRAME_W - rect.w) / 2).toFixed(2);
rect.y = +(INTRO_FEET_Y - rect.h).toFixed(2);

// The scale that makes the fox exactly rect.h tall, and the offsets that put its crop at rect.
const scale = rect.h / foxH;
const dispW = vw * scale;
const dispH = vh * scale;
const offX = rect.x - x0 * scale;
const offY = rect.y - y0 * scale;

const out = {
  source: path.relative(CORE, KEYED),
  video: { w: vw, h: vh },
  crop_bbox: bbox,
  /** Absolute CSS box for the <Video> element so the mascot lands on frame_rect. */
  intro_video: {
    scale: +scale.toFixed(6),
    width: +dispW.toFixed(2), height: +dispH.toFixed(2),
    left: +offX.toFixed(2), top: +offY.toFixed(2),
  },
  /** Where the cropped still must be drawn so it lands exactly where the video left the mascot. */
  frame_rect: rect,
  frame: { w: FRAME_W, h: FRAME_H },
};

fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2) + '\n');

console.log(`✓ ${path.relative(CORE, OUT_PNG)}  ${x1 - x0}x${y1 - y0} px of ${vw}x${vh}`);
console.log(`  lands at x=${rect.x} y=${rect.y} w=${rect.w} h=${rect.h} in the ${FRAME_W}x${FRAME_H} frame`);
