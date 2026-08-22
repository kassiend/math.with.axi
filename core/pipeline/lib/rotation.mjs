/**
 * Forced variety.
 *
 * WHY THIS EXISTS. The templates list a dozen categories and let the agent choose one. An agent
 * asked to "pick a category" picks the most prototypical example of the thing it was asked for,
 * every time — for "maths trick" that is multiplication shortcuts and square roots. The ledger
 * only blocked the last 3 categories, so it could oscillate between two or three favourites
 * forever and never break the rule.
 *
 * Free choice plus a weak recency rule produces a channel that looks like it has one topic. The
 * fix is not a better prompt: it is to stop asking. The area is ASSIGNED here, from the pool
 * position that has gone longest without use, and handed to the agent as a constraint.
 *
 * The agent still chooses the idea, the numbers and the framing. It just does not get to choose
 * the subject, because that is the one decision it is reliably bad at.
 */
import * as ledger from './ledger.mjs';
import * as tasksLedger from './tasks-ledger.mjs';
import * as storiesLedger from './stories-ledger.mjs';

/**
 * Subject areas for daily-task puzzles. Much wider than the original list, which was
 * arithmetic-heavy and therefore produced arithmetic-heavy output.
 *
 * ORDER MATTERS. Ties in the least-recently-used sort are broken by pool position, so the first
 * entries are what a fresh channel ships first. The prototypical areas — the ones an unguided
 * agent would pick anyway — are deliberately last, so the early posts spread out instead of
 * clustering on multiplication and roots.
 */
export const TASK_AREAS_20S = Object.freeze([
  'percentage',
  'divisibility-remainder',
  'logarithm',
  'sequence',
  'fractions',
  'clock-calendar',
  'counting',
  'parity-argument',
  'ratio-proportion',
  'absolute-value',
  'linear-equation',
  'unit-conversion',
  'arithmetic-shortcut',   // the obvious one — last on purpose
  'powers-roots',
]);

export const TASK_AREAS_40S = Object.freeze([
  'logarithm-exponent',
  'modular-arithmetic',
  'telescoping',
  'work-rate',
  'weighted-average',
  'trigonometric-identity',
  'inequality',
  'series-sum',
  'digit-puzzle',
  'number-base',
  'combinatorics',
  'geometry-mental',
  'functional-pattern',
  'system-of-equations',
  'quadratic-structure',
  'nested-radical',
]);

/**
 * Lesson subject areas. A lesson teaches a method, so these are branches of technique rather
 * than problem types — and the spread matters more here, because a channel that only ever shows
 * multiplication tricks reads as a party trick, not as teaching.
 */
export const LESSON_AREAS = Object.freeze([
  'divisibility-rules',
  'algebraic-identity',
  'percentage-and-discount',
  'estimation-and-bounding',
  'modular-arithmetic',
  'fraction-manipulation',
  'logarithm-and-exponent',
  'sequence-and-series',
  'equation-solving-strategy',
  'geometry-shortcut',
  'combinatorial-counting',
  'probability-intuition',
  'number-base-and-digits',
  'inequality-technique',
  'trigonometry-shortcut',
  'division-shortcut',
  'multiplication-shortcut',  // already covered by Math tricks #2 — last on purpose
  'squaring-and-roots',       // already covered by Math tricks #1
]);

/**
 * Story categories. Wider than a list of topics on purpose: these are five different KINDS of
 * video, and rotating between them is what stops the section becoming "dead mathematicians" —
 * which is where an unguided agent lands, every time, because that is what "math story" evokes.
 *
 * Order matters for the same reason it does elsewhere: ties in the least-recently-used sort break
 * by pool position, so the visually strongest and least obvious kinds come first.
 */
export const STORY_AREAS = Object.freeze([
  'topology-and-geometry',   // the mesmerising visual: curves that draw a heart, a Möbius strip
  'probability-and-statistics', // the illusion of control, base rates, why gamblers lose
  'financial-mathematics',   // compounding, hedging, what a formula does to money
  'math-in-real-life',       // where it is already running: GPS, compression, queues
  'biography',               // a person, a formula, and where that formula is used today
]);

/**
 * Order a pool by how long each entry has gone unused: never-used first, then oldest-used.
 *
 * @param pool   candidate areas
 * @param recent areas already used, OLDEST FIRST
 */
export function byLeastRecentlyUsed(pool, recent) {
  const lastUsed = new Map();
  recent.forEach((area, i) => lastUsed.set(area, i));
  return [...pool].sort((a, b) => {
    const ua = lastUsed.has(a) ? lastUsed.get(a) : -1;
    const ub = lastUsed.has(b) ? lastUsed.get(b) : -1;
    if (ua !== ub) return ua - ub;            // never used (-1) first, then oldest
    return pool.indexOf(a) - pool.indexOf(b); // stable
  });
}

/** The area a new task must use, plus the runners-up in case the agent must fall back. */
export function nextTaskArea(durationS, led = tasksLedger.load()) {
  const pool = durationS === 40 ? TASK_AREAS_40S : TASK_AREAS_20S;
  const recent = led.entries
    .filter((e) => e.status === 'shipped' && e.duration_s === durationS)
    .map((e) => e.categories?.[0])
    .filter(Boolean);
  const ordered = byLeastRecentlyUsed(pool, recent);
  return { assigned: ordered[0], alternatives: ordered.slice(1, 4), poolSize: pool.length, used: recent.length };
}

/** The kind of story to tell next. */
export function nextStoryArea(led) {
  const ledger = led ?? storiesLedger.load();
  const recent = ledger.entries
    .filter((e) => e.status === 'shipped')
    .map((e) => e.area)
    .filter(Boolean);
  const ordered = byLeastRecentlyUsed(STORY_AREAS, recent);
  return { assigned: ordered[0], alternatives: ordered.slice(1, 3), poolSize: STORY_AREAS.length, used: recent.length };
}

/** The area a new lesson must use. Lessons share one pool regardless of length. */
export function nextLessonArea(led = ledger.load()) {
  const recent = led.entries
    .filter((e) => e.status === 'shipped')
    .map((e) => e.area ?? e.tags?.[0])
    .filter(Boolean);
  const ordered = byLeastRecentlyUsed(LESSON_AREAS, recent);
  return { assigned: ordered[0], alternatives: ordered.slice(1, 4), poolSize: LESSON_AREAS.length, used: recent.length };
}

/**
 * Which background to use.
 *
 * Was a hash of the seed modulo four, which collides constantly — with four files a hash repeats
 * the previous pick a quarter of the time and looked, in practice, like the background never
 * changed. A straight rotation over how many posts have shipped guarantees consecutive posts
 * differ and every file gets equal use.
 */
export function nextBackground(files, shippedCount) {
  if (!files.length) throw new Error('no background images available');
  return files[shippedCount % files.length];
}

/** Total shipped posts across both ledgers — the rotation index for backgrounds. */
export function shippedCount() {
  return ledger.load().entries.filter((e) => e.status === 'shipped').length
       + tasksLedger.load().entries.filter((e) => e.status === 'shipped').length
       + storiesLedger.load().entries.filter((e) => e.status === 'shipped').length;
}
