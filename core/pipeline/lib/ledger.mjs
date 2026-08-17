/**
 * Topic ledger + deduplication lookup.
 *
 * Dedup matches on normalised concept, never on title string. Two mechanisms:
 *   1. exact `concept_slug` collision  → hard duplicate
 *   2. tag overlap >= TAG_OVERLAP_MIN  → candidate, handed to the Generator to judge
 *
 * The ledger is a plain JSON file. There is deliberately no database and no MCP server behind
 * it: a few thousand entries of a few hundred bytes is a file, and a file diffs in review.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LEDGER } from './paths.mjs';

export const TAG_OVERLAP_MIN = 2;
/** After this many failures on the same slug the topic is closed, not retried forever. */
export const MAX_FAILED_ATTEMPTS = 3;

const EMPTY = { version: 1, entries: [] };

export function load(file = LEDGER) {
  if (!fs.existsSync(file)) return structuredClone(EMPTY);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(raw.entries)) throw new Error(`ledger ${file}: entries[] missing`);
  return raw;
}

export function save(ledger, file = LEDGER) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n');
}

/**
 * Normalise a concept slug so that cosmetic variation collapses.
 * "The Digit-Sum Rule for 9!" and "digit sum rule for 9" become the same key.
 */
export function normaliseSlug(slug) {
  return String(slug)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normaliseTags(tags) {
  const list = Array.isArray(tags)
    ? tags
    : String(tags || '').split(',');
  return [...new Set(list.map(normaliseSlug).filter(Boolean))].sort();
}

/**
 * Candidates a proposed topic must be judged against.
 *
 * `blocked` entries end the proposal outright. `candidates` are near-misses on tag overlap —
 * the Generator decides whether a viewer would learn anything new, because that judgement is
 * semantic and a set-intersection cannot make it.
 */
export function findCandidates(conceptSlug, tags, ledger = load()) {
  const slug = normaliseSlug(conceptSlug);
  const tagSet = new Set(normaliseTags(tags));

  const sameSlug = ledger.entries.filter((e) => normaliseSlug(e.concept_slug) === slug);
  const shipped = sameSlug.filter((e) => e.status === 'shipped');
  const failures = sameSlug.filter((e) => e.status === 'failed').length;

  const blocked = [];
  if (shipped.length) {
    blocked.push({ reason: 'slug-already-shipped', entries: shipped.map((e) => e.id) });
  }
  if (failures >= MAX_FAILED_ATTEMPTS) {
    blocked.push({ reason: 'slug-closed-after-repeated-failure', attempts: failures });
  }

  const candidates = ledger.entries
    .filter((e) => normaliseSlug(e.concept_slug) !== slug)
    .map((e) => {
      const overlap = normaliseTags(e.tags).filter((t) => tagSet.has(t));
      return { entry: e, overlap };
    })
    .filter(({ overlap }) => overlap.length >= TAG_OVERLAP_MIN)
    .sort((a, b) => b.overlap.length - a.overlap.length)
    .map(({ entry, overlap }) => ({
      id: entry.id,
      concept_slug: entry.concept_slug,
      title: entry.title,
      status: entry.status,
      shared_tags: overlap,
    }));

  return { slug, tags: [...tagSet], blocked, candidates };
}

/**
 * The `Math tricks #N` counter: one more than the highest already shipped.
 *
 * Derived from the ledger rather than stored in a separate file, so it cannot drift from what
 * actually went out. It identifies a post in a series the audience follows, so it never restarts
 * and never skips — a failed lesson does not consume a number.
 */
export function nextCounter(ledger = load()) {
  const used = ledger.entries
    .filter((e) => e.status === 'shipped' && Number.isFinite(e.counter))
    .map((e) => e.counter);
  return used.length ? Math.max(...used) + 1 : 1;
}

/**
 * Append a run outcome. Every outcome is recorded — including failures, which do not block a
 * retry but do count toward MAX_FAILED_ATTEMPTS. Only `shipped` blocks a future topic.
 */
export function record(entry, { file = LEDGER } = {}) {
  const required = ['id', 'concept_slug', 'title', 'status', 'created_at'];
  for (const k of required) {
    if (entry[k] == null) throw new Error(`ledger.record: missing required field "${k}"`);
  }
  if (!['shipped', 'failed', 'blocked'].includes(entry.status)) {
    throw new Error(`ledger.record: bad status "${entry.status}"`);
  }
  const ledger = load(file);
  ledger.entries.push({
    ...entry,
    concept_slug: normaliseSlug(entry.concept_slug),
    tags: normaliseTags(entry.tags),
  });
  save(ledger, file);
  return entry.id;
}

// ---------------------------------------------------------------------------
// CLI — the Generator calls this rather than parsing the ledger itself.
//   node core/pipeline/lib/ledger.mjs candidates '<slug>' '<tag,tag,...>'
//   node core/pipeline/lib/ledger.mjs list
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'candidates') {
    if (!a) {
      console.error('usage: ledger.mjs candidates <concept_slug> <tags,csv>');
      process.exit(2);
    }
    console.log(JSON.stringify(findCandidates(a, b || ''), null, 2));
  } else if (cmd === 'list') {
    const l = load();
    console.log(JSON.stringify(l.entries.map((e) => ({
      id: e.id, concept_slug: e.concept_slug, status: e.status, tags: e.tags,
    })), null, 2));
  } else {
    console.error('commands: candidates | list');
    process.exit(2);
  }
}
