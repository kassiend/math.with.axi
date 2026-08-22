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
 * Extensions the OS will treat as executable, in the order it tries them.
 * On Windows this comes from PATHEXT; a CLI may be .cmd, .exe, .bat or .ps1 depending on how it
 * was installed, and assuming one of them is how this broke.
 */
function executableExtensions() {
  if (!isWindows) return [''];
  const fromEnv = (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean);
  // .ps1 is not in PATHEXT by default but some installers only drop a PowerShell shim.
  return [...new Set([...fromEnv.map((e) => e.toLowerCase()), '.ps1'])];
}

/** Directories worth looking in beyond PATH, because installers do not always update it. */
function extraSearchDirs() {
  const home = process.env.USERPROFILE ?? process.env.HOME ?? '';
  const dirs = [];
  if (home) {
    dirs.push(path.join(home, '.local', 'bin'));          // Claude Code native installer
    dirs.push(path.join(home, '.claude', 'bin'));
    dirs.push(path.join(home, 'bin'));
  }
  if (isWindows) {
    if (process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, 'npm'));   // npm -g shims
    if (process.env.LOCALAPPDATA) {
      dirs.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'claude'));
      dirs.push(path.join(process.env.LOCALAPPDATA, 'npm'));
    }
  } else {
    dirs.push('/usr/local/bin', '/opt/homebrew/bin');
  }
  return dirs;
}

/**
 * Find an executable on disk, the way the shell would — plus a few places installers use that
 * they forget to add to PATH.
 *
 * Returns an absolute path, or null. A caller that gets null should say "not installed" rather
 * than hand a bare name to the shell: on a Russian-locale Windows the shell's own "not
 * recognized" error comes back in the OEM codepage and arrives as mojibake, which tells the user
 * nothing at all.
 */
export function findExecutable(name) {
  const exts = executableExtensions();
  const sep = isWindows ? ';' : ':';
  const dirs = [...(process.env.PATH ?? '').split(sep).filter(Boolean), ...extraSearchDirs()];

  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
      } catch { /* unreadable directory on PATH — skip it */ }
    }
  }
  return null;
}

/**
 * Resolve an npm-installed CLI to something execFile can actually run.
 * Prefers the local node_modules/.bin shim, which avoids depending on a global install at all.
 */
export function resolveBin(name, { localBinDir } = {}) {
  if (localBinDir) {
    for (const ext of executableExtensions()) {
      const local = path.join(localBinDir, name + ext);
      if (fs.existsSync(local)) return local;
    }
  }
  return findExecutable(name) ?? name;
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

/** How to install each dependency, per platform. Printed with the failure, not buried in a README. */
const INSTALL_HINTS = {
  ffmpeg: isWindows
    ? 'winget install Gyan.FFmpeg   (then reopen the terminal so PATH updates)'
    : 'brew install ffmpeg   /   apt install ffmpeg',
  ffprobe: 'ships with ffmpeg — installing ffmpeg gives you both',
  claude: isWindows
    ? 'irm https://claude.ai/install.ps1 | iex    (PowerShell), then reopen the terminal'
    : 'curl -fsSL https://claude.ai/install.sh | bash',
  python: isWindows
    ? 'py -3 -m venv core\\.venv && core\\.venv\\Scripts\\pip install sympy'
    : 'python3 -m venv core/.venv && core/.venv/bin/pip install sympy',
};

/**
 * Everything the pipeline shells out to, with where each one was found.
 *
 * Reported before any batch starts. Discovering a missing CLI three agent invocations in gives
 * you the shell's own error, which on a non-English Windows arrives in the OEM codepage and is
 * unreadable — the user sees mojibake instead of "Claude Code is not installed".
 */
export function checkPrerequisites({ python, localBinDir } = {}) {
  const checks = [];

  for (const [name, versionArg] of [['ffmpeg', '-version'], ['ffprobe', '-version']]) {
    const found = findExecutable(name);
    checks.push({ name, ok: Boolean(found) && haveTool(found, versionArg), path: found, hint: INSTALL_HINTS[name] });
  }

  const claude = resolveBin('claude', { localBinDir });
  const claudeFound = path.isAbsolute(claude) && fs.existsSync(claude);
  checks.push({
    name: 'claude', ok: claudeFound && haveTool(claude),
    path: claudeFound ? claude : null, hint: INSTALL_HINTS.claude,
  });

  checks.push({
    name: 'python venv', ok: Boolean(python) && fs.existsSync(python),
    path: python && fs.existsSync(python) ? python : null, hint: INSTALL_HINTS.python,
  });

  return { checks, missing: checks.filter((c) => !c.ok) };
}

/**
 * ffmpeg and ffprobe, resolved to absolute paths once.
 *
 * Called by bare name these fail with `spawnSync ffprobe ENOENT` — a message that names neither
 * the tool's purpose nor how to fix it, and which lands AFTER the agents have already run and
 * cost minutes. Windows installers in particular drop ffmpeg somewhere PATH never learns about.
 *
 * Falls back to the bare name so that, if it still fails, the error is the familiar one.
 */
export const FFMPEG = findExecutable('ffmpeg') ?? 'ffmpeg';
export const FFPROBE = findExecutable('ffprobe') ?? 'ffprobe';
