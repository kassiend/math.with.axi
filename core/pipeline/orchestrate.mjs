#!/usr/bin/env node
/**
 * math.with.axi — pipeline orchestrator.
 *
 *   generate → preflight gates → verify (agent + 2-script cross-check) → RENDER GATE → edit
 *            → RENDER GATE → capture (Playwright) → render (Remotion) → ledger
 *
 * §3.5 — the render gate is a hard condition in this script, not a model decision. Playwright
 * and Remotion execute only when verification passed and the Editor did not block. There is no
 * override flag, no --force, and no "warn and continue" branch. If you are about to add one,
 * that is the moment the pipeline stops being worth having.
 *
 * Usage:
 *   node core/pipeline/orchestrate.mjs [--request path/to/request.json] [--dry-run]
 *
 * Exit codes:
 *   0  video rendered
 *   1  infrastructure error (missing dependency, agent crash)
 *   2  gate closed — lesson failed, blocked, or deduped. Not an error; the expected outcome
 *      for a lesson that should not ship.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { generate } from './stages/generate.mjs';
import { verify } from './stages/verify.mjs';
import { edit } from './stages/edit.mjs';
import { capture } from './stages/capture.mjs';
import { render } from './stages/render.mjs';
import * as ledger from './lib/ledger.mjs';
import { CORE, OUT, runDir } from './lib/paths.mjs';

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i === -1 ? undefined : argv[i + 1]; };
const has = (n) => argv.includes(`--${n}`);

// ---------------------------------------------------------------------------

async function main() {
  const run = startRun(flag('request'));
  log(run, 'run.start', { id: run.id, request: run.request });

  // ---- 1. Generate -------------------------------------------------------
  const { payload, gates } = await generate(run);
  log(run, 'generate.done', { concept_slug: payload.concept_slug, gates });

  if (!gates.ok) {
    return close(run, 'failed', 'generator preflight gates', gates.problems, payload);
  }

  // ---- 2. Verify ---------------------------------------------------------
  const { report, cross, verdict } = await verify(run, payload);
  log(run, 'verify.done', { verdict, cross_passed: cross.passed });

  writeRunFile(run, 'verify.summary.json', { report, cross, verdict });

  // ---- RENDER GATE, condition 1: verification passed ---------------------
  if (!verdict.passed) {
    // The mismatch rule: no repair loop exists here on purpose. A failed lesson is discarded.
    return close(run, 'failed', 'verification', verdict.reasons, payload);
  }

  // ---- 3. Edit -----------------------------------------------------------
  const { result, budget, tampered, diff } = await edit(run, payload);
  log(run, 'edit.done', { status: result.status, tampered });

  if (tampered) {
    return close(run, 'failed', 'editor modified a frozen element', diff, payload);
  }

  // ---- RENDER GATE, condition 2: the Editor did not block ----------------
  if (result.status === 'blocked') {
    return close(run, 'blocked', 'editor blocked', [{ reason: result.reason }], payload);
  }

  // The background is a run-level presentation choice, not lesson content — the Generator has no
  // business picking one and the Editor must not touch it. Applied here, after the frozen-element
  // check, so it cannot affect the hash.
  const lesson = { ...result.lesson, background: result.lesson?.background ?? run.request.background };

  if (has('dry-run')) {
    log(run, 'dry-run', { note: 'gate passed; capture and render skipped' });
    return finish(run, 0);
  }

  // ======= Everything past this line runs ONLY because both conditions held =======

  // ---- 4. Capture (Playwright) -------------------------------------------
  const shot = await capture(run, lesson);
  log(run, 'capture.done', { frames: shot.frames, dir: shot.dir });

  // ---- 5. Render (Remotion) ----------------------------------------------
  const mascot = readMascotConfig();
  const video = await render(run, { capture: shot, budget, mascot });
  log(run, 'render.done', { file: video.file });

  // ---- 6. Ledger ---------------------------------------------------------
  ledger.record({
    id: run.id,
    concept_slug: payload.concept_slug,
    title: payload.title,
    tags: payload.tags ?? [],
    status: 'shipped',
    created_at: run.started_at,
    run_dir: path.relative(CORE, run.dir),
    video: path.relative(CORE, video.file),
  });

  console.log(`\n✓ ${video.file}`);
  return finish(run, 0);
}

// ---------------------------------------------------------------------------

function startRun(requestPath) {
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
  const dir = runDir(id);
  fs.mkdirSync(path.join(dir, 'generator.checks'), { recursive: true });

  const defaults = {
    language: 'ru',
    target_seconds: 45,
    aspect: '9:16',
    fps: 30,
    audio: null,
    background: 'bg2.jpeg',   // filename inside web/public/bg/; null for no background
    sampling_hint: { min: 10, max: 9999 },
  };
  const request = requestPath
    ? { ...defaults, ...JSON.parse(fs.readFileSync(path.resolve(requestPath), 'utf8')) }
    : defaults;

  fs.writeFileSync(path.join(dir, 'request.json'), JSON.stringify(request, null, 2));
  return { id, dir, request, started_at: new Date().toISOString(), events: [] };
}

function readMascotConfig() {
  const file = path.join(CORE, 'video', 'mascot.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

function writeRunFile(run, name, data) {
  fs.writeFileSync(path.join(run.dir, name), JSON.stringify(data, null, 2));
}

function log(run, event, data) {
  const entry = { t: new Date().toISOString(), event, ...data };
  run.events.push(entry);
  fs.appendFileSync(path.join(run.dir, 'run.log.jsonl'), JSON.stringify(entry) + '\n');
  console.log(`[${event}]`, JSON.stringify(data).slice(0, 400));
}

/**
 * A closed gate is a normal, recorded outcome. The topic goes into the ledger with its real
 * status so the Generator can count attempts, and the run ends. Nothing downstream runs.
 */
function close(run, status, stage, problems, payload) {
  log(run, 'gate.closed', { status, stage, problems });
  writeRunFile(run, 'outcome.json', { status, stage, problems });

  if (payload?.concept_slug) {
    ledger.record({
      id: run.id,
      concept_slug: payload.concept_slug,
      title: payload.title ?? '(untitled)',
      tags: payload.tags ?? [],
      status: status === 'blocked' ? 'blocked' : 'failed',
      created_at: run.started_at,
      failed_at: stage,
      run_dir: path.relative(CORE, run.dir),
    });
  }

  console.error(`\n✗ gate closed at "${stage}" (${status}). No capture, no render.`);
  for (const p of problems ?? []) console.error('  -', JSON.stringify(p));
  return finish(run, 2);
}

function finish(run, code) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(run.dir, 'run.json'), JSON.stringify(run, null, 2));
  process.exitCode = code;
  return code;
}

main().catch((err) => {
  console.error('\n! pipeline error:', err.stack ?? err.message);
  process.exitCode = 1;
});
