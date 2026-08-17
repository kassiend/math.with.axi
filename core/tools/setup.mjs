#!/usr/bin/env node
/**
 * One-command setup for a fresh clone.
 *
 * The repository deliberately does not track anything that can be rebuilt — node_modules, the
 * venv, the 2 GB of capture frames, the keyed mascot clips, the staged backgrounds, the web
 * build. That keeps the repository usable, but it means a fresh clone cannot render anything
 * until those are made. Doing it by hand is seven commands in the right order, and getting the
 * order wrong fails in ways that do not name the missing step.
 *
 *   node core/tools/setup.mjs           # everything
 *   node core/tools/setup.mjs --check   # report what is missing, change nothing
 *
 * Runs on macOS, Windows and Linux.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CORE, PYTHON, ROOT, NODE_BIN } from '../pipeline/lib/paths.mjs';
import { findExecutable, isWindows, resolveBin, runTool } from '../pipeline/lib/platform.mjs';

const CHECK_ONLY = process.argv.includes('--check');

const steps = [];
const step = (name, isDone, run, hint) => steps.push({ name, isDone, run, hint });

const exists = (p) => fs.existsSync(p);
const venvDir = path.join(CORE, '.venv');

// --- what a fresh clone is missing, in dependency order ---------------------

step('node dependencies',
  () => exists(path.join(CORE, 'node_modules', 'remotion')),
  () => runTool(resolveBin('npm'), ['install', '--no-fund', '--no-audit'], { cwd: CORE, stdio: 'inherit' }),
  'npm install (in core/)');

step('python venv',
  () => exists(PYTHON),
  () => {
    const py = findExecutable(isWindows ? 'py' : 'python3') ?? findExecutable('python');
    if (!py) throw new Error('no python3 on PATH — install Python 3 first');
    execFileSync(py, isWindows ? ['-3', '-m', 'venv', venvDir] : ['-m', 'venv', venvDir], { stdio: 'inherit' });
  },
  isWindows ? 'py -3 -m venv core\\.venv' : 'python3 -m venv core/.venv');

step('sympy',
  () => spawnSync(PYTHON, ['-c', 'import sympy'], { stdio: 'ignore' }).status === 0,
  () => execFileSync(PYTHON, ['-m', 'pip', 'install', '--quiet', 'sympy', 'pillow'], { stdio: 'inherit' }),
  'core/.venv pip install sympy pillow');

step('playwright chromium',
  () => {
    const roots = [
      process.env.PLAYWRIGHT_BROWSERS_PATH,
      isWindows && process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'),
      process.env.HOME && path.join(process.env.HOME, 'Library', 'Caches', 'ms-playwright'),
      process.env.HOME && path.join(process.env.HOME, '.cache', 'ms-playwright'),
    ].filter(Boolean);
    return roots.some((r) => exists(r) && fs.readdirSync(r).some((e) => e.startsWith('chromium')));
  },
  () => runTool(resolveBin('playwright', { localBinDir: NODE_BIN }), ['install', 'chromium'], { cwd: CORE, stdio: 'inherit' }),
  'playwright install chromium');

step('agent definitions',
  () => exists(path.join(ROOT, '.claude', 'agents', 'axi-verifier.md')),
  () => execFileSync(process.execPath, [path.join(CORE, 'tools', 'sync-agents.mjs')], { stdio: 'inherit' }),
  'node core/tools/sync-agents.mjs');

step('backgrounds staged',
  () => exists(path.join(CORE, 'web', 'public', 'bg', 'index.json')),
  () => execFileSync(process.execPath, [path.join(CORE, 'tools', 'sync-backgrounds.mjs')], { stdio: 'inherit' }),
  'node core/tools/sync-backgrounds.mjs');

step('mascot keyed',
  () => exists(path.join(CORE, 'video', 'public', 'mascot', 'mas_chromo.webm')),
  () => execFileSync(process.execPath, [path.join(CORE, 'tools', 'chromakey.mjs')], { stdio: 'inherit' }),
  'node core/tools/chromakey.mjs   (needs ffmpeg)');

step('mascot still extracted',
  () => exists(path.join(CORE, 'web', 'public', 'mascot', 'axi-still.json')),
  () => execFileSync(process.execPath, [path.join(CORE, 'tools', 'extract-mascot-still.mjs')], { stdio: 'inherit' }),
  'node core/tools/extract-mascot-still.mjs');

step('web pages built',
  () => exists(path.join(CORE, 'web', 'dist', 'task.html'))
     && exists(path.join(CORE, 'web', 'dist', 'lesson.html')),
  () => runTool(resolveBin('npm'), ['run', 'web:build'], { cwd: CORE, stdio: 'inherit' }),
  'npm run web:build');

step('.env present',
  () => exists(path.join(ROOT, '.env')),
  () => {
    // Never generated with values — secrets are the one thing setup must not invent.
    fs.copyFileSync(path.join(ROOT, '.env.example'), path.join(ROOT, '.env'));
    console.log('  copied .env.example -> .env — now fill in TELEGRAM_BOT_TOKEN and ELEVENLABS_API_KEY');
  },
  'copy .env.example to .env and fill in the keys');

// ---------------------------------------------------------------------------

let failed = 0;
for (const s of steps) {
  let done = false;
  try { done = s.isDone(); } catch { done = false; }

  if (done) { console.log(`✓ ${s.name}`); continue; }
  if (CHECK_ONLY) { console.log(`✗ ${s.name}   →  ${s.hint}`); failed++; continue; }

  console.log(`\n▸ ${s.name}`);
  try {
    s.run();
    console.log(`✓ ${s.name}`);
  } catch (err) {
    console.error(`✗ ${s.name} failed: ${String(err.message).split('\n')[0]}`);
    console.error(`  do it by hand:  ${s.hint}`);
    failed++;
  }
}

console.log();
if (failed) {
  console.error(`${failed} step(s) still need attention.`);
  process.exitCode = 1;
} else {
  console.log('Setup complete. Next:  npm run worker -- status');
}
