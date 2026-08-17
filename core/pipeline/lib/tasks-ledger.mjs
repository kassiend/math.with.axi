/**
 * Task ledger — deduplication for daily-task posts.
 *
 * Separate from content/ledger.json on purpose. A lesson is deduplicated by mathematical concept
 * ("have we taught this idea?"); a task is deduplicated by puzzle *shape* ("have we asked this
 * question?"). Same word, different question, and mixing them would let a task block a lesson on
 * the same topic, which is wrong — teaching divisibility by 9 and posing a divisibility puzzle
 * are different products.
 *
 * Three rules, in order of severity:
 *   1. statement_norm collision, any duration  -> hard duplicate
 *   2. structure_id within the last STRUCTURE_WINDOW shipped tasks of that duration
 *   3. primary category within the last CATEGORY_WINDOW shipped tasks of that duration
 *
 * Rule 2 is the one that matters. Changing 47^2 - 43^2 into 31^2 - 29^2 produces a new
 * statement_norm and the same puzzle; only structure_id catches that.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT } from './paths.mjs';

export const TASKS_LEDGER = path.join(CONTENT, 'tasks-ledger.json');
export const STRUCTURE_WINDOW = 10;
export const CATEGORY_WINDOW = 3;

const EMPTY = { version: 1, entries: [] };

export function load(file = TASKS_LEDGER) {
  if (!fs.existsSync(file)) return structuredClone(EMPTY);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(raw.entries)) throw new Error(`tasks ledger ${file}: entries[] missing`);
  return raw;
}

export function save(ledger, file = TASKS_LEDGER) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n');
}

export function normaliseSlug(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Canonical form of a statement, for exact-duplicate detection.
 * Collapses whitespace and unifies the operator glyphs that render differently but mean the
 * same thing, so "2 × 3" and "2 * 3" are one statement rather than two.
 */
export function normaliseStatement(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[×⋅·]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/[""'']/g, '"')
    .replace(/\\left|\\right|\\,|\\!|\\;/g, '')
    .replace(/[{}]/g, '');
}

const shipped = (ledger, durationS) => ledger.entries
  .filter((e) => e.status === 'shipped' && (durationS == null || e.duration_s === durationS));

/**
 * What a proposed task must clear.
 * `blocked` ends the proposal. `recent` is context — the shapes and categories to steer away
 * from even when they have aged out of the windows.
 */
export function findCandidates(structureId, categories, durationS, ledger = load()) {
  const structure = normaliseSlug(structureId);
  const cats = (Array.isArray(categories) ? categories : String(categories || '').split(','))
    .map(normaliseSlug).filter(Boolean);
  const primary = cats[0] ?? null;

  const blocked = [];

  // Rule 2 — same shape, recent, same duration.
  const recentStructures = shipped(ledger, durationS).slice(-STRUCTURE_WINDOW);
  const structureHit = recentStructures.filter((e) => normaliseSlug(e.structure_id) === structure);
  if (structureHit.length) {
    blocked.push({
      rule: 'structure-repeated',
      detail: `structure_id "${structure}" shipped within the last ${STRUCTURE_WINDOW} ${durationS}s tasks`,
      entries: structureHit.map((e) => e.task_id),
    });
  }

  // Cross-duration: the same shape must not appear in the other duration either. Inflating an
  // easy shape's arithmetic is not how a task gets harder.
  const otherDuration = shipped(ledger, null)
    .filter((e) => e.duration_s !== durationS)
    .slice(-STRUCTURE_WINDOW)
    .filter((e) => normaliseSlug(e.structure_id) === structure);
  if (otherDuration.length) {
    blocked.push({
      rule: 'structure-reused-across-durations',
      detail: 'the same puzzle shape already shipped at the other duration',
      entries: otherDuration.map((e) => e.task_id),
    });
  }

  // Rule 3 — primary category too recent.
  if (primary) {
    const recentCats = shipped(ledger, durationS).slice(-CATEGORY_WINDOW);
    const catHit = recentCats.filter((e) => normaliseSlug(e.categories?.[0]) === primary);
    if (catHit.length) {
      blocked.push({
        rule: 'category-repeated',
        detail: `primary category "${primary}" used within the last ${CATEGORY_WINDOW} ${durationS}s tasks`,
        entries: catHit.map((e) => e.task_id),
      });
    }
  }

  return {
    structure_id: structure,
    categories: cats,
    duration_s: durationS,
    blocked,
    recent: shipped(ledger, durationS).slice(-STRUCTURE_WINDOW).map((e) => ({
      task_id: e.task_id, structure_id: e.structure_id, categories: e.categories,
    })),
  };
}

/**
 * Rule 1 — exact statement collision, either duration.
 *
 * Only SHIPPED entries block. This used to match any status, which meant a run that failed for
 * an infrastructure reason poisoned its own retry: the failure recorded the statement, and the
 * next attempt at the very same puzzle was rejected as a duplicate of something that never went
 * out. Dedup exists to stop a puzzle being published twice, not to stop it being attempted twice.
 *
 * Repeated failure is handled where it belongs — by the attempt counter in the worker and by
 * MAX_FAILED_ATTEMPTS on the shape.
 */
export function statementExists(statement, ledger = load()) {
  const norm = normaliseStatement(statement);
  const hit = ledger.entries.find((e) => e.statement_norm === norm && e.status === 'shipped');
  return hit ? { duplicate: true, task_id: hit.task_id, duration_s: hit.duration_s } : { duplicate: false };
}

export function record(entry, { file = TASKS_LEDGER } = {}) {
  for (const k of ['task_id', 'duration_s', 'structure_id', 'statement', 'answer', 'status', 'created_at']) {
    if (entry[k] == null) throw new Error(`tasks-ledger.record: missing required field "${k}"`);
  }
  if (!['shipped', 'failed', 'rejected'].includes(entry.status)) {
    throw new Error(`tasks-ledger.record: bad status "${entry.status}"`);
  }
  const ledger = load(file);
  ledger.entries.push({
    ...entry,
    structure_id: normaliseSlug(entry.structure_id),
    categories: (entry.categories ?? []).map(normaliseSlug),
    statement_norm: normaliseStatement(entry.statement),
  });
  save(ledger, file);
  return entry.task_id;
}

/**
 * Drop every row for a task_id. Used only when re-rendering a post that already shipped, so the
 * rebuild replaces its row instead of stacking a second one. Not a general delete: removing a
 * shipped topic to sneak it past dedup would defeat the whole ledger.
 */
export function remove(taskId, { file = TASKS_LEDGER } = {}) {
  const ledger = load(file);
  const before = ledger.entries.length;
  ledger.entries = ledger.entries.filter((e) => e.task_id !== taskId);
  save(ledger, file);
  return before - ledger.entries.length;
}

// ---------------------------------------------------------------------------
// CLI — the task generator calls this instead of reading the ledger itself.
//   node core/pipeline/lib/tasks-ledger.mjs candidates '<structure_id>' '<cat,cat>' 20
//   node core/pipeline/lib/tasks-ledger.mjs statement '47^2 - 43^2'
//   node core/pipeline/lib/tasks-ledger.mjs list [20|40]
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === 'candidates') {
    if (!a) { console.error('usage: candidates <structure_id> <categories,csv> <20|40>'); process.exit(2); }
    console.log(JSON.stringify(findCandidates(a, b || '', Number(c) || null), null, 2));
  } else if (cmd === 'statement') {
    console.log(JSON.stringify(statementExists(a ?? ''), null, 2));
  } else if (cmd === 'list') {
    const d = a ? Number(a) : null;
    console.log(JSON.stringify(shipped(load(), d).map((e) => ({
      task_id: e.task_id, duration_s: e.duration_s, structure_id: e.structure_id,
      categories: e.categories, statement: e.statement, answer: e.answer,
    })), null, 2));
  } else {
    console.error('commands: candidates | statement | list');
    process.exit(2);
  }
}
