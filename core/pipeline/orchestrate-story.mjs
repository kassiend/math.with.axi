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
import { resolveBin, runTool, FFMPEG, FFPROBE } from './lib/platform.mjs';
import { buildStoryTimeline, FPS } from '../shared/story-timeline.ts';
import { music as generateMusic } from '../tools/elevenlabs.mjs';

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
    // The story's claim is that the formula holds and the derivation follows; both blind scripts
    // report that as `agrees`. Their `computed` strings are descriptions and are not compared.
    const cross = await crossCheck(story.story_id, gen, ver, { compareComputed: false });
    log(run, 'crosscheck', { agreed: cross.agreed, generator: cross.generator.computed, verifier: cross.verifier.computed });
    if (!cross.agreed) return close(run, story, 'failed', 'formula', cross.failures);
  } else {
    log(run, 'crosscheck.skipped', {
      reason: story.nulls?.find((n) => n.field === 'check_script')?.reason ?? 'no check_script supplied',
    });
  }

  // ---- 3. Timeline -------------------------------------------------------
  const mascotGeom = readJson(path.join(PUBLIC, 'mascot', 'story-mascot.json'), 'story-mascot.json');
  // A spoken ask is optional; when present the closing hold stretches to fit it.
  const outroSeconds = narration.outro?.audio ? (narration.outro.seconds ?? null) : null;
  const timeline = buildStoryTimeline(
    narration.beats.map((b) => ({ beat: b.beat, seconds: b.seconds })),
    mascotGeom,
    outroSeconds,
  );
  log(run, 'timeline', {
    total_frames: timeline.totalFrames, total_seconds: timeline.totalSeconds,
    beats: timeline.beats.map((b) => `${b.beat}:${b.seconds}s`),
    mascot: { play: timeline.mascot.play, freeze: timeline.mascot.freeze, resume: timeline.mascot.resume },
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
    // The closing ask — display copy, not a claim. The page has a fallback.
    ask: story.ask ?? null,
    outro_seconds: outroSeconds,
    beats: story.beats.map((b, i) => ({
      beat: b.beat,
      display: b.display,
      seconds: narration.beats[i]?.seconds ?? 0,
      visual: b.visual ?? 'none',
      image: b.visual === 'image' ? imageForBeat(b) : null,
      formula_latex: b.visual === 'formula' ? (b.formula_latex ?? story.formula_latex) : null,
      // The derivation, line by line, when the writer supplied it. The page builds it in time
      // with the narration instead of showing the finished formula for the whole beat.
      formula_steps: b.visual === 'formula' ? (b.formula_steps ?? story.formula_steps ?? null) : null,
      shape_svg: b.visual === 'shape' ? (b.shape_svg ?? null) : null,
      // A huge counted-up number for this beat, when the writer gave one.
      stat: b.stat ?? null,
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
      play: timeline.mascot.play,
      freeze: timeline.mascot.freeze,
      resume: timeline.mascot.resume,
      pauseFrame: timeline.mascot.pauseFrame,
    },
    audio,
    // A whoosh on every beat change; an impact where a stat lands; the bell on the formula.
    sfx: stageSfx(run, 'whoosh.wav', timeline.beats.slice(1).map((b) => b.start), 0.5),
    hits: [
      stageSfx(run, 'impactSoft_heavy_001.wav',
        timeline.beats.filter((b) => story.beats[b.index]?.stat?.value).map((b) => b.start + 2), 0.6),
      stageSfx(run, 'impactBell_heavy_000.wav',
        timeline.beats.filter((b) => story.beats[b.index]?.visual === 'formula').map((b) => b.start + 2), 0.35),
    ].filter((h) => h && h.frames.length),
    music: await stageMusic(run, story, narration, timeline),
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

/** One story SFX from assets/audio/sfx/story/, staged under public/ like the narration. */
function stageSfx(run, name, frames, volume) {
  const src = path.join(ASSETS, 'audio', 'sfx', 'story', name);
  if (!fs.existsSync(src) || !frames.length) return null;
  const dir = path.join(PUBLIC, 'audio', run.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, path.join(dir, name));
  return { src: `audio/${run.id}/${name}`, frames, volume };
}

/**
 * The music bed: generated from the writer's `music_prompt` at the post's length (cached by
 * prompt + length, so a re-render costs nothing), ducked under every narration clip. A story
 * without a music_prompt renders without a bed rather than with a wrong one.
 */
async function stageMusic(run, story, narration, timeline) {
  const prompt = story.music_prompt;
  if (!prompt) { log(run, 'music.skipped', { reason: 'no music_prompt in story.out.json' }); return null; }
  const seconds = Math.ceil(timeline.totalSeconds + 2);
  const dir = path.join(PUBLIC, 'audio', run.id);
  fs.mkdirSync(dir, { recursive: true });
  let file;
  try {
    ({ file } = await generateMusic(prompt, seconds, path.join(dir, 'music.mp3')));
  } catch (err) {
    log(run, 'music.failed', { error: String(err.message).slice(0, 200) });
    return null;
  }
  // Keep a copy in the run dir so the render is reproducible from it.
  fs.copyFileSync(file, path.join(run.dir, 'audio', 'music.mp3'));
  const speech = narration.beats.map((b, i) => ({
    from: timeline.beats[i].start, to: timeline.beats[i].start + Math.round(b.seconds * FPS),
  }));
  if (!timeline.outro.silent) speech.push({ from: timeline.outro.start, to: timeline.outro.end });
  log(run, 'music.ready', { seconds, prompt: prompt.slice(0, 80) });
  return { src: `audio/${run.id}/music.mp3`, speech, bed: 0.5, duck: 0.16, rampFrames: 10, totalFrames: timeline.totalFrames };
}

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
    // Scaled once to what the card can show (612x1040 design px at the 1.5x capture = 918x1560)
    // and re-encoded as JPEG. A 2-3 MB 9:16 PNG composited with a blur on every frame halved the
    // capture rate; the card cannot show more pixels than this anyway.
    const name = `${img.image_id}.jpg`;
    try {
      execFileSync(FFMPEG, ['-y', '-v', 'error', '-i', abs,
        '-vf', "scale='if(gt(a,918/1560),-2,918)':'if(gt(a,918/1560),1560,-2)'",
        '-q:v', '3', path.join(dir, name)], { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch {
      fs.copyFileSync(abs, path.join(dir, `${img.image_id}${path.extname(abs)}`));
      map[img.image_id] = `./story-images/${run.id}/${img.image_id}${path.extname(abs)}`;
      continue;
    }
    map[img.image_id] = `./story-images/${run.id}/${name}`;
  }
  return map;
}

/** Stage narration under video/public and place each clip where its beat starts. */
function stageAudio(run, narration, timeline) {
  const dir = path.join(PUBLIC, 'audio', run.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const copy = (src, name) => {
    fs.copyFileSync(path.isAbsolute(src) ? src : path.join(run.dir, src), path.join(dir, name));
    return `audio/${run.id}/${name}`;
  };
  const clips = narration.beats.map((b, i) => ({
    id: b.beat,
    src: copy(b.audio, `${b.beat}.mp3`),
    from: timeline.beats[i].start,
    durationInFrames: Math.max(1, Math.round(b.seconds * FPS)),
  }));
  if (!timeline.outro.silent) {
    clips.push({
      id: 'outro',
      src: copy(narration.outro.audio, 'outro.mp3'),
      from: timeline.outro.start,
      durationInFrames: timeline.outro.end - timeline.outro.start,
    });
  }
  return { clips };
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
