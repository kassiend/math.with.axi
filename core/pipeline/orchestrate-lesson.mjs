#!/usr/bin/env node
/**
 * Lesson post pipeline.
 *
 *   plan + narration -> cross-check (two independent SymPy scripts) -> 60 s ceiling
 *                    -> RENDER GATE -> capture (Playwright) -> compose (Remotion) -> ledger
 *
 * Three hard conditions guard the render, all in code:
 *   1. the SymPy cross-check agreed
 *   2. the total runtime is under 60 seconds
 *   3. every display line fits the card (enforced in the capture stage)
 *
 * None has an override flag.
 *
 * Usage:
 *   node core/pipeline/orchestrate-lesson.mjs --run <run-dir> [--seed N] [--dry-run] [--rerender]
 */
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { captureLesson, DisplayTextDoesNotFit } from './stages/capture-lesson.mjs';
import { crossCheck } from './lib/sympy.mjs';
import * as ledger from './lib/ledger.mjs';
import { ASSETS, CORE, NODE_BIN, ROOT } from './lib/paths.mjs';
import { resolveBin, runTool, isWindows } from './lib/platform.mjs';
import { buildLessonTimeline, MAX_FRAMES, FPS } from '../shared/lesson-timeline.ts';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const has = (n) => argv.includes(`--${n}`);

const PUBLIC = path.join(CORE, 'video', 'public');

// ---------------------------------------------------------------------------

async function main() {
  const runDir = path.resolve(flag('run') ?? '');
  const plan = readJson(path.join(runDir, 'plan.out.json'), 'plan.out.json');
  const narration = readJson(path.join(runDir, 'narration.out.json'), 'narration.out.json');

  const seed = Number(flag('seed', hashSeed(plan.lesson_id)));
  const run = { id: `lesson-${plan.lesson_id}`, dir: runDir, started_at: new Date().toISOString(), seed };
  log(run, 'run.start', { lesson_id: plan.lesson_id, counter: plan.counter, seed });

  // ---- 1. Dedup ----------------------------------------------------------
  if (!has('rerender')) {
    const cand = ledger.findCandidates(plan.concept_slug, plan.tags);
    if (cand.blocked.length) return close(run, plan, 'blocked', 'dedup', cand.blocked);
  }

  // The counter is authoritative from the ledger, not from the plan — a planner that guessed it
  // would break the series numbering the audience follows.
  const counter = has('rerender') ? plan.counter : ledger.nextCounter();
  if (counter !== plan.counter) {
    log(run, 'counter.corrected', { planned: plan.counter, actual: counter });
  }

  // ---- 2. Independent verification ---------------------------------------
  const generatorScript = path.join(runDir, 'generator.checks', `${plan.lesson_id}.py`);
  const verifierScript = path.join(runDir, 'verifier.box', 'verifier.checks', `${plan.lesson_id}.py`);
  const cross = await crossCheck(plan.lesson_id, generatorScript, verifierScript);
  log(run, 'crosscheck', {
    agreed: cross.agreed, generator: cross.generator.computed, verifier: cross.verifier.computed,
  });

  // ---- RENDER GATE, condition 1 ------------------------------------------
  if (!cross.agreed) return close(run, plan, 'failed', 'verification', cross.failures);

  // ---- 3. Timeline + ceiling ---------------------------------------------
  const timeline = buildLessonTimeline(
    narration.intro.seconds,
    narration.steps.map((s) => ({ stepId: s.step_id, seconds: s.seconds })),
  );
  log(run, 'timeline', {
    total_frames: timeline.totalFrames, total_seconds: timeline.totalSeconds,
    steps: timeline.steps.map((s) => `${s.stepId}:${s.seconds}s`),
  });

  // ---- RENDER GATE, condition 2 ------------------------------------------
  if (timeline.overCeiling) {
    return close(run, plan, 'blocked', 'over-60s-ceiling', [{
      total_seconds: timeline.totalSeconds,
      note: 'hand the narration to axi-editor to cut, then re-synthesize only the changed clips',
    }]);
  }

  const picks = pickAssets(seed);
  const still = readJson(path.join(CORE, 'web', 'public', 'mascot', 'axi-still.json'), 'axi-still.json');
  log(run, 'picks', { background: path.basename(picks.background) });

  const lessonPayload = {
    title: `Math tricks #${counter}`,
    background: path.basename(picks.background),
    still,
    intro_seconds: narration.intro.seconds,
    steps: plan.steps.map((s, i) => ({
      step_id: s.step_id,
      instruction: s.instruction,
      working: s.working,
      seconds: narration.steps[i]?.seconds ?? 0,
    })),
  };

  if (has('dry-run')) {
    log(run, 'dry-run', { note: 'gates passed; capture and render skipped' });
    return 0;
  }

  // ======= Past this line only because verification agreed and the runtime fits =======

  // ---- 4. Capture ---------------------------------------------------------
  let shot;
  try {
    shot = await captureLesson(run, lessonPayload, {
      onProgress: (done, total, ms) =>
        process.stdout.write(`\r  capture ${done}/${total}  ${(ms / 1000).toFixed(1)}s   `),
    });
    process.stdout.write('\n');
  } catch (err) {
    // ---- RENDER GATE, condition 3 ----------------------------------------
    if (err instanceof DisplayTextDoesNotFit) {
      return close(run, plan, 'blocked', 'display-text-does-not-fit', [{ reason: err.message }]);
    }
    throw err;
  }
  log(run, 'capture.done', { frames: shot.frames });

  // ---- 5. Compose ---------------------------------------------------------
  const audio = stageAudio(run, narration, timeline);
  const props = {
    runId: run.id,
    capture: {
      publicPath: shot.publicPath, frames: shot.frames, fps: shot.fps,
      width: shot.width, height: shot.height,
    },
    intro: {
      src: 'mascot/mas_chromo.webm',
      // The mascot clip is fixed-length; if the narration runs longer the clip stops and the page
      // is already showing its last frame underneath, so nothing pops.
      clipFrames: Math.min(152, timeline.intro.end),
      box: {
        left: still.intro_video.left, top: still.intro_video.top,
        width: still.intro_video.width, height: still.intro_video.height,
      },
    },
    audio,
  };

  const propsFile = path.join(runDir, 'remotion.props.json');
  fs.writeFileSync(propsFile, JSON.stringify(props, null, 2));

  const outFile = path.join(CORE, 'out', 'renders', `${run.id}.mp4`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  // The local shim rather than npx: npx is an extra resolution step that breaks on Windows,
  // where the installed CLI is remotion.cmd and execFile cannot run a .cmd without a shell.
  runTool(resolveBin('remotion', { localBinDir: NODE_BIN }), [
    'render', path.join(CORE, 'video', 'index.ts'), 'LessonPost', outFile,
    '--props', propsFile, '--public-dir', PUBLIC, '--concurrency', '1', '--log', 'info',
  ], { cwd: CORE, stdio: ['ignore', 'inherit', 'inherit'], maxBuffer: 1 << 24 });

  if (!fs.existsSync(outFile)) throw new Error(`remotion reported success but ${outFile} is missing`);

  // ---- 6. Publish + ledger ------------------------------------------------
  const published = path.join(ROOT, 'output', 'posts', 'lessons', `${plan.lesson_id}.mp4`);
  fs.mkdirSync(path.dirname(published), { recursive: true });
  fs.copyFileSync(outFile, published);

  if (has('rerender')) {
    const l = ledger.load();
    l.entries = l.entries.filter((e) => e.id !== run.id);
    ledger.save(l);
  }
  ledger.record({
    id: run.id,
    concept_slug: plan.concept_slug,
    title: plan.method_name,
    tags: plan.tags ?? [],
    counter,
    status: 'shipped',
    created_at: run.started_at,
    seconds: timeline.totalSeconds,
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

function pickAssets(seed) {
  const pick = (list, salt) => list[Math.abs(hashSeed(`${seed}:${salt}`)) % list.length];
  const bgs = fs.readdirSync(path.join(ASSETS, 'images', 'bg'))
    .filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
  return { background: path.join(ASSETS, 'images', 'bg', pick(bgs, 'bg')) };
}

/**
 * Stage the narration under video/public and place each clip on the timeline.
 * The intro clip starts at frame 0; each step's clip starts when its step does. Nothing is
 * stretched — the step lengths were derived from these very durations.
 */
function stageAudio(run, narration, timeline) {
  const dir = path.join(PUBLIC, 'audio', run.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const clips = [];
  const copy = (src, name) => {
    const abs = path.isAbsolute(src) ? src : path.join(run.dir, src);
    fs.copyFileSync(abs, path.join(dir, name));
    return `audio/${run.id}/${name}`;
  };

  clips.push({
    id: 'intro',
    src: copy(narration.intro.audio, 'intro.mp3'),
    from: 0,
    durationInFrames: Math.round(narration.intro.seconds * FPS),
  });

  narration.steps.forEach((s, i) => {
    const phase = timeline.steps[i];
    clips.push({
      id: s.step_id,
      src: copy(s.audio, `${s.step_id}.mp3`),
      from: phase.start,
      durationInFrames: phase.end - phase.start,
    });
  });

  return { clips };
}

function hashSeed(s) {
  return crypto.createHash('sha256').update(String(s)).digest().readInt32BE(0);
}

function log(run, event, data) {
  const entry = { t: new Date().toISOString(), event, ...data };
  fs.appendFileSync(path.join(run.dir, 'run.log.jsonl'), JSON.stringify(entry) + '\n');
  console.log(`[${event}]`, JSON.stringify(data));
}

function close(run, plan, status, stage, problems) {
  // A dry run must not mutate state. Recording a rejection during a rehearsal would count
  // against future attempts on a topic that was never actually tried.
  if (has('dry-run')) {
    console.error(`\n[dry-run] gate would close at "${stage}" (${status}); nothing recorded.`);
    process.exitCode = 2;
    return 2;
  }
  log(run, 'gate.closed', { status, stage, problems });
  fs.writeFileSync(path.join(run.dir, 'outcome.json'), JSON.stringify({ status, stage, problems }, null, 2));
  ledger.record({
    id: run.id, concept_slug: plan.concept_slug, title: plan.method_name ?? '(untitled)',
    tags: plan.tags ?? [], status: status === 'blocked' ? 'blocked' : 'failed',
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
