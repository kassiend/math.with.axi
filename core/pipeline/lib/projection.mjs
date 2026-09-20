/**
 * The generator -> verifier isolation boundary, as code rather than as something typed by hand
 * each run.
 *
 * The Verifier must never see how the payload was arrived at. Fields are DROPPED, not redacted:
 * a redacted field still tells the Verifier that something was there and roughly how big, and
 * that is a channel.
 *
 * See core/agents/ISOLATION.md for why this matters and what else backs it up.
 */
import fs from 'node:fs';
import path from 'node:path';

/** What the Verifier sees of a daily-task payload. */
export const TASK_VISIBLE = Object.freeze([
  'task_id', 'duration_s', 'structure_id', 'categories', 'description',
  'statement', 'statement_latex', 'answer', 'answer_latex', 'steps_expected', 'nulls',
]);

/**
 * What the Verifier sees of a lesson plan.
 *
 * `operand_draw` crosses in part: the seed, spec and draws are facts the Verifier must audit under
 * section 3.4. The planner's prose justification for choosing that range does not cross — that is
 * reasoning, and reading it is how a verifier ends up agreeing instead of checking.
 */
export const LESSON_VISIBLE = Object.freeze([
  'lesson_id', 'counter', 'concept_slug', 'tags', 'method_name',
  'applicability', 'carry_case', 'steps', 'worked_example', 'nulls',
]);
export const LESSON_DRAW_VISIBLE = Object.freeze([
  'seed', 'spec', 'draws', 'rejection_rate', 'construction', 'n', 'unit', 'rejections',
]);

/**
 * What the story Validator sees: the script and its claimed sources. Not the writer's search
 * history, discarded angles, image prompts or check script — it opens the URLs blind. `images`
 * and `nulls` are withheld deliberately: knowing which claims the writer already flagged as shaky
 * is precisely the hint that turns checking into agreeing.
 */
export const STORY_VALIDATOR_VISIBLE = Object.freeze([
  'story_id', 'area', 'subject_slug', 'angle_slug', 'title', 'beats',
  'formula_latex', 'formula_steps', 'mechanism', 'facts',
]);
export const STORY_BEAT_VISIBLE = Object.freeze(['beat', 'narration', 'display']);

/** What the Verifier sees of a story: the formula and the claim about why it holds. */
export const STORY_VERIFIER_VISIBLE = Object.freeze(['title', 'formula_latex', 'formula_steps', 'mechanism']);

/** Key names that must never reach the Verifier, whatever list they hide behind. */
export const FORBIDDEN_KEY_PATTERNS = Object.freeze([
  /prompt/i, /rationale/i, /reasoning/i, /chain[_-]?of[_-]?thought/i, /\bdraft\b/i,
  /sketch/i, /why[_-]i[_-]/i, /instruction_to/i, /thinking/i, /scratch/i,
  /dedup_check/i, /_note$/i, /check_script/i, /tried/i,
]);

export class IsolationError extends Error {}

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

function project(payload, visible) {
  const out = {};
  for (const field of visible) if (field in payload) out[field] = structuredClone(payload[field]);
  return out;
}

/**
 * Throws rather than sanitising. A forbidden key surviving projection is a bug upstream, and
 * quietly stripping it would hide that the allowlist and the payload have drifted apart.
 */
function assertClean(projected, label) {
  const leaked = scanKeys(projected);
  if (leaked.length) {
    throw new IsolationError(
      `${label}: forbidden keys survived projection: ${leaked.join(', ')} — ` +
      'the Verifier must not see how the payload was produced'
    );
  }
  return projected;
}

export function projectTask(payload) {
  return assertClean(project(payload, TASK_VISIBLE), 'task');
}

export function projectStoryForValidator(story) {
  const out = project(story, STORY_VALIDATOR_VISIBLE);
  out.beats = (story.beats ?? []).map((b) => project(b, STORY_BEAT_VISIBLE));
  return assertClean(out, 'story/validator');
}

export function projectStoryForVerifier(story) {
  return assertClean({ claim_id: story.story_id, ...project(story, STORY_VERIFIER_VISIBLE) }, 'story/verifier');
}

export function projectLesson(plan) {
  const out = project(plan, LESSON_VISIBLE);
  // `sampling` is accepted as an alias because planners have written both names — the field was
  // required by section 3.4 long before the plan schema named it. Getting this wrong is not a
  // cosmetic drift: the draw silently fails to cross, the Verifier reports operand provenance as
  // unverifiable, and the lesson fails a gate for a fact it was actually given.
  const drawn = plan.operand_draw ?? plan.sampling;
  if (drawn) {
    out.operand_draw = project(drawn, LESSON_DRAW_VISIBLE);
  }
  return assertClean(out, 'lesson');
}

/**
 * Write the sandbox the Verifier runs in: a directory holding only what it may read. Everything
 * else in the run directory is outside its working tree.
 */
export function writeVerifierBox(runDir, projected) {
  const box = path.join(runDir, 'verifier.box');
  fs.mkdirSync(path.join(box, 'verifier.checks'), { recursive: true });
  fs.writeFileSync(path.join(box, 'verifier.in.json'), JSON.stringify(projected, null, 2));
  return box;
}

/** The Validator's sandbox: one file, the projected script and sources. */
export function writeValidatorBox(runDir, projected) {
  const box = path.join(runDir, 'validator.box');
  fs.mkdirSync(box, { recursive: true });
  fs.writeFileSync(path.join(box, 'validator.in.json'), JSON.stringify(projected, null, 2));
  return box;
}

/** What was withheld — logged so the boundary is auditable after the fact. */
export function withheldFrom(payload, projected) {
  return Object.keys(payload).filter((k) => !(k in projected));
}
