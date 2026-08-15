/**
 * Stage 1 — Generator (Agent A).
 * Proposes a topic, dedups it against the ledger, writes the lesson payload and its own checks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { runAgent } from '../lib/agent-runner.mjs';
import { checkNullDiscipline } from '../lib/payload.mjs';
import { verifyDraw } from '../lib/sampling.mjs';
import { checkScope } from '../lib/theorems.mjs';
import { CORE, ROOT } from '../lib/paths.mjs';

export async function generate(run) {
  const outFile = path.join(run.dir, 'generator.out.json');

  const payload = await runAgent({
    agent: 'axi-generator',
    cwd: ROOT,
    allowedTools: ['Read', 'Write', 'Glob', 'Grep', 'Bash'],
    expectFile: outFile,
    prompt: [
      `Run directory: ${run.dir}`,
      `Read ${path.join(run.dir, 'request.json')} for run parameters.`,
      `Dedup against the ledger first — a duplicate topic ends the run.`,
      `Write your payload to ${outFile}.`,
      `Write one SymPy check per claim into ${path.join(run.dir, 'generator.checks')}/<claim_id>.py`,
      `and reference them from the payload's generator_checks field.`,
    ].join('\n'),
  });

  return { payload, gates: preflight(payload, run) };
}

/**
 * Cheap structural gates, run before the Verifier is spent on the payload. None of these are
 * mathematical judgements — they are the rules that can be decided without reading the content.
 */
export function preflight(payload, run) {
  const problems = [];

  if (payload.status === 'no_topic') {
    return { ok: false, terminal: true, problems: [{ gate: 'dedup', problem: 'generator found no undone topic' }] };
  }

  // §3.3 — no gap-filling.
  for (const p of checkNullDiscipline(payload)) {
    problems.push({ gate: 'null-discipline', ...p });
  }

  // §3.4 — operands must replay from the declared seed and spec.
  const replay = verifyDraw(payload.sampling);
  if (!replay.ok) {
    problems.push({ gate: 'sampling', problem: replay.reason, expected: replay.expected, reported: replay.reported });
  } else if (payload.sampling?.rejection_rate_alarm) {
    problems.push({
      gate: 'sampling',
      problem: `presentation filter rejected ${(payload.sampling.rejection_rate * 100).toFixed(0)}% of draws — ` +
        'a filter that discards this much is doing mathematical work, not presentation work',
    });
  }

  // §3.2 — scope of the technique.
  const scope = checkScope(payload);
  for (const p of scope.problems) problems.push({ gate: 'scope', ...p });

  // Two independent scripts are required; one is not a cross-check.
  const checkDir = path.join(run.dir, 'generator.checks');
  const claims = payload.claims ?? [];
  for (const claim of claims) {
    const script = path.join(checkDir, `${claim.claim_id}.py`);
    if (!fs.existsSync(script)) {
      problems.push({ gate: 'checks', problem: `no generator check script for claim ${claim.claim_id}` });
    }
  }
  if (claims.length === 0) {
    problems.push({ gate: 'checks', problem: 'payload declares no claims — nothing to verify' });
  }

  return { ok: problems.length === 0, terminal: false, problems, scope_kind: scope.kind };
}

export const _internal = { CORE };
