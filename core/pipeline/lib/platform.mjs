/**
 * Cross-platform process and path helpers.
 *
 * Three things differ between macOS/Linux and Windows and each one is a silent breakage rather
 * than a clear error:
 *
 *   1. A venv puts the interpreter in bin/python on POSIX and Scripts/python.exe on Windows.
 *   2. npm-installed CLIs are shell shims (npx.cmd, claude.cmd) on Windows. execFile without a
 *      shell cannot run a .cmd, and fails with a bare ENOENT that looks like "not installed".
 *   3. PATH lookup rules differ, so a binary that exists can still be unfindable.
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const isWindows = process.platform === 'win32';

/** Interpreter inside a venv rooted at `venvDir`. */
export function venvPython(venvDir) {
  return isWindows
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');
}

/**
 * Resolve an npm-installed CLI to something execFile can actually run.
 * Prefers the local node_modules/.bin shim, which avoids depending on a global install at all.
 */
export function resolveBin(name, { localBinDir } = {}) {
  if (localBinDir) {
    const local = path.join(localBinDir, isWindows ? `${name}.cmd` : name);
    if (fs.existsSync(local)) return local;
  }
  return isWindows ? `${name}.cmd` : name;
}

/**
 * execFileSync that works with Windows shims.
 *
 * `shell: true` is required for .cmd files, and it is why every argument here must come from the
 * program rather than from model output — under a shell, an argument containing `&` or `|` is
 * interpreted rather than passed along.
 */
export function runTool(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { shell: isWindows, ...opts });
}

export function spawnTool(cmd, args, opts = {}) {
  return spawn(cmd, args, { shell: isWindows, ...opts });
}

/** Is a binary callable at all? Used for a clear up-front error instead of a mid-run ENOENT. */
export function haveTool(cmd, versionArg = '--version') {
  try {
    runTool(cmd, [versionArg], { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Everything the pipeline shells out to. Checked before a scheduled run starts, so a missing
 * dependency is reported once at startup rather than three agent invocations later.
 */
export function checkPrerequisites({ python, localBinDir } = {}) {
  const missing = [];
  if (!haveTool('ffmpeg', '-version')) missing.push('ffmpeg');
  if (!haveTool('ffprobe', '-version')) missing.push('ffprobe');
  if (!haveTool(resolveBin('claude', { localBinDir }))) missing.push('claude (Claude Code CLI)');
  if (python && !fs.existsSync(python)) missing.push(`python venv at ${python}`);
  return missing;
}
