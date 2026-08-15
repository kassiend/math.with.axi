import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

/** core/ */
export const CORE = path.resolve(here, '..', '..');
/** repository root (parent of core/) */
export const ROOT = path.resolve(CORE, '..');

export const CONTENT = path.join(CORE, 'content');
export const LEDGER = path.join(CONTENT, 'ledger.json');
export const LESSONS = path.join(CONTENT, 'lessons');
export const THEOREMS = path.join(CORE, 'verify', 'theorems.json');
export const AGENTS = path.join(CORE, 'agents');
export const OUT = path.join(CORE, 'out');
export const CAPTURES = path.join(OUT, 'captures');
export const RENDERS = path.join(OUT, 'renders');
export const LOGS = path.join(OUT, 'logs');
export const ASSETS = path.join(ROOT, 'assets');

/** Interpreter for every SymPy check. Never the system python. */
export const PYTHON = path.join(CORE, '.venv', 'bin', 'python');

export const runDir = (runId) => path.join(OUT, 'runs', runId);
