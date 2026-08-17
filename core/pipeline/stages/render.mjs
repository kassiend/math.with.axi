/**
 * Stage 5 — Remotion render.
 *
 * Composes the Playwright PNG sequence, the chroma-keyed mascot layer, and the hand-authored
 * narration audio into the final 1080x1920 file.
 *
 * This stage runs only when the render gate in orchestrate.mjs has already passed. It does not
 * re-check verification — a stage that second-guesses the gate invites someone to weaken the gate.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { CORE, NODE_BIN, RENDERS } from '../lib/paths.mjs';
import { resolveBin, runTool, isWindows } from '../lib/platform.mjs';

const run_ = promisify(execFile);

export const COMPOSITION_ID = 'Lesson';

export async function render(run, { capture, budget, mascot }) {
  fs.mkdirSync(RENDERS, { recursive: true });
  const outFile = path.join(RENDERS, `${run.id}.mp4`);

  // staticFile() only resolves paths inside the public dir, and the narration lives in
  // /assets. Stage it in rather than reaching outside — a render that depends on a path
  // outside public breaks the moment the project moves.
  const audio = budget.mode === 'audio-locked'
    ? stageAudio(run.id, budget.segments)
    : [];

  const props = {
    runId: run.id,
    capture: { publicPath: capture.publicPath, frames: capture.frames, fps: capture.fps },
    audio,
    mascot: mascot ?? null,
    durationInFrames: capture.frames,
  };

  const propsFile = path.join(run.dir, 'remotion.props.json');
  fs.writeFileSync(propsFile, JSON.stringify(props, null, 2));

  const args = [
    'render',
    path.join(CORE, 'video', 'index.ts'),
    COMPOSITION_ID,
    outFile,
    '--props', propsFile,
    // staticFile() resolves against this directory; captures and audio are copied under it.
    '--public-dir', path.join(CORE, 'video', 'public'),
    '--concurrency', '1',        // deterministic frame order over raw speed
    '--log', 'info',
  ];

  await run_(resolveBin('remotion', { localBinDir: NODE_BIN }), args, { cwd: CORE, maxBuffer: 1 << 24, shell: isWindows });

  if (!fs.existsSync(outFile)) throw new Error(`remotion reported success but ${outFile} is missing`);
  return { file: outFile, props: propsFile };
}

/** Copy narration segments under video/public/audio/<runId>/ and return staticFile-relative paths. */
function stageAudio(runId, segments) {
  const dir = path.join(CORE, 'video', 'public', 'audio', runId);
  fs.mkdirSync(dir, { recursive: true });
  return segments
    .filter((s) => s.file && fs.existsSync(s.file) && s.seconds != null)
    .map((s) => {
      const name = `${s.id}${path.extname(s.file)}`;
      fs.copyFileSync(s.file, path.join(dir, name));
      return { id: s.id, seconds: s.seconds, src: `audio/${runId}/${name}` };
    });
}
