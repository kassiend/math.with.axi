/**
 * The A → B isolation boundary, in code.
 *
 * The Verifier receives a projection of the Generator's payload onto an explicit allowlist.
 * Fields are dropped, not redacted: a redacted field still tells the Verifier that something was
 * there and roughly how big it was, and that is a channel.
 *
 * See agents/ISOLATION.md for why this matters and what else backs it up.
 *
 * The lesson schema itself is deliberately undefined this session (see schema/lesson.schema.TODO.md).
 * This module therefore validates *shape*, not *content* — it is written so a real schema can be
 * dropped in at VERIFIER_VISIBLE_FIELDS and FROZEN_PATHS without touching anything else.
 */
import crypto from 'node:crypto';

/**
 * Everything the Verifier is allowed to see. Adding a payload field does not expose it; someone
 * has to add it here on purpose, in a diff a human reads.
 */
export const VERIFIER_VISIBLE_FIELDS = Object.freeze([
  'lesson_id',
  'concept_slug',
  'tags',
  'title',
  'language',
  'claims',              // [{claim_id, statement, formula, value}]
  'method',              // the procedure, as stated to the viewer
  'mechanism',           // why it works
  'examples',            // [{claim_id, operands, steps, result}]
  'sampling',            // {seed, spec, draws, rejections, rejection_rate}
  'applicability',       // {condition, formal}
  'counterexample',      // {input, method_says, truth, null if universality claimed}
  'universality',        // {kind: "theorem"|"exhaustive", theorem_id | domain}
  'nulls',               // [{field, reason}] — §3.3 machine-readable gaps
]);

/**
 * Released to the Verifier only in phase 2, after its own checks are written and saved.
 * Handing this over up front would anchor the Verifier on the Generator's approach and make the
 * two-script cross-check meaningless.
 */
export const PHASE_TWO_FIELDS = Object.freeze(['generator_checks']);

/**
 * Never crosses to the Verifier under any phase. Presence of any of these in a projected payload
 * is a bug in the projection, not something to clean up and continue past.
 */
export const FORBIDDEN_KEY_PATTERNS = Object.freeze([
  /prompt/i, /rationale/i, /reasoning/i, /chain[_-]?of[_-]?thought/i, /\bdraft\b/i,
  /why[_-]i[_-]/i, /instruction/i, /system[_-]?message/i, /thinking/i, /scratch/i,
]);

/** Elements the Editor may not touch. Dotted paths; `[]` means "every element of the array". */
export const FROZEN_PATHS = Object.freeze([
  'claims[].statement',
  'claims[].formula',
  'claims[].value',
  'examples[].operands',
  'examples[].result',
  'examples[].steps',
  'applicability.condition',
  'applicability.formal',
  'counterexample.input',
  'counterexample.method_says',
  'counterexample.truth',
  'universality.theorem_id',
  'universality.domain',
  'sampling.seed',
  'sampling.spec',
  'sampling.draws',
]);

export class IsolationError extends Error {}

/** Deep scan for keys whose *name* is forbidden, anywhere in the structure. */
function scanKeys(value, trail = []) {
  const hits = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...scanKeys(v, [...trail, String(i)])));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEY_PATTERNS.some((re) => re.test(k))) hits.push([...trail, k].join('.'));
      hits.push(...scanKeys(v, [...trail, k]));
    }
  }
  return hits;
}

/**
 * Project the Generator payload for the Verifier.
 * Throws rather than sanitising: a payload that carries reasoning into the allowlisted fields is
 * a design failure upstream, and silently stripping it would hide that.
 */
export function projectForVerifier(generatorOut, { phase = 1 } = {}) {
  if (!generatorOut || typeof generatorOut !== 'object') {
    throw new IsolationError('generator output is not an object');
  }
  const visible = phase >= 2
    ? [...VERIFIER_VISIBLE_FIELDS, ...PHASE_TWO_FIELDS]
    : VERIFIER_VISIBLE_FIELDS;

  const projected = {};
  for (const field of visible) {
    if (field in generatorOut) projected[field] = structuredClone(generatorOut[field]);
  }

  const leaked = scanKeys(projected);
  if (leaked.length) {
    throw new IsolationError(
      `forbidden keys survived projection: ${leaked.join(', ')} — ` +
      'the Verifier must not see Generator reasoning'
    );
  }
  return projected;
}

/**
 * Hash of every frozen element. Taken before the Editor runs and again after; a difference fails
 * the run regardless of what the Editor reports about itself.
 */
export function frozenHash(lesson) {
  const picked = {};
  for (const p of FROZEN_PATHS) picked[p] = readPath(lesson, p);
  const canonical = JSON.stringify(picked, Object.keys(picked).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/** Diff the frozen elements so a failure names the field that moved, not just "hash changed". */
export function frozenDiff(before, after) {
  const changed = [];
  for (const p of FROZEN_PATHS) {
    const a = JSON.stringify(readPath(before, p));
    const b = JSON.stringify(readPath(after, p));
    if (a !== b) changed.push({ path: p, before: readPath(before, p), after: readPath(after, p) });
  }
  return changed;
}

function readPath(obj, dotted) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (cur == null) return null;
    if (part.endsWith('[]')) {
      const key = part.slice(0, -2);
      const arr = cur[key];
      if (!Array.isArray(arr)) return null;
      const rest = parts.slice(i + 1).join('.');
      return arr.map((el) => (rest ? readPath(el, rest) : el));
    }
    cur = cur[part];
  }
  return cur ?? null;
}

/**
 * §3.3 — an empty result is acceptable, a fabricated one is not. Any field reported as null must
 * come with a machine-readable reason, and a reason without a null is equally suspect.
 */
export function checkNullDiscipline(payload) {
  const problems = [];
  const declared = new Set((payload.nulls ?? []).map((n) => n.field));

  for (const entry of payload.nulls ?? []) {
    if (!entry.reason || typeof entry.reason !== 'string' || entry.reason.length < 8) {
      problems.push({ field: entry.field, problem: 'null without a machine-readable reason' });
    }
    if (readPath(payload, entry.field) != null) {
      problems.push({ field: entry.field, problem: 'declared null but a value is present' });
    }
  }

  for (const field of ['method', 'mechanism', 'applicability', 'claims', 'examples']) {
    if (payload[field] == null && !declared.has(field)) {
      problems.push({ field, problem: 'missing and not declared in nulls[]' });
    }
  }
  return problems;
}
