#!/usr/bin/env node
/**
 * Math-story post pipeline.
 *
 *   story + sources -> validator verdict -> formula cross-check -> 90 s ceiling
 *                   -> RENDER GATE -> capture (Playwright) -> compose (Remotion) -> ledger
 *
 * Four hard conditions guard the render, all in code and none with an override:
 *   1. the validator passed — every citation opened, quoted and supporting
 *   2. the formula cross-check agreed, when the formula is the kind SymPy can settle
 *   3. the runtime is under 90 s
 *   4. every line of text fits the card
 *
 * Usage:
 *   node core/pipeline/orchestrate-story.mjs --run <run-dir> [--dry-run] [--rerender]
 */
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { captureStory, StoryTextDoesNotFit } from './stages/capture-story.mjs';
import { crossCheck } from './lib/sympy.mjs';
import * as stories from './lib/stories-ledger.mjs';
import { nextBackground, shippedCount } from './lib/rotation.mjs';
import { ASSETS, CORE, NODE_BIN, ROOT } from './lib/paths.mjs';
import { resolveBin, runTool, FFPROBE } from './lib/platform.mjs';
import { buildStoryTimeline, FPS } from '../shared/story-timeline.ts';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const has = (n) => argv.includes(`--${n}`);

const PUBLIC = path.join(CORE, 'video', 'public');

async function main() {
  const runDir = path.resolve(flag('run') ?? '');
  const story = readJson(path.join(runDir, 'story.out.json'), 'story.out.json');
  const narration = readJson(path.join(runDir, 'narration.out.json'), 'narration.out.json');
  const validator = readJson(path.join(runDir, 'validator.box', 'validator.out.json'), 'validator.out.json');

  const run = { id: `story-${story.story_id}`, dir: runDir, started_at: new Date().toISOString() };
  log(run, 'run.start', { story_id: story.story_id, area: story.area, subject: story.subject_slug });

  // ---- 1. Dedup ----------------------------------------------------------
  if (!has('rerender')) {
    const cand = stories.findCandidates(story.subject_slug, story.angle_slug, story.area);
    if (cand.blocked.length) return close(run, story, 'rejected', 'dedup', cand.blocked);
  }

  // ---- RENDER GATE 1: the validator opened every source ------------------
  const fatal = (validator.findings ?? []).filter((f) => f.severity === 'fatal');
  const badCitation = (validator.checked ?? []).filter((c) => !c.reachable || !c.quote_found || !c.supports_claim);
  const unverifiable = validator.unverifiable ?? [];
  if (validator.status !== 'passed' || fatal.length || badCitation.length || unverifiable.length) {
    return close(run, story, 'failed', 'validation', [
      { validator_status: validator.status },
      ...fatal.map((f) => ({ fatal: f.kind, detail: f.detail })),
      ...badCitation.map((c) => ({ claim: c.claim_id, url: c.url, reachable: c.reachable,
                                   quote_found: c.quote_found, supports: c.supports_claim })),
      ...unverifiable.map((u) => ({ unverifiable: u.claim_id, reason: u.reason })),
    ]);
  }
  log(run, 'validation', { checked: (validator.checked ?? []).length, findings: (validator.findings ?? []).length });

  // ---- RENDER GATE 2: the formula, when it is checkable ------------------
  if (story.check_script) {
    const gen = path.resolve(runDir, story.check_script);
    const ver = path.join(runDir, 'verifier.box', 'verifier.checks', `${story.story_id}.py`);
    const cross = await crossCheck(story.story_id, gen, ver);
    log(run, 'crosscheck', { agreed: cross.agreed, generator: cross.generator.computed, verifier: cross.verifier.computed });
    if (!cross.agreed) return close(run, story, 'failed', 'formula', cross.failures);
  } else {
    log(run, 'crosscheck.skipped', {
      reason: story.nulls?.find((n) => n.field === 'check_script')?.reason ?? 'no check_script supplied',
    });
  }

  // ---- 3. Timeline -------------------------------------------------------
  const mascotGeom = readJson(path.join(PUBLIC, 'mascot', 'story-mascot.json'), 'story-mascot.json');
  const timeline = buildStoryTimeline(
    narration.beats.map((b) => ({ beat: b.beat, seconds: b.seconds })),
    mascotGeom,
  );
  log(run, 'timeline', {
    total_frames: timeline.totalFrames, total_seconds: timeline.totalSeconds,
    beats: timeline.beats.map((b) => `${b.beat}:${b.seconds}s`),
    mascot: { enter: timeline.mascot.enter, rest: timeline.mascot.rest, exit: timeline.mascot.exit },
  });

  // ---- RENDER GATE 3: the ceiling ----------------------------------------
  if (timeline.overCeiling) {
    return close(run, story, 'blocked', 'over-90s-ceiling', [{ total_seconds: timeline.totalSeconds }]);
  }

  const bgs = fs.readdirSync(path.join(ASSETS, 'images', 'bg')).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
  const background = nextBackground(bgs, shippedCount());
  log(run, 'picks', { background });

  // Images are staged where the capture can load them by relative path.
  const imageSrc = stageImages(run, story);

  /**
   * Link each image-beat to a file.
   *
   * A beat may name its image with `image_id`; when it does not, images are handed out to
   * image-beats in order, cycling if there are fewer images than beats. The alternative — an
   * empty slot — ships a grey box, and a grey box is the view-layer form of a missing field.
   */
  const imageIds = (story.images ?? []).map((i) => i.image_id).filter((id) => imageSrc[id]);
  let imageCursor = 0;
  const imageForBeat = (b) => {
    if (b.image_id && imageSrc[b.image_id]) return imageSrc[b.image_id];
    if (!imageIds.length) return null;
    return imageSrc[imageIds[imageCursor++ % imageIds.length]];
  };

  const payload = {
    title: story.title,
    background,
    mascot: mascotGeom,
    beats: story.beats.map((b, i) => ({
      beat: b.beat,
      display: b.display,
      seconds: narration.beats[i]?.seconds ?? 0,
      visual: b.visual ?? 'none',
      image: b.visual === 'image' ? imageForBeat(b) : null,
      formula_latex: b.visual === 'formula' ? (b.formula_latex ?? story.formula_latex) : null,
      shape_svg: b.visual === 'shape' ? (b.shape_svg ?? null) : null,
    })),
  };

  if (has('dry-run')) {
    log(run, 'dry-run', { note: 'gates passed; capture and render skipped' });
    return 0;
  }

  // ======= Past this line only because every gate held =======

  let shot;
  try {
    shot = await captureStory(run, payload, {
      onProgress: (done, total, ms) =>
        process.stdout.write(`\r  capture ${done}/${total}  ${(ms / 1000).toFixed(1)}s   `),
    });
    process.stdout.write('\n');
  } catch (err) {
    // ---- RENDER GATE 4: the text fits --------------------------------------
    if (err instanceof StoryTextDoesNotFit) {
      return close(run, story, 'blocked', 'text-does-not-fit', [{ reason: err.message }]);
    }
    throw err;
  }
  log(run, 'capture.done', { frames: shot.frames });

  const audio = stageAudio(run, narration, timeline);
  const props = {
    runId: run.id,
    capture: { publicPath: shot.publicPath, frames: shot.frames, fps: shot.fps, width: shot.width, height: shot.height },
    mascot: {
      src: mascotGeom.source,
      box: mascotGeom.box,
      enter: timeline.mascot.enter,
      rest: timeline.mascot.rest,
      exit: timeline.mascot.exit,
      seek: timeline.mascot.seek,
      restLoopFrames: timeline.mascot.restLoopFrames,
    },
    audio,
  };

  const propsFile = path.join(runDir, 'remotion.props.json');
  fs.writeFileSync(propsFile, JSON.stringify(props, null, 2));

  const outFile = path.join(CORE, 'out', 'renders', `${run.id}.mp4`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  runTool(resolveBin('remotion', { localBinDir: NODE_BIN }), [
    'render', path.join(CORE, 'video', 'index.ts'), 'Story', outFile,
    '--props', propsFile, '--public-dir', PUBLIC, '--log', 'info',
    ...(process.env.AXI_RENDER_CONCURRENCY ? ['--concurrency', process.env.AXI_RENDER_CONCURRENCY] : []),
  ], { cwd: CORE, stdio: ['ignore', 'inherit', 'inherit'], maxBuffer: 1 << 24 });

  if (!fs.existsSync(outFile)) throw new Error(`remotion reported success but ${outFile} is missing`);

  const published = path.join(ROOT, 'output', 'posts', 'stories', `${story.story_id}.mp4`);
  fs.mkdirSync(path.dirname(published), { recursive: true });
  fs.copyFileSync(outFile, published);

  if (has('rerender')) stories.remove(story.story_id);
  stories.record({
    story_id: story.story_id,
    area: story.area,
    subject_slug: story.subject_slug,
    angle_slug: story.angle_slug,
    title: story.title,
    status: 'shipped',
    created_at: run.started_at,
    seconds: timeline.totalSeconds,
    // Kept so an image's licence can be traced back from a shipped post.
    image_credits: (story.images ?? []).map((i) => ({ source: i.source, attribution: i.attribution ?? null })),
    video: path.relative(ROOT, published),
    run_dir: path.relative(CORE, runDir),
  });

  log(run, 'done', { video: path.relative(ROOT, published), seconds: timeline.totalSeconds });
  console.log(`\n✓ ${published}`);
  return 0;
}

// ---------------------------------------------------------------------------

function readJson(file, label) {
  if (!fs.existsSync(file)) { console.error(`missing ${label} at ${file}`); process.exit(1); }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Copy story images where the capture server will actually find them.
 *
 * web/public is only copied into web/dist by a Vite BUILD, so staging there leaves a run that
 * did not rebuild serving nothing — the slot renders empty and the post ships with a grey box.
 * dist is what the capture serves, so images go straight there.
 */
function stageImages(run, story) {
  const dir = path.join(CORE, 'web', 'dist', 'story-images', run.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const map = {};
  for (const img of story.images ?? []) {
    const abs = path.isAbsolute(img.file) ? img.file : path.join(run.dir, img.file);
    if (!fs.existsSync(abs)) continue;
    const name = `${img.image_id}${path.extname(abs)}`;
    fs.copyFileSync(abs, path.join(dir, name));
    map[img.image_id] = `./story-images/${run.id}/${name}`;
  }
  return map;
}

/** Stage narration under video/public and place each clip where its beat starts. */
function stageAudio(run, narration, timeline) {
  const dir = path.join(PUBLIC, 'audio', run.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return {
    clips: narration.beats.map((b, i) => {
      const src = path.isAbsolute(b.audio) ? b.audio : path.join(run.dir, b.audio);
      const name = `${b.beat}.mp3`;
      fs.copyFileSync(src, path.join(dir, name));
      const phase = timeline.beats[i];
      return {
        id: b.beat,
        src: `audio/${run.id}/${name}`,
        from: phase.start,
        durationInFrames: Math.max(1, Math.round(b.seconds * FPS)),
      };
    }),
  };
}

function log(run, event, data) {
  const entry = { t: new Date().toISOString(), event, ...data };
  fs.appendFileSync(path.join(run.dir, 'run.log.jsonl'), JSON.stringify(entry) + '\n');
  console.log(`[${event}]`, JSON.stringify(data));
}

function close(run, story, status, stage, problems) {
  if (has('dry-run')) {
    console.error(`\n[dry-run] gate would close at "${stage}" (${status}); nothing recorded.`);
    process.exitCode = 2;
    return 2;
  }
  log(run, 'gate.closed', { status, stage, problems });
  fs.writeFileSync(path.join(run.dir, 'outcome.json'), JSON.stringify({ status, stage, problems }, null, 2));
  stories.record({
    story_id: story.story_id, area: story.area ?? 'unknown',
    subject_slug: story.subject_slug ?? 'unknown', angle_slug: story.angle_slug ?? 'unknown',
    title: story.title ?? '(untitled)', status: status === 'blocked' ? 'rejected' : 'failed',
    created_at: run.started_at, failed_at: stage,
  });
  console.error(`\n✗ gate closed at "${stage}" (${status}). No capture, no render.`);
  for (const p of problems ?? []) console.error('  -', JSON.stringify(p));
  process.exitCode = 2;
  return 2;
}

main().catch((err) => {
  console.error('\n! pipeline error:', err.stack ?? err.message);
  process.exitCode = 1;
});
