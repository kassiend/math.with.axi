#!/usr/bin/env node
/**
 * Reports what is actually in /assets, with the one property that matters for compositing:
 * whether a clip carries an alpha channel.
 *
 * As of the initial survey none of the video assets do — they are yuv420p, including the WebMs
 * (VP9 alpha would show as yuva420p). The brief assumed pre-rendered alpha sources, so this tool
 * exists to make the gap visible rather than discovered at render time.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ASSETS } from '../pipeline/lib/paths.mjs';
import { FFPROBE } from '../pipeline/lib/platform.mjs';

const ALPHA_PIX_FMTS = ['yuva420p', 'yuva422p', 'yuva444p', 'rgba', 'bgra', 'argb', 'abgr', 'ya8'];

function probe(file) {
  const raw = execFileSync(FFPROBE, [
    '-v', 'error',
    '-show_entries', 'stream=codec_type,codec_name,pix_fmt,width,height,r_frame_rate',
    // alpha_mode is the ONLY reliable alpha signal for VP9: the alpha layer is stored separately
    // and pix_fmt still reads yuv420p, so a pix_fmt check calls a matted clip "no alpha".
    '-show_entries', 'stream_tags=alpha_mode',
    '-show_entries', 'format=duration,format_name',
    '-of', 'json', file,
  ], { encoding: 'utf8' });
  const j = JSON.parse(raw);
  const v = (j.streams ?? []).find((s) => s.codec_type === 'video');
  const a = (j.streams ?? []).find((s) => s.codec_type === 'audio');
  return {
    file: path.relative(ASSETS, file),
    kind: v ? 'video/image' : a ? 'audio' : 'unknown',
    codec: v?.codec_name ?? a?.codec_name ?? null,
    size: v ? `${v.width}x${v.height}` : null,
    fps: v?.r_frame_rate && v.r_frame_rate !== '0/0' ? v.r_frame_rate : null,
    pix_fmt: v?.pix_fmt ?? null,
    has_alpha: v ? (alphaModeTag(v) === '1' || ALPHA_PIX_FMTS.includes(v.pix_fmt)) : null,
    duration: j.format?.duration ? Number(Number(j.format.duration).toFixed(3)) : null,
  };
}

/**
 * WebM tag names are not case-normalised: the same encoder writes `alpha_mode` in one file and
 * `ALPHA_MODE` in another. A case-sensitive lookup reports "no alpha" about half the pool.
 */
function alphaModeTag(stream) {
  const key = Object.keys(stream.tags ?? {}).find((k) => k.toLowerCase() === 'alpha_mode');
  return key ? stream.tags[key] : null;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    if (/\.(mp4|mov|webm|mkv|png|jpg|jpeg|mp3|wav|m4a|aac)$/i.test(e.name)) return [p];
    return [];
  });
}

const rows = walk(ASSETS).map((f) => {
  try { return probe(f); } catch (err) { return { file: path.relative(ASSETS, f), error: err.message }; }
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  for (const r of rows) {
    if (r.error) { console.log(`! ${r.file}: ${r.error}`); continue; }
    const alpha = r.has_alpha === null ? '' : r.has_alpha ? '  ALPHA' : '  no-alpha';
    console.log(
      `${r.file.padEnd(28)} ${String(r.codec).padEnd(8)} ${String(r.size ?? '').padEnd(11)}` +
      `${String(r.fps ?? '').padEnd(7)} ${String(r.pix_fmt ?? '').padEnd(9)}` +
      `${String(r.duration ?? '').padEnd(9)}${alpha}`
    );
  }
  const noAlpha = rows.filter((r) => r.has_alpha === false && /\.(mp4|mov|webm|mkv)$/i.test(r.file));
  const withAlpha = rows.filter((r) => r.has_alpha === true && /\.(mp4|mov|webm|mkv)$/i.test(r.file));
  if (noAlpha.length) {
    console.log(`\n${noAlpha.length} video asset(s) without alpha — "npm run chromakey" will key these.`);
  }
  if (withAlpha.length) {
    console.log(`${withAlpha.length} video asset(s) already matted — chromakey passes these through untouched.`);
  }
}
