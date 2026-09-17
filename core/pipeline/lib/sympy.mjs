/**
 * §3.1 — independent symbolic verification.
 *
 * Two scripts per claim, written blind by two agents that never saw each other's work, both run
 * here by the orchestrator. Neither agent executes its own check.
 *
 * The mismatch rule is absolute and lives in code so no model gets a vote on it:
 *
 *     code disagrees with text  ->  lesson FAILED
 *     do not edit the text to match the code
 *     do not edit the code to match the text
 *
 * A mismatch means the lesson is rejected, not repaired.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { PYTHON } from './paths.mjs';

const run = promisify(execFile);

export const DEFAULT_TIMEOUT_MS = 20_000;

export function pythonAvailable() {
  return fs.existsSync(PYTHON);
}

/**
 * Execute one check script. The script prints one JSON report line:
 *   {"claim_id": "...", "computed": "...", "agrees": true|false}
 * Other lines may surround it. A crash, a timeout, or no report line is an error, not a pass —
 * a check that cannot report is a check that did not happen.
 */
export async function runCheck(scriptPath, { timeout = DEFAULT_TIMEOUT_MS, cwd } = {}) {
  if (!pythonAvailable()) {
    return { ok: false, error: `venv interpreter missing at ${PYTHON} — run tools/verify-env.mjs` };
  }
  // Resolved before use: the child runs with cwd set to the script's directory, so a relative
  // path would be re-resolved against that directory and double up. The failure surfaced as a
  // generic "check failed", which reads like a disagreeing script rather than a bad path.
  const script = path.resolve(scriptPath);
  if (!fs.existsSync(script)) {
    return { ok: false, error: `check script not found: ${script}` };
  }
  try {
    const { stdout } = await run(PYTHON, [script], {
      timeout,
      cwd: cwd ?? path.dirname(script),
      maxBuffer: 1 << 20,
      // No network by convention; the checks are pure SymPy. Nothing here grants one.
      env: { PATH: '/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1', PYTHONHASHSEED: '0' },
    });
    const lines = stdout.trim().split('\n').filter(Boolean);
    if (!lines.length) return { ok: false, error: 'check produced no output' };
    // The report is the LAST line that is a JSON object with a boolean "agrees". Scripts print
    // progress lines before it and, often, a "done" line after it; neither is the report, and
    // failing a correct check over a trailing "All checks passed." is a format gate, not a
    // mathematics gate.
    let parsed = null;
    for (let i = lines.length - 1; i >= 0 && !parsed; i--) {
      const line = lines[i].trim();
      if (!line.startsWith('{')) continue;
      try {
        const obj = JSON.parse(line);
        if (obj && typeof obj.agrees === 'boolean') parsed = obj;
      } catch { /* not the report line */ }
    }
    if (!parsed) {
      return { ok: false, error: `check printed no JSON report line ({"claim_id","computed","agrees"}); last line: ${lines.at(-1).slice(0, 160)}` };
    }
    return { ok: true, ...parsed, stdout };
  } catch (err) {
    if (err.killed) return { ok: false, error: `check timed out after ${timeout}ms` };
    return { ok: false, error: `check failed: ${(err.stderr || err.message).slice(0, 500)}` };
  }
}

/**
 * Cross-check a claim: the Generator's script and the Verifier's script, run independently,
 * must both agree with the text AND with each other.
 *
 * Four ways this returns a failure, and every one of them fails the lesson:
 *   - either script errors, times out, or cannot report
 *   - either script reports agrees:false
 *   - the two scripts compute different values
 *   - only one script exists (a single check is not a cross-check)
 */
export async function crossCheck(claimId, generatorScript, verifierScript, opts = {}) {
  if (!generatorScript || !verifierScript) {
    return {
      claim_id: claimId, agreed: false,
      reason: 'cross-check requires two independently written scripts; got one',
    };
  }

  const [gen, ver] = await Promise.all([
    runCheck(generatorScript, opts),
    runCheck(verifierScript, opts),
  ]);

  const failures = [];
  if (!gen.ok) failures.push({ side: 'generator', error: gen.error });
  if (!ver.ok) failures.push({ side: 'verifier', error: ver.error });
  if (gen.ok && !gen.agrees) failures.push({ side: 'generator', error: 'script disagrees with text' });
  if (ver.ok && !ver.agrees) failures.push({ side: 'verifier', error: 'script disagrees with text' });

  const bothRan = gen.ok && ver.ok;
  const sameValue = bothRan && String(gen.computed) === String(ver.computed);
  if (bothRan && !sameValue) {
    failures.push({
      side: 'cross', error: 'the two independent scripts computed different values',
      generator_computed: String(gen.computed), verifier_computed: String(ver.computed),
    });
  }

  return {
    claim_id: claimId,
    agreed: failures.length === 0,
    generator: { ok: gen.ok, computed: gen.computed ?? null, agrees: gen.agrees ?? null, error: gen.error ?? null },
    verifier: { ok: ver.ok, computed: ver.computed ?? null, agrees: ver.agrees ?? null, error: ver.error ?? null },
    failures,
  };
}

/**
 * Run every claim's cross-check. Returns a single verdict for the whole lesson.
 * `passed` is true only when every claim agreed — there is no partial credit.
 */
export async function crossCheckAll(pairs, opts = {}) {
  const results = [];
  for (const { claim_id, generator_script, verifier_script } of pairs) {
    results.push(await crossCheck(claim_id, generator_script, verifier_script, opts));
  }
  return {
    passed: results.length > 0 && results.every((r) => r.agreed),
    checked: results.length,
    results,
    // Explicit, because "no claims" must never read as "everything passed".
    reason: results.length === 0 ? 'no claims were cross-checked' : null,
  };
}
