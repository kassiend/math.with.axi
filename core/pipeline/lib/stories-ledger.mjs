/**
 * Story ledger — deduplication for math-story posts.
 *
 * A third ledger rather than a third status on an existing one, for the same reason tasks and
 * lessons are separate: they answer different questions. A lesson dedups on concept ("have we
 * taught this?"), a task on puzzle shape ("have we asked this?"), a story on SUBJECT ("have we
 * told this?"). Euler can legitimately appear as a lesson concept and as a story subject; only
 * telling his story twice is a repeat.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT } from './paths.mjs';

export const STORIES_LEDGER = path.join(CONTENT, 'stories-ledger.json');

/** How many recent stories a subject or an angle is blocked for. */
export const SUBJECT_WINDOW = 30;
export const ANGLE_WINDOW = 10;

const EMPTY = { version: 1, entries: [] };

export function load(file = STORIES_LEDGER) {
  if (!fs.existsSync(file)) return structuredClone(EMPTY);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(raw.entries)) throw new Error(`stories ledger ${file}: entries[] missing`);
  return raw;
}

export function save(ledger, file = STORIES_LEDGER) {
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

const shipped = (ledger) => ledger.entries.filter((e) => e.status === 'shipped');

/**
 * What a proposed story must clear.
 *
 * `subject_slug` is the person, object or phenomenon. `angle_slug` is what is said about it —
 * "euler" told as the bridges of Konigsberg and "euler" told as e^(i*pi)+1=0 are two stories, and
 * blocking on subject alone would lose the second one forever. Both are checked, with different
 * windows: a subject may return after a long gap, an angle should not.
 */
export function findCandidates(subjectSlug, angleSlug, area, ledger = load()) {
  const subject = normaliseSlug(subjectSlug);
  const angle = normaliseSlug(angleSlug);
  const done = shipped(ledger);
  const blocked = [];

  const subjectHit = done.slice(-SUBJECT_WINDOW).filter((e) => normaliseSlug(e.subject_slug) === subject);
  if (subjectHit.length) {
    blocked.push({
      rule: 'subject-too-recent',
      detail: `"${subject}" appeared within the last ${SUBJECT_WINDOW} stories`,
      entries: subjectHit.map((e) => e.story_id),
    });
  }

  const angleHit = done.filter((e) => normaliseSlug(e.angle_slug) === angle);
  if (angleHit.length) {
    blocked.push({
      rule: 'angle-already-told',
      detail: `this exact angle has shipped before — a retelling is not a new story`,
      entries: angleHit.map((e) => e.story_id),
    });
  }

  return {
    subject_slug: subject,
    angle_slug: angle,
    area,
    blocked,
    recent: done.slice(-ANGLE_WINDOW).map((e) => ({
      story_id: e.story_id, subject_slug: e.subject_slug, angle_slug: e.angle_slug, area: e.area,
    })),
  };
}

export function record(entry, { file = STORIES_LEDGER } = {}) {
  for (const k of ['story_id', 'subject_slug', 'angle_slug', 'area', 'status', 'created_at']) {
    if (entry[k] == null) throw new Error(`stories-ledger.record: missing required field "${k}"`);
  }
  if (!['shipped', 'failed', 'rejected'].includes(entry.status)) {
    throw new Error(`stories-ledger.record: bad status "${entry.status}"`);
  }
  const ledger = load(file);
  ledger.entries.push({
    ...entry,
    subject_slug: normaliseSlug(entry.subject_slug),
    angle_slug: normaliseSlug(entry.angle_slug),
  });
  save(ledger, file);
  return entry.story_id;
}

/** Drop every row for a story_id. Only for re-rendering a post that already shipped. */
export function remove(storyId, { file = STORIES_LEDGER } = {}) {
  const ledger = load(file);
  const before = ledger.entries.length;
  ledger.entries = ledger.entries.filter((e) => e.story_id !== storyId);
  save(ledger, file);
  return before - ledger.entries.length;
}

// ---------------------------------------------------------------------------
//   node core/pipeline/lib/stories-ledger.mjs candidates '<subject>' '<angle>' '<area>'
//   node core/pipeline/lib/stories-ledger.mjs list
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === 'candidates') {
    if (!a) { console.error('usage: candidates <subject_slug> <angle_slug> <area>'); process.exit(2); }
    console.log(JSON.stringify(findCandidates(a, b || '', c || null), null, 2));
  } else if (cmd === 'list') {
    console.log(JSON.stringify(shipped(load()).map((e) => ({
      story_id: e.story_id, area: e.area, subject_slug: e.subject_slug,
      angle_slug: e.angle_slug, seconds: e.seconds,
    })), null, 2));
  } else {
    console.error('commands: candidates | list');
    process.exit(2);
  }
}
