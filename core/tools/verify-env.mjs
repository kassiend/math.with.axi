#!/usr/bin/env node
/**
 * Checks every dependency the pipeline actually shells out to. Run it after install and after
 * any machine change. It reports; it does not install anything.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CORE, PYTHON, ASSETS } from '../pipeline/lib/paths.mjs';

const results = [];
const check = (name, fn, { required = true } = {}) => {
  try {
    results.push({ name, ok: true, detail: fn(), required });
  } catch (err) {
    results.push({ name, ok: false, detail: String(err.message).split('\n')[0], required });
  }
};

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const pkgVersion = (name) => {
  const p = path.join(CORE, 'node_modules', name, 'package.json');
  if (!fs.existsSync(p)) throw new Error(`${name} not installed`);
  return JSON.parse(fs.readFileSync(p, 'utf8')).version;
};

check('node', () => process.version);
check('ffmpeg', () => sh('ffmpeg', ['-version']).split('\n')[0]);
check('ffprobe', () => sh('ffprobe', ['-version']).split('\n')[0]);
check('claude cli', () => sh('claude', ['--version']));

check('react', () => pkgVersion('react'));
check('remotion', () => pkgVersion('remotion'));
check('@remotion/cli', () => pkgVersion('@remotion/cli'));
check('katex', () => pkgVersion('katex'));
check('playwright', () => pkgVersion('playwright'));
check('vite', () => pkgVersion('vite'));

check('python venv', () => {
  if (!fs.existsSync(PYTHON)) throw new Error(`missing ${PYTHON} — python3 -m venv core/.venv`);
  return sh(PYTHON, ['--version']);
});
check('sympy', () => sh(PYTHON, ['-c', 'import sympy; print(sympy.__version__)']));

check('chromium (playwright)', () => {
  const out = sh('npx', ['playwright', '--version']);
  const cacheDirs = [
    path.join(process.env.HOME ?? '', 'Library/Caches/ms-playwright'),
    path.join(process.env.HOME ?? '', '.cache/ms-playwright'),
  ];
  const found = cacheDirs.some((d) => fs.existsSync(d) &&
    fs.readdirSync(d).some((e) => e.startsWith('chromium')));
  if (!found) throw new Error('chromium not downloaded — npx playwright install chromium');
  return out;
});

check('web build', () => {
  const p = path.join(CORE, 'web', 'dist', 'index.html');
  if (!fs.existsSync(p)) throw new Error('web/dist missing — npm run web:build');
  return 'built';
}, { required: false });

check('mascot alpha source', () => {
  const keyed = path.join(CORE, 'video', 'public', 'mascot');
  if (!fs.existsSync(keyed) || fs.readdirSync(keyed).filter((f) => f.endsWith('.webm')).length === 0) {
    throw new Error('no keyed mascot yet — npm run chromakey');
  }
  return fs.readdirSync(keyed).join(', ');
}, { required: false });

check('assets dir', () => {
  if (!fs.existsSync(ASSETS)) throw new Error(`missing ${ASSETS}`);
  return fs.readdirSync(ASSETS).join(', ');
});

const pad = Math.max(...results.map((r) => r.name.length));
for (const r of results) {
  const mark = r.ok ? '✓' : (r.required ? '✗' : '·');
  console.log(`${mark} ${r.name.padEnd(pad)}  ${r.detail}`);
}

const missing = results.filter((r) => !r.ok && r.required);
if (missing.length) {
  console.error(`\n${missing.length} required dependency/dependencies missing.`);
  process.exitCode = 1;
}
