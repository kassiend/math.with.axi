#!/usr/bin/env node
/**
 * Daily-task post pipeline.
 *
 *   task payload -> cross-check (two independent SymPy scripts) -> RENDER GATE
 *                -> capture (Playwright) -> compose (Remotion) -> ledger -> output/
 *
 * Two hard conditions guard the render, both in code:
 *   1. the SymPy cross-check agreed
 *   2. the statement fits inside the ring (enforced in the capture stage)
 *
 * Neither has an override flag. A statement that overflows the ring is a defect the viewer sees,
 * and an unverified answer is worse than no post.
 *
 * Usage:
 *   node core/pipeline/orchestrate-task.mjs --run <run-dir> [--seed 12345] [--dry-run]
 */
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { captureTask, StatementDoesNotFit } from './stages/capture-task.mjs';
import { crossCheck } from './lib/sympy.mjs';
import * as tasksLedger from './lib/tasks-ledger.mjs';
import { ASSETS, CORE, ROOT } from './lib/paths.mjs';
import { buildTaskTimeline } from '../shared/task-timeline.ts';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const has = (n) => argv.includes(`--${n}`);

const PUBLIC = path.join(CORE, 'video', 'public');
/** dumdum is a full-frame graphic, not a keyable subject — see docs/mascot-keying.md. */
const HURRY_POOL = ['hurry-hurry.webm', 'hurry-papapa.webm', 'hurry-witchcat.webm'];

// ---------------------------------------------------------------------------

async function main() {
  const runDir = path.resolve(flag('run') ?? '');
  if (!fs.existsSync(path.join(runDir, 'task.out.json'))) {
    fail(`no task.out.json in ${runDir}`);
  }

  const task = JSON.parse(fs.readFileSync(path.join(runDir, 'task.out.json'), 'utf8'));
  const seed = Number(flag('seed', hashSeed(task.task_id)));
  const run = { id: `task-${task.task_id}`, dir: runDir, started_at: new Date().toISOString(), seed };

  log(run, 'run.start', { task_id: task.task_id, duration_s: task.duration_s, seed });

  // ---- 1. Dedup ----------------------------------------------------------
  const dup = tasksLedger.statementExists(task.statement);
  if (dup.duplicate) return close(run, task, 'rejected', 'dedup', [dup]);
  const cand = tasksLedger.findCandidates(task.structure_id, task.categories, task.duration_s);
  if (cand.blocked.length) return close(run, task, 'rejected', 'dedup', cand.blocked);

  // ---- 2. Independent verification ---------------------------------------
  const generatorScript = path.join(runDir, task.check_script);
  const verifierScript = path.join(runDir, 'verifier.box', 'verifier.checks', `${task.task_id}.py`);
  const cross = await crossCheck(task.task_id, generatorScript, verifierScript);
  log(run, 'crosscheck', { agreed: cross.agreed, generator: cross.generator.computed, verifier: cross.verifier.computed });

  // ---- RENDER GATE, condition 1 ------------------------------------------
  if (!cross.agreed) return close(run, task, 'failed', 'verification', cross.failures);

  // ---- 3. Seeded asset picks ---------------------------------------------
  const picks = pickAssets(seed);
  const hurryAudioSeconds = probeDuration(picks.midAudio);
  const timeline = buildTaskTimeline(task.duration_s, seed, hurryAudioSeconds);
  log(run, 'picks', { ...relPicks(picks), hurry_audio_s: hurryAudioSeconds,
                      total_frames: timeline.totalFrames, hurry_enter: timeline.hurry.enter });

  const still = JSON.parse(fs.readFileSync(path.join(CORE, 'web', 'public', 'mascot', 'axi-still.json'), 'utf8'));

  if (has('dry-run')) {
    log(run, 'dry-run', { note: 'gates passed; capture and render skipped' });
    return 0;
  }

  // ======= Past this line only because the cross-check agreed =======

  // ---- 4. Capture ---------------------------------------------------------
  let shot;
  try {
    shot = await captureTask(run, {
      ...task,
      seed,
      background: path.basename(picks.background),
      still,
      hurry_audio_seconds: hurryAudioSeconds,
    }, {
      onProgress: (done, total, ms) =>
        process.stdout.write(`\r  capture ${done}/${total}  ${(ms / 1000).toFixed(1)}s   `),
    });
    process.stdout.write('\n');
  } catch (err) {
    // ---- RENDER GATE, condition 2 ----------------------------------------
    if (err instanceof StatementDoesNotFit) {
      return close(run, task, 'rejected', 'statement-does-not-fit', [{ reason: err.message }]);
    }
    throw err;
  }
  log(run, 'capture.done', { frames: shot.frames, font_size: shot.fit.fontSize });

  // ---- 5. Compose ---------------------------------------------------------
  const audio = stageAudio(run.id, picks, timeline);
  const props = {
    runId: run.id,
    capture: { publicPath: shot.publicPath, frames: shot.frames, fps: shot.fps,
               width: shot.width, height: shot.height },
    intro: {
      src: 'mascot/mas_chromo.webm',
      endFrame: timeline.intro.end,
      box: { left: still.intro_video.left, top: still.intro_video.top,
             width: still.intro_video.width, height: still.intro_video.height },
    },
    hurry: {
      src: `mascot/${picks.hurryClip}`,
      enter: timeline.hurry.enter,
      exit: timeline.hurry.exit,
      clipSeconds: probeDuration(path.join(PUBLIC, 'mascot', picks.hurryClip)),
    },
    audio,
  };

  const propsFile = path.join(runDir, 'remotion.props.json');
  fs.writeFileSync(propsFile, JSON.stringify(props, null, 2));

  const outFile = path.join(CORE, 'out', 'renders', `${run.id}.mp4`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  execFileSync('npx', [
    'remotion', 'render', path.join(CORE, 'video', 'index.ts'), 'Task', outFile,
    '--props', propsFile, '--public-dir', PUBLIC, '--concurrency', '1', '--log', 'info',
  ], { cwd: CORE, stdio: ['ignore', 'inherit', 'inherit'], maxBuffer: 1 << 24 });

  if (!fs.existsSync(outFile)) throw new Error(`remotion reported success but ${outFile} is missing`);

  // ---- 6. Publish + ledger ------------------------------------------------
  const published = path.join(ROOT, 'output', 'posts', 'tasks', `${task.duration_s}s`, `${task.task_id}.mp4`);
  fs.mkdirSync(path.dirname(published), { recursive: true });
  fs.copyFileSync(outFile, published);

  tasksLedger.record({
    task_id: task.task_id,
    duration_s: task.duration_s,
    structure_id: task.structure_id,
    categories: task.categories,
    statement: task.statement,
    answer: task.answer,
    status: 'shipped',
    created_at: run.started_at,
    seed,
    video: path.relative(ROOT, published),
    run_dir: path.relative(CORE, runDir),
  });

  log(run, 'done', { video: path.relative(ROOT, published) });
  console.log(`\n✓ ${published}`);
  return 0;
}

// ---------------------------------------------------------------------------

/** Deterministic picks so a post can be rebuilt byte-identical from its seed. */
function pickAssets(seed) {
  const pick = (list, salt) => list[Math.abs(hashSeed(`${seed}:${salt}`)) % list.length];
  const bgs = fs.readdirSync(path.join(ASSETS, 'images', 'bg')).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
  const starts = fs.readdirSync(path.join(ASSETS, 'audio', 'start_audio')).filter((f) => f.endsWith('.mp3')).sort();
  const mids = fs.readdirSync(path.join(ASSETS, 'audio', 'mid_audio')).filter((f) => f.endsWith('.mp3')).sort();
  const hurries = HURRY_POOL.filter((f) => fs.existsSync(path.join(PUBLIC, 'mascot', f)));

  return {
    background: path.join(ASSETS, 'images', 'bg', pick(bgs, 'bg')),
    startAudio: path.join(ASSETS, 'audio', 'start_audio', pick(starts, 'start')),
    midAudio: path.join(ASSETS, 'audio', 'mid_audio', pick(mids, 'mid')),
    tick: path.join(ASSETS, 'audio', 'sfx', 'tick.wav'),
    hurryClip: pick(hurries, 'hurry'),
  };
}

const relPicks = (p) => ({
  background: path.basename(p.background), start_audio: path.basename(p.startAudio),
  mid_audio: path.basename(p.midAudio), hurry_clip: p.hurryClip,
});

/** staticFile() only resolves inside the public dir, so the audio is staged in rather than linked. */
function stageAudio(runId, picks, timeline) {
  const dir = path.join(PUBLIC, 'audio', runId);
  fs.mkdirSync(dir, { recursive: true });
  const copy = (src, name) => { fs.copyFileSync(src, path.join(dir, name)); return `audio/${runId}/${name}`; };
  return {
    start: copy(picks.startAudio, 'start.mp3'),
    tick: copy(picks.tick, 'tick.wav'),
    tickFrames: timeline.tickFrames,
    mid: copy(picks.midAudio, 'mid.mp3'),
    midFrame: timeline.hurry.enter,
  };
}

function probeDuration(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ], { encoding: 'utf8' }).trim();
  const s = Number(out);
  if (!Number.isFinite(s)) throw new Error(`could not measure ${file}`);
  return s;
}

function hashSeed(s) {
  return crypto.createHash('sha256').update(String(s)).digest().readInt32BE(0);
}

function log(run, event, data) {
  const entry = { t: new Date().toISOString(), event, ...data };
  fs.appendFileSync(path.join(run.dir, 'run.log.jsonl'), JSON.stringify(entry) + '\n');
  console.log(`[${event}]`, JSON.stringify(data));
}

/** A closed gate is a recorded outcome, not a crash. Nothing downstream runs. */
function close(run, task, status, stage, problems) {
  log(run, 'gate.closed', { status, stage, problems });
  fs.writeFileSync(path.join(run.dir, 'outcome.json'), JSON.stringify({ status, stage, problems }, null, 2));
  tasksLedger.record({
    task_id: task.task_id, duration_s: task.duration_s, structure_id: task.structure_id,
    categories: task.categories, statement: task.statement, answer: task.answer,
    status, created_at: run.started_at, failed_at: stage,
  });
  console.error(`\n✗ gate closed at "${stage}" (${status}). No capture, no render.`);
  for (const p of problems ?? []) console.error('  -', JSON.stringify(p));
  process.exitCode = 2;
  return 2;
}

function fail(msg) { console.error(msg); process.exit(1); }

main().catch((err) => {
  console.error('\n! pipeline error:', err.stack ?? err.message);
  process.exitCode = 1;
});
