/**
 * §3.2 — the universal case.
 *
 * When a technique genuinely is universal there is no counterexample, so a proof is owed instead.
 * An LLM's assertion of universality is not a proof, and neither is an LLM naming a theorem from
 * memory. Exactly two forms of support are accepted:
 *
 *   kind: "theorem"     — cites an id from verify/theorems.json, with a hypothesis mapping
 *   kind: "exhaustive"  — a SymPy check over a stated, finite, and actually-complete domain
 *
 * Anything else means the topic is rejected. "It seems to always work" is not shippable.
 */
import fs from 'node:fs';
import { THEOREMS } from './paths.mjs';

export function loadTheorems(file = THEOREMS) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return new Map(raw.theorems.map((t) => [t.id, t]));
}

/**
 * A finite domain is only meaningful if it is the *whole* domain of the claim. An exhaustive
 * check over n in [1, 100] establishes nothing about all integers, and a payload that presents
 * it as though it did is the failure mode this function exists to catch.
 */
function checkDomain(domain) {
  const problems = [];
  if (!domain || typeof domain !== 'object') {
    return [{ problem: 'universality.domain missing' }];
  }
  if (!domain.description) problems.push({ problem: 'domain.description missing' });
  if (domain.finite !== true) {
    problems.push({ problem: 'domain.finite must be explicitly true — an infinite domain cannot be checked exhaustively' });
  }
  if (domain.is_complete_domain_of_claim !== true) {
    problems.push({
      problem: 'domain.is_complete_domain_of_claim must be explicitly true. A sampled or ' +
        'truncated range does not establish universality, it only fails to refute it.',
    });
  }
  if (!Number.isFinite(domain.size)) {
    problems.push({ problem: 'domain.size must be a finite number' });
  }
  return problems;
}

/**
 * Validate a payload's scope declaration.
 * Returns {ok, kind, problems[]}. `ok: false` means the topic is rejected, not patched.
 */
export function checkScope(payload, { theorems = loadTheorems() } = {}) {
  const problems = [];
  const hasCounterexample = payload.counterexample != null;
  const universality = payload.universality ?? null;

  if (!hasCounterexample && !universality) {
    return {
      ok: false, kind: null,
      problems: [{
        problem: 'neither a counterexample nor a universality proof was supplied — ' +
          'a technique that "seems to always work" is rejected',
      }],
    };
  }

  if (hasCounterexample) {
    const ce = payload.counterexample;
    for (const field of ['input', 'method_says', 'truth']) {
      if (ce[field] == null) problems.push({ problem: `counterexample.${field} missing` });
    }
    // The counterexample must actually break the method, not merely be an unusual input.
    if (ce.method_says != null && ce.truth != null &&
        String(ce.method_says) === String(ce.truth)) {
      problems.push({
        problem: 'counterexample does not break the method: method_says equals truth',
      });
    }
    if (!payload.applicability?.condition) {
      problems.push({ problem: 'applicability.condition missing — required alongside a counterexample' });
    }
    return { ok: problems.length === 0, kind: 'counterexample', problems };
  }

  // Universality path.
  if (universality.kind === 'theorem') {
    const t = theorems.get(universality.theorem_id);
    if (!t) {
      problems.push({
        problem: `theorem_id "${universality.theorem_id}" is not in the whitelist — ` +
          'an agent may not cite a theorem that has not been reviewed into verify/theorems.json',
      });
    } else {
      const mapping = universality.hypothesis_mapping;
      if (!mapping || typeof mapping !== 'object') {
        problems.push({ problem: 'universality.hypothesis_mapping missing' });
      } else {
        for (const h of t.hypotheses) {
          if (!mapping[h]) {
            problems.push({ problem: `hypothesis "${h}" of ${t.id} is not mapped to the technique` });
          }
        }
      }
    }
    return { ok: problems.length === 0, kind: 'theorem', problems };
  }

  if (universality.kind === 'exhaustive') {
    problems.push(...checkDomain(universality.domain));
    if (!universality.check_script) {
      problems.push({ problem: 'universality.check_script missing — the exhaustive check must be executable' });
    }
    return { ok: problems.length === 0, kind: 'exhaustive', problems };
  }

  return {
    ok: false, kind: universality.kind ?? null,
    problems: [{ problem: `universality.kind must be "theorem" or "exhaustive", got "${universality.kind}"` }],
  };
}

// CLI: node core/pipeline/lib/theorems.mjs list
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === 'list') {
    for (const t of loadTheorems().values()) console.log(`${t.id}\t${t.name}`);
  } else {
    console.error('commands: list');
    process.exit(2);
  }
}
