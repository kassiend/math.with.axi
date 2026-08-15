/**
 * Stage 2 — Verifier (Agent B), plus the cross-check of the two independent SymPy scripts.
 *
 * The Verifier runs in a sandbox directory containing only what it is allowed to see. It is
 * launched without --add-dir for the run directory, so generator.out.json and request.json are
 * outside its working tree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { runAgent } from '../lib/agent-runner.mjs';
import { projectForVerifier } from '../lib/payload.mjs';
import { crossCheckAll } from '../lib/sympy.mjs';
import { THEOREMS } from '../lib/paths.mjs';

export async function verify(run, generatorPayload) {
  const box = path.join(run.dir, 'verifier.box');
  fs.mkdirSync(path.join(box, 'verifier.checks'), { recursive: true });

  // Phase 1 projection: the Generator's own scripts are withheld until the Verifier has
  // written its own, or the cross-check is theatre.
  const projected = projectForVerifier(generatorPayload, { phase: 1 });
  fs.writeFileSync(path.join(box, 'verifier.in.json'), JSON.stringify(projected, null, 2));
  fs.copyFileSync(THEOREMS, path.join(box, 'theorems.json'));

  const outFile = path.join(box, 'verifier.out.json');

  const report = await runAgent({
    agent: 'axi-verifier',
    cwd: box,
    allowedTools: ['Read', 'Write', 'Bash'],
    addDirs: [],   // deliberately empty — see agents/ISOLATION.md
    expectFile: outFile,
    prompt: [
      'Read ./verifier.in.json. It is the only input you get and the only file you may read',
      'apart from ./theorems.json and files you write yourself.',
      'Write one independent SymPy check per claim into ./verifier.checks/<claim_id>.py,',
      'from the claim alone, before looking at anything else.',
      'Write your report to ./verifier.out.json.',
    ].join('\n'),
  });

  const cross = await runCrossChecks(run, generatorPayload, box);
  return { report, cross, verdict: verdictFrom(report, cross) };
}

async function runCrossChecks(run, generatorPayload, box) {
  const pairs = (generatorPayload.claims ?? []).map((c) => ({
    claim_id: c.claim_id,
    generator_script: path.join(run.dir, 'generator.checks', `${c.claim_id}.py`),
    verifier_script: path.join(box, 'verifier.checks', `${c.claim_id}.py`),
  }));
  return crossCheckAll(pairs);
}

/**
 * The verdict is computed here, not taken from the Verifier's self-report. The agent's `status`
 * is advisory; a fatal finding, a disagreeing script, or an unverifiable claim fails the lesson
 * whatever the agent wrote in the field.
 */
export function verdictFrom(report, cross) {
  const reasons = [];

  if (report?.status !== 'passed') {
    reasons.push(`verifier reported status="${report?.status ?? 'missing'}"`);
  }
  const fatal = (report?.findings ?? []).filter((f) => f.severity === 'fatal');
  if (fatal.length) reasons.push(`${fatal.length} fatal finding(s)`);

  const unverifiable = report?.unverifiable ?? [];
  if (unverifiable.length) {
    reasons.push(`${unverifiable.length} claim(s) could not be verified`);
  }

  if (!cross.passed) {
    reasons.push(cross.reason ?? 'independent SymPy cross-check did not agree');
    for (const r of cross.results.filter((r) => !r.agreed)) {
      for (const f of r.failures) reasons.push(`claim ${r.claim_id}: ${f.side} — ${f.error}`);
    }
  }

  return { passed: reasons.length === 0, reasons };
}
