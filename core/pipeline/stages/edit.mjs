/**
 * Stage 3 — Editor (Agent C).
 *
 * Timing on this pipeline comes from hand-authored narration audio, not TTS. Two budget modes:
 *   audio-locked — an audio track exists; segment durations are measured with ffprobe and the
 *                  script must fit them
 *   estimated    — no audio yet; cut against target_seconds at a stated chars-per-second
 *
 * The frozen-element hash is taken before the Editor runs and re-checked after. A changed hash
 * fails the run regardless of what the Editor reports.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { runAgent } from '../lib/agent-runner.mjs';
import { frozenHash, frozenDiff } from '../lib/payload.mjs';
import { ROOT } from '../lib/paths.mjs';
import { FFPROBE } from '../lib/platform.mjs';

const run_ = promisify(execFile);

export const RUNTIME_MIN_S = 30;
export const RUNTIME_MAX_S = 60;
export const RUNTIME_TARGET_S = 45;
/** Only used in "estimated" mode, and flagged as an estimate downstream. */
export const CHARS_PER_SECOND = 14;

export async function edit(run, lesson) {
  const before = frozenHash(lesson);
  const budget = await buildBudget(run);

  fs.writeFileSync(path.join(run.dir, 'editor.in.json'), JSON.stringify(lesson, null, 2));
  fs.writeFileSync(path.join(run.dir, 'editor.budget.json'), JSON.stringify(budget, null, 2));

  const outFile = path.join(run.dir, 'editor.out.json');
  const result = await runAgent({
    agent: 'axi-editor',
    cwd: ROOT,
    allowedTools: ['Read', 'Write'],
    expectFile: outFile,
    prompt: [
      `Read ${path.join(run.dir, 'editor.in.json')} and ${path.join(run.dir, 'editor.budget.json')}.`,
      `Write ${outFile}.`,
      'If the only way to hit the budget is to cut a frozen element, return the lesson unedited',
      'with status "blocked" and a reason.',
    ].join('\n'),
  });

  const after = frozenHash(result.lesson ?? {});
  const tampered = before !== after;

  return {
    result,
    budget,
    tampered,
    // A blocked lesson is a normal outcome and stops the render. Tampering is a failure.
    diff: tampered ? frozenDiff(lesson, result.lesson ?? {}) : [],
  };
}

/**
 * Audio-locked when the run declares narration audio; estimated otherwise.
 * Durations are measured, never guessed — ffprobe is already a dependency of the render stage.
 */
export async function buildBudget(run) {
  const declared = run.request?.audio;
  if (!declared?.segments?.length) {
    return {
      mode: 'estimated',
      target_seconds: run.request?.target_seconds ?? RUNTIME_TARGET_S,
      min_seconds: RUNTIME_MIN_S,
      max_seconds: RUNTIME_MAX_S,
      chars_per_second: CHARS_PER_SECOND,
      note: 'No narration audio declared. Durations are an estimate and the render stage must not treat them as measured.',
    };
  }

  const segments = [];
  for (const seg of declared.segments) {
    const file = path.isAbsolute(seg.file) ? seg.file : path.join(ROOT, seg.file);
    segments.push({ id: seg.id, file, seconds: await probeDuration(file) });
  }
  const total = segments.reduce((s, x) => s + (x.seconds ?? 0), 0);

  return {
    mode: 'audio-locked',
    segments,
    total_seconds: Number(total.toFixed(3)),
    min_seconds: RUNTIME_MIN_S,
    max_seconds: RUNTIME_MAX_S,
    note: 'Segment durations are fixed. The script fits the audio; the audio does not stretch.',
  };
}

async function probeDuration(file) {
  if (!fs.existsSync(file)) return null;
  try {
    const { stdout } = await run_(FFPROBE, [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', file,
    ]);
    const seconds = Number(stdout.trim());
    return Number.isFinite(seconds) ? Number(seconds.toFixed(3)) : null;
  } catch {
    return null;
  }
}
