/**
 * §3.4 — worked-example operands are drawn randomly from a declared range, never hand-picked.
 *
 * The draw is seeded and reproducible, so the orchestrator can replay the Generator's declared
 * seed + spec and confirm the reported examples are the ones the sampler actually produced.
 * Hand-picked "nice" numbers are the primary way a bogus trick survives review; this module
 * exists to make hand-picking detectable rather than to make it impossible.
 *
 * A presentation filter is allowed, under three conditions enforced here:
 *   - it may only constrain properties in ALLOWED_FILTERS (rendering-driven: how big the number
 *     looks on a 1080x1920 frame, whether it is negative, whether it is zero)
 *   - it is declared as part of the spec, i.e. before any draw is seen
 *   - every rejection is recorded, so a filter that quietly removes the cases where the trick
 *     breaks shows up as a suspicious rejection rate in the payload
 *
 * A filter that encodes a mathematical property of the method is fraud, not presentation. There
 * is no way to express one through this API, which is the point.
 */

/** mulberry32 — small, fast, and identical across machines. Determinism is the requirement. */
function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ALLOWED_FILTERS = Object.freeze([
  'max_digits',     // integer: rendered width budget
  'min_digits',
  'nonzero',        // boolean
  'positive_only',  // boolean
  'exclude_values', // explicit list — must be justified in the payload, audited by the Verifier
]);

/** Rejections above this fraction mean the filter is doing mathematical work. */
export const REJECTION_RATE_ALARM = 0.5;

function validateSpec(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('spec must be an object');
  const { min, max } = spec;
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new Error('spec.min and spec.max must be integers — declare the range explicitly');
  }
  if (max <= min) throw new Error('spec.max must exceed spec.min');

  const filter = spec.filter ?? {};
  for (const key of Object.keys(filter)) {
    if (!ALLOWED_FILTERS.includes(key)) {
      throw new Error(
        `filter "${key}" is not a presentation property. Allowed: ${ALLOWED_FILTERS.join(', ')}. ` +
        'A filter that encodes a mathematical property of the technique is not permitted.'
      );
    }
  }
  return { min, max, filter };
}

function passesFilter(value, filter) {
  const digits = Math.abs(value).toString().length;
  if (filter.max_digits != null && digits > filter.max_digits) return 'max_digits';
  if (filter.min_digits != null && digits < filter.min_digits) return 'min_digits';
  if (filter.nonzero && value === 0) return 'nonzero';
  if (filter.positive_only && value <= 0) return 'positive_only';
  if (Array.isArray(filter.exclude_values) && filter.exclude_values.includes(value)) {
    return 'exclude_values';
  }
  return null;
}

/**
 * Draw `n` operands. Returns the draws plus the full audit trail: seed, spec, rejections,
 * rejection rate, and whether that rate crossed the alarm threshold.
 */
export function draw(seed, spec, n, { maxAttempts = 10000 } = {}) {
  const { min, max, filter } = validateSpec(spec);
  const next = rng(seed);
  const draws = [];
  const rejections = [];
  let attempts = 0;

  while (draws.length < n && attempts < maxAttempts) {
    attempts++;
    const value = min + Math.floor(next() * (max - min + 1));
    const reason = passesFilter(value, filter);
    if (reason) rejections.push({ value, reason });
    else draws.push(value);
  }

  if (draws.length < n) {
    throw new Error(
      `sampler exhausted ${maxAttempts} attempts and produced ${draws.length}/${n} draws — ` +
      'the declared filter is too narrow for the declared range'
    );
  }

  const rejectionRate = rejections.length / attempts;
  return {
    seed,
    spec: { min, max, filter },
    n,
    draws,
    attempts,
    rejections,
    rejection_rate: Number(rejectionRate.toFixed(4)),
    rejection_rate_alarm: rejectionRate > REJECTION_RATE_ALARM,
  };
}

/**
 * Replay a recorded draw and confirm it reproduces. Used by the orchestrator against whatever
 * the Generator reported: if the reported operands are not what the declared seed and spec
 * produce, they were hand-picked and the run fails.
 */
export function verifyDraw(record) {
  const { seed, spec, n, draws } = record ?? {};
  if (seed == null || !spec || !Array.isArray(draws)) {
    return { ok: false, reason: 'draw record incomplete (need seed, spec, draws)' };
  }
  let replay;
  try {
    replay = draw(seed, spec, n ?? draws.length);
  } catch (err) {
    return { ok: false, reason: `replay failed: ${err.message}` };
  }
  const same =
    replay.draws.length === draws.length &&
    replay.draws.every((v, i) => v === draws[i]);
  return same
    ? { ok: true, replay }
    : { ok: false, reason: 'reported operands do not match a replay of the declared seed/spec',
        expected: replay.draws, reported: draws };
}

// ---------------------------------------------------------------------------
// CLI — the Generator draws through this, it does not invent numbers.
//   node core/pipeline/lib/sampling.mjs draw --seed 1234 --spec '{"min":100,"max":9999,
//        "filter":{"max_digits":4,"nonzero":true}}' --n 3
//   node core/pipeline/lib/sampling.mjs verify --record '<json>'
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  try {
    if (cmd === 'draw') {
      const seed = Number(flag('seed'));
      const spec = JSON.parse(flag('spec') ?? '{}');
      const n = Number(flag('n') ?? 1);
      if (!Number.isFinite(seed)) throw new Error('--seed is required and must be a number');
      console.log(JSON.stringify(draw(seed, spec, n), null, 2));
    } else if (cmd === 'verify') {
      console.log(JSON.stringify(verifyDraw(JSON.parse(flag('record') ?? '{}')), null, 2));
    } else {
      console.error('commands: draw | verify');
      process.exit(2);
    }
  } catch (err) {
    console.log(JSON.stringify({ error: err.message }, null, 2));
    process.exit(1);
  }
}
