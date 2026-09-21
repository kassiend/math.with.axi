/**
 * Runs one post end to end: agents, gates, render.
 *
 * Every agent is a separate `claude -p` process. That separation IS the context isolation — see
 * core/agents/ISOLATION.md. The Verifier additionally runs with its working directory set to a
 * sandbox holding only the allowlisted projection of the payload.
 *
 * A closed gate is a NORMAL outcome, not an error: the caller retries with a fresh topic, and the
 * ledger has already recorded the failure so the next attempt steers away from it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CORE, ROOT, runDir as runDirFor } from '../pipeline/lib/paths.mjs';
import { resolveBin, spawnTool } from '../pipeline/lib/platform.mjs';
import {
  projectTask, projectLesson, projectStoryForValidator, projectStoryForVerifier,
  writeVerifierBox, writeValidatorBox, withheldFrom,
} from '../pipeline/lib/projection.mjs';
import { nextTaskArea, nextLessonArea, nextStoryArea } from '../pipeline/lib/rotation.mjs';
import * as ledger from '../pipeline/lib/ledger.mjs';

const CLAUDE = () => resolveBin('claude');
const AGENT_TIMEOUT_MS = 25 * 60 * 1000;
/** Quiet time after the expected file appears before the agent is considered finished. */
const AGENT_QUIET_MS = 60 * 1000;

/**
 * A path to hand an agent: ABSOLUTE, with forward slashes.
 *
 * These used to be root-relative, which reads better and is correct only while the agent's
 * working directory is still the root. An agent that runs `cd <run-dir>` in a Bash call and then
 * writes the root-relative path lands its output at `<run-dir>/core/out/runs/<run-dir>/…` — which
 * looks to the pipeline exactly like an agent that produced nothing, and costs a whole run to
 * diagnose. Forward slashes because a backslash inside a prompt is an escape waiting to happen.
 */
const agentPath = (...parts) => path.resolve(...parts).split(path.sep).join('/');

export class GateClosed extends Error {
  constructor(stage, detail) { super(`gate closed at ${stage}`); this.stage = stage; this.detail = detail; }
}

/**
 * Spawn an agent. The prompt goes in on stdin rather than argv: prompts are long, contain
 * newlines and quotes, and under a Windows shell an argv prompt is re-parsed by cmd.
 */
function runAgent({ agent, prompt, cwd, allowedTools, log, expectFile }) {
  return new Promise((resolve, reject) => {
    // stream-json so every tool call is a line on stdout: that is what "quiet" is measured on.
    // With the default output format stdout carries only the final answer and a working agent
    // looks idle.
    const args = ['-p', '--agent', agent, '--output-format', 'stream-json', '--verbose'];
    if (allowedTools?.length) args.push('--allowedTools', allowedTools.join(' '));

    const child = spawnTool(CLAUDE(), args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    let settled = false;
    let lastActivity = Date.now();
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(watchdog);
      fn(value);
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(reject, new Error(`${agent} timed out after ${AGENT_TIMEOUT_MS / 60000} minutes`));
    }, AGENT_TIMEOUT_MS);

    // The agent is done when it has written what it was asked for and gone quiet. Observed: a
    // planner wrote its plan in 90 s and the process then sat for 23 minutes — a stray child of
    // one of its Bash calls kept the pipes open. The output file is the ground truth, not the
    // process lifetime.
    const watchdog = setInterval(() => {
      if (!expectFile || !fs.existsSync(expectFile)) return;
      const quietFor = Date.now() - Math.max(lastActivity, fs.statSync(expectFile).mtimeMs);
      if (quietFor > AGENT_QUIET_MS) {
        log?.(`  ${agent} wrote ${path.basename(expectFile)} and has been quiet ${Math.round(quietFor / 1000)}s — done`);
        child.kill('SIGTERM');
        finish(resolve, out);
      }
    }, 5000);

    child.stdout.on('data', (d) => { out += d; lastActivity = Date.now(); });
    child.stderr.on('data', (d) => { err += d; lastActivity = Date.now(); });
    child.on('error', (e) => finish(reject, e));
    // `exit`, not `close`: close waits for every descendant holding the stdio pipes to end.
    child.on('exit', (code) => {
      log?.(`  ${agent} exited ${code}`);
      if (code !== 0 && code != null) return finish(reject, new Error(`${agent} exited ${code}: ${err.slice(-500)}`));
      finish(resolve, out);
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/** Run an orchestrator in-process-adjacent, so its exit code carries the gate outcome. */
function runOrchestrator(script, args, log) {
  return new Promise((resolve, reject) => {
    const child = spawnTool(process.execPath, [path.join(CORE, 'pipeline', script), ...args], {
      cwd: CORE, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
    child.stderr.on('data', (d) => { out += d; process.stderr.write(d); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, out }));
  });
}

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

function freshRunDir(prefix) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = runDirFor(`${prefix}-${stamp}`);
  fs.mkdirSync(path.join(dir, 'generator.checks'), { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// Daily task
// ---------------------------------------------------------------------------

export async function generateTask(durationS, { log = console.log } = {}) {
  const brief = `assets/templates/tasks/task-${durationS}s.md`;
  const dir = freshRunDir(`task-${durationS}s`);
  const area = nextTaskArea(durationS);
  log(`  run dir: ${path.relative(ROOT, dir)}`);
  log(`  area assigned: ${area.assigned}  (${area.used} of ${area.poolSize} used)`);

  await runAgent({
    agent: 'axi-task-generator',
    cwd: ROOT,
    allowedTools: ['Read', 'Write', 'Glob', 'Grep', 'Bash'],
    expectFile: path.join(dir, 'task.out.json'),
    log,
    prompt: [
      `Read ${brief} in full — it is your brief for this run.`,
      ``,
      `Run directory (absolute — use it as given, whatever your shell's cwd is): ${agentPath(dir)}`,
      ``,
      `Produce ONE puzzle with a ${durationS}-second timer.`,
      ``,
      `SUBJECT AREA — ASSIGNED, NOT YOURS TO CHOOSE: ${area.assigned}`,
      ``,
      `Your first category MUST be "${area.assigned}". This is the area that has gone longest`,
      `without use, and it is assigned rather than chosen because a free choice converges on the`,
      `same two or three prototypical topics every time.`,
      ``,
      `Only if this area genuinely cannot carry a puzzle at this difficulty, fall back to the`,
      `first workable one of: ${area.alternatives.join(', ')} — and say in your report which you`,
      `used and why the assigned one failed.`,
      ``,
      `Deduplicate against core/content/tasks-ledger.json using the CLI in your brief.`,
      `Shapes already shipped are blocked, including across the other duration.`,
      ``,
      `IMPORTANT — check_script must be relative to the run directory, i.e. exactly`,
      `"generator.checks/<task_id>.py", not a path from the repository root.`,
      ``,
      `The statement renders inside the countdown ring, as the biggest thing on the card: a`,
      `322 px wide, 262 px tall safe box (design px), auto-fit from 96 px down to a 40 px floor,`,
      `and a LaTeX statement never wraps. A single-line KaTeX expression fits at the floor only up`,
      `to ~14 characters of glyphs; five bracketed factors or a long product will be rejected.`,
      `Keep the statement to ONE short expression (aim for <= 12 characters), and put anything`,
      `longer — a sequence, a product, a sum with several terms — in "description" as the`,
      `question, with only the compact object in "statement". Plain text may wrap to two lines.`,
      ``,
      `Write ${agentPath(dir)}/task.out.json and`,
      `${agentPath(dir)}/generator.checks/<task_id>.py, run the check with the venv`,
      `python, and report what it printed.`,
    ].join('\n'),
  });

  const taskFile = path.join(dir, 'task.out.json');
  if (!fs.existsSync(taskFile)) throw new GateClosed('generator', 'no task.out.json produced');
  const task = readJson(taskFile);
  if (task.status === 'no_task') throw new GateClosed('dedup', task);

  // --- isolation boundary -------------------------------------------------
  const projected = projectTask(task);
  const box = writeVerifierBox(dir, projected);
  log(`  verifier sees ${Object.keys(projected).length} fields; withheld: ${withheldFrom(task, projected).join(', ')}`);

  if (done(path.join('verifier.box', 'verifier.out.json'))) {
    log('  verifier.out.json already present — skipping the verifier');
  } else await runAgent({
    agent: 'axi-verifier',
    cwd: box,
    allowedTools: ['Read', 'Write', 'Bash'],
    expectFile: path.join(box, 'verifier.out.json'),
    log,
    prompt: [
      `Read ./verifier.in.json. It is the only input you get and the only file you may read apart`,
      `from files you write yourself.`,
      ``,
      `This is a daily-task post, not a lesson: section 3.2 of your brief (applicability condition`,
      `and counterexample) is waived — a one-off puzzle is not a technique. Everything else applies.`,
      ``,
      `Write ONE independent check into ./verifier.checks/${task.task_id}.py, derived from the`,
      `statement alone. Run it with the interpreter at:`,
      `  ${path.join(CORE, '.venv', process.platform === 'win32' ? 'Scripts\\python.exe' : 'bin/python')}`,
      `It must print exactly one line of JSON:`,
      `  {"task_id": "...", "computed": "...", "agrees": true|false}`,
      ``,
      `Then judge: does the statement unambiguously determine the stated answer, is the answer`,
      `exact rather than rounded, and is it in simplest form? Watch the sign and the branch.`,
      ``,
      `Write your report to ./verifier.out.json in the schema from your brief.`,
    ].join('\n'),
  });

  const { code } = await runOrchestrator('orchestrate-task.mjs', ['--run', dir], log);
  if (code === 2) throw new GateClosed('orchestrator', readOutcome(dir));
  if (code !== 0) throw new Error(`task orchestrator exited ${code}`);

  const video = path.join(ROOT, 'output', 'posts', 'tasks', `${durationS}s`, `${task.task_id}.mp4`);
  if (!fs.existsSync(video)) throw new Error(`orchestrator reported success but ${video} is missing`);

  return {
    kind: 'task', video, runDir: dir,
    meta: {
      id: task.task_id,
      statement: task.statement,
      answer: task.answer,
      structure: task.structure_id,
      // Carried so the answer message can explain the trick — you need it to write the comment,
      // and digging it out of the run directory afterwards is friction you would feel daily.
      solution: task.solution_sketch ?? null,
      durationS,
    },
  };
}

// ---------------------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------------------

/**
 * @param {object} [opts]
 * @param {string} [opts.topic]  a subject assigned by a person, replacing the rotation for this
 *   run only. The rotation exists to stop an AGENT converging on multiplication shortcuts, not to
 *   stop the channel's owner from asking for a specific lesson — but it is an override, so it is
 *   logged and recorded rather than silently taking the rotation's turn.
 * @param {string} [opts.resume]  an existing run directory to continue. Each stage is skipped
 *   when its output file is already there, so a run interrupted after the planner does not pay
 *   for a second planner — and, more importantly, does not silently discard a good plan and
 *   generate a different lesson under the same request.
 */
export async function generateLesson({ log = console.log, topic = null, resume = null } = {}) {
  // Resolved against the repository root, not the process cwd: the worker runs from core/ but is
  // invoked from the root, and every run path this pipeline prints is already root-relative.
  const dir = resume ? path.resolve(ROOT, resume) : freshRunDir('lesson');
  const rel = agentPath(dir);
  if (resume && !fs.existsSync(dir)) throw new Error(`--resume: no such run directory: ${dir}`);
  fs.mkdirSync(path.join(dir, 'audio'), { recursive: true });
  const done = (f) => fs.existsSync(path.join(dir, f));
  const area = topic || resume ? null : nextLessonArea();
  log(`  run dir: ${path.relative(ROOT, dir)}${resume ? '  (resumed)' : ''}`);
  if (topic) log(`  topic assigned by hand: ${topic}  (rotation not advanced)`);
  else if (!resume) log(`  area assigned: ${area.assigned}  (${area.used} of ${area.poolSize} used)`);

  const seed = Number(BigInt(Date.now()) % 2147483647n);

  if (done('plan.out.json')) log('  plan.out.json already present — skipping the planner');
  else await runAgent({
    agent: 'axi-lesson-planner',
    cwd: ROOT,
    allowedTools: ['Read', 'Write', 'Glob', 'Grep', 'Bash'],
    expectFile: path.join(dir, 'plan.out.json'),
    log,
    prompt: [
      `Read assets/templates/lesson/lesson.md in full — it is the brief.`,
      ``,
      `Run directory (absolute — use it as given, whatever your shell's cwd is): ${rel}`,
      ``,
      ...(topic ? [
        `SUBJECT — ASSIGNED BY THE CHANNEL OWNER, NOT YOURS TO CHOOSE:`,
        topic,
        ``,
        `This overrides the usual area rotation for this run. Echo the area back in the plan as an`,
        `"area" field anyway, naming the branch of technique this actually belongs to.`,
        ``,
        `You still choose the method, the framing and the numbers WITHIN this subject. If the`,
        `subject as stated cannot carry a 30-60 second method lesson, say so in nulls[] and emit`,
        `{"status": "no_topic"} rather than teaching something adjacent instead.`,
        ``,
      ] : [
        `SUBJECT AREA — ASSIGNED, NOT YOURS TO CHOOSE: ${area.assigned}`,
        ``,
        `Teach a method from this area, and echo it back in the plan as an "area" field. It is`,
        `assigned rather than chosen because a free choice converges on multiplication shortcuts and`,
        `square roots every time, and a channel that only shows those reads as a party trick rather`,
        `than as teaching. This is the area that has gone longest without use.`,
        ``,
        `Only if this area genuinely cannot carry a 30-60 second method lesson, fall back to the`,
        `first workable one of: ${area.alternatives.join(', ')} — and say which you used and why.`,
        ``,
      ]),
      `Deduplicate against core/content/ledger.json. Anything already shipped is blocked,`,
      `and so is a paraphrase of it — match on concept, not wording.`,
      ``,
      `The counter for this lesson is ${ledger.nextCounter()} — use exactly that. (One more than the`,
      `highest shipped, with the floor from LESSON_COUNTER_START; the orchestrator re-checks it.)`,
      ``,
      `Draw the worked example's operands with core/pipeline/lib/sampling.mjs using seed ${seed}`,
      `and a declared spec. Do not hand-pick numbers. If the drawn operands do not suit the method,`,
      `the method and the range disagree — change the range declaration, never the draw.`,
      ``,
      `State applicability precisely and give carry_case, the concrete input where the simple rule`,
      `breaks. If the technique genuinely has no exception, set it null with a reason in nulls[].`,
      ``,
      `3 to 5 steps, each with purpose, instruction (black line) and working (blue line). Keep both`,
      `SHORT — the card is notes, not speech.`,
      ``,
      `Section 2.5 of the brief lists the VISUALS a step may carry. The registry is closed: pick a`,
      `type and its parameters, never write markup or coordinates. A step with a visual gets less`,
      `room for text and its working line may not wrap, so keep those steps especially short.`,
      ``,
      `Write ${rel}/generator.checks/<lesson_id>.py confirming the worked example AND the`,
      `applicability claim, exhaustively over the stated domain where that domain is finite, and`,
      `run it with core/.venv/bin/python.`,
      ``,
      `Your check is a GATE, not a report. If it prints FAILED, the plan is wrong: fix the plan —`,
      `usually the applicability boundary or the carry case — and run it again. Only write`,
      `${rel}/plan.out.json once your own check passes, then report what it printed.`,
      ``,
      `OUTPUT CONTRACT — the orchestrator reads only the LAST line your check prints on stdout,`,
      `and it must be exactly one line of JSON, printed with json.dumps and nothing after it:`,
      `  {"claim_id": "<lesson_id>", "computed": "<worked example result>", "agrees": true|false}`,
      `Print as much human-readable detail as you like before it. A check that ends in prose —`,
      `"ALL CHECKS PASSED", say — cannot be cross-checked against the Verifier's, and the lesson`,
      `fails the gate over its formatting rather than its mathematics.`,
      ``,
      `Watch the boundary in particular. A condition stated as "valid exactly when X" is false if`,
      `X is sufficient but not necessary; test both directions before writing it down.`,
    ].join('\n'),
  });

  const planFile = path.join(dir, 'plan.out.json');
  if (!fs.existsSync(planFile)) throw new GateClosed('planner', 'no plan.out.json produced');
  const plan = readJson(planFile);
  if (plan.status === 'no_topic') throw new GateClosed('dedup', plan);

  if (done('narration.out.json')) log('  narration.out.json already present — skipping the narrator');
  else await runAgent({
    agent: 'axi-lesson-narrator',
    cwd: ROOT,
    allowedTools: ['Read', 'Write', 'Bash'],
    expectFile: path.join(dir, 'narration.out.json'),
    log,
    prompt: [
      `Read assets/templates/lesson/lesson.md in full — it is the brief.`,
      ``,
      `Run directory (absolute — use it as given, whatever your shell's cwd is): ${rel}`,
      `Read ${rel}/plan.out.json. It is your only input about what is taught. Change no number,`,
      `formula, step order, counter or applicability.`,
      ``,
      `Write two parallel scripts: spoken narration with eleven_v3 emotion tags, and the display`,
      `copy, which is the instruction/working lines from the plan used as-is.`,
      ``,
      `The intro opens a gap and carries an on-screen line (intro.display, <= 6 words); it must not`,
      `pose the problem that step 1 poses. The outro is one ask (outro.narration + outro.display).`,
      ``,
      `Synthesize one clip per step plus one each for the intro and the outro with the existing`,
      `tool. Do not hand-roll HTTP and never print the API key:`,
      `  node core/tools/elevenlabs.mjs say --text "<narration>" --out ${rel}/audio/intro.mp3`,
      `  node core/tools/elevenlabs.mjs say --text "<narration>" --out ${rel}/audio/s1.mp3`,
      `  node core/tools/elevenlabs.mjs say --text "<narration>" --out ${rel}/audio/outro.mp3`,
      `It caches by text hash, measures duration with ffprobe and prints JSON. Use the printed`,
      `"seconds" values verbatim.`,
      ``,
      `Budget: the whole post must land under 60 seconds including the intro, the outro and ~1s of`,
      `transitions. Speech runs roughly 12 characters per second. Aim for 25-35 seconds of speech.`,
      ``,
      `Write ${rel}/narration.out.json in the schema from section 3.4 of the brief.`,
    ].join('\n'),
  });

  if (!fs.existsSync(path.join(dir, 'narration.out.json'))) {
    throw new GateClosed('narrator', 'no narration.out.json produced');
  }

  // --- isolation boundary -------------------------------------------------
  const projected = projectLesson(plan);
  const box = writeVerifierBox(dir, projected);
  log(`  verifier sees ${Object.keys(projected).length} fields; withheld: ${withheldFrom(plan, projected).join(', ')}`);

  if (done(path.join('verifier.box', 'verifier.out.json'))) {
    log('  verifier.out.json already present — skipping the verifier');
  } else await runAgent({
    agent: 'axi-verifier',
    cwd: box,
    allowedTools: ['Read', 'Write', 'Bash'],
    expectFile: path.join(box, 'verifier.out.json'),
    log,
    prompt: [
      `Read ./verifier.in.json. It is the only input you get and the only file you may read apart`,
      `from files you write yourself.`,
      ``,
      `This is a LESSON, not a one-off puzzle, so section 3.2 applies IN FULL: the technique must`,
      `state precisely when it works, and either give the case where it breaks or prove universality.`,
      `If carry_case is null the payload is claiming there is no exception — your job is to TEST`,
      `that claim, not accept it. Probe the boundary of the stated domain and just outside it.`,
      ``,
      `Write ONE independent check into ./verifier.checks/${plan.lesson_id}.py, derived from the`,
      `payload alone. Run it with the interpreter at:`,
      `  ${path.join(CORE, '.venv', process.platform === 'win32' ? 'Scripts\\python.exe' : 'bin/python')}`,
      `It must print exactly one line of JSON:`,
      `  {"claim_id": "${plan.lesson_id}", "computed": "<worked example result>", "agrees": true|false}`,
      ``,
      `Also judge: do the display steps read in order actually produce the stated result, or is a`,
      `step missing that a viewer would need? Was the operand drawn rather than hand-picked?`,
      ``,
      `Write your report to ./verifier.out.json in the schema from your brief.`,
    ].join('\n'),
  });

  const { code } = await runOrchestrator('orchestrate-lesson.mjs', ['--run', dir], log);
  if (code === 2) throw new GateClosed('orchestrator', readOutcome(dir));
  if (code !== 0) throw new Error(`lesson orchestrator exited ${code}`);

  const video = path.join(ROOT, 'output', 'posts', 'lessons', `${plan.lesson_id}.mp4`);
  if (!fs.existsSync(video)) throw new Error(`orchestrator reported success but ${video} is missing`);

  return {
    kind: 'lesson', video, runDir: dir,
    meta: { id: plan.lesson_id, method: plan.method_name, counter: plan.counter },
  };
}

// ---------------------------------------------------------------------------
// Story
// ---------------------------------------------------------------------------

export async function generateStory({ log = console.log } = {}) {
  const dir = freshRunDir('story');
  const rel = path.relative(ROOT, dir);
  fs.mkdirSync(path.join(dir, 'audio'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'images'), { recursive: true });
  const area = nextStoryArea();
  log(`  run dir: ${rel}`);
  log(`  area assigned: ${area.assigned}  (${area.used} of ${area.poolSize} used)`);

  await runAgent({
    agent: 'axi-story-writer',
    cwd: ROOT,
    allowedTools: ['Read', 'Write', 'Glob', 'Grep', 'Bash', 'WebSearch', 'WebFetch'],
    expectFile: path.join(dir, 'story.out.json'),
    log,
    prompt: [
      `Read assets/templates/stories/story.md in full — it is the brief.`,
      ``,
      `Run directory: ${rel}`,
      ``,
      `AREA — ASSIGNED, NOT YOURS TO CHOOSE: ${area.assigned}`,
      `Fall back only if it genuinely cannot carry a story, to the first workable of:`,
      `${area.alternatives.join(', ')} — and say which you used and why.`,
      ``,
      `Deduplicate on subject AND angle with core/pipeline/lib/stories-ledger.mjs.`,
      ``,
      `Answer the four questions in section 3.5 of the brief (goal, identity signal, stat, gap)`,
      `before choosing; a subject a sixteen-year-old would not send to a friend is rejected.`,
      `Put a stat on the hook or turn beat when the story has one, name an image_id on every`,
      `beat but the formula beat, generate the images at --aspect 9:16, and write music_prompt.`,
      ``,
      `Every factual claim goes in facts[] with a URL you opened and the supporting sentence`,
      `quoted verbatim. Never invent a quotation. The mechanism is mandatory: formula_latex plus`,
      `formula_steps (2-4 derivation lines ending in the formula, in the order the mechanism`,
      `narration reaches them) plus a check script at generator.checks/<story_id>.py when SymPy`,
      `can settle it; null with a reason when it cannot. The script's LAST LINE is the JSON report`,
      `{"claim_id": "<story_id>", "computed": "<canonical value>", "agrees": true} via json.dumps.`,
      `"computed" is ONE decisive value in canonical SymPy form (str(sympy.simplify(expr)), or the`,
      `result of the procedure on the example the story names) — never a sentence. A blind second`,
      `script must produce the identical string, character for character; section 6 of the brief`,
      `says how to anchor a claim with no single scalar.`,
      ``,
      `Images go under ${rel}/images/ — Commons via core/tools/wikimedia.mjs with the attribution`,
      `recorded, or generated via core/tools/gemini-image.mjs. Every image-beat names its image_id.`,
      ``,
      `Write ${rel}/story.out.json in the schema from section 2 of the brief, including ask.`,
    ].join('\n'),
  });

  const storyFile = path.join(dir, 'story.out.json');
  if (!fs.existsSync(storyFile)) throw new GateClosed('writer', 'no story.out.json produced');
  const story = readJson(storyFile);
  if (story.status === 'no_story') throw new GateClosed('dedup', story);

  // --- isolation boundary: the Validator opens the sources blind ------------
  const vbox = writeValidatorBox(dir, projectStoryForValidator(story));
  await runAgent({
    agent: 'axi-story-validator',
    cwd: vbox,
    allowedTools: ['Read', 'Write', 'Bash', 'WebFetch', 'WebSearch'],
    expectFile: path.join(vbox, 'validator.out.json'),
    log,
    prompt: [
      `Read ./validator.in.json. It is the only input you get and the only file you may read`,
      `apart from files you write yourself.`,
      ``,
      `Open every URL in facts[], confirm the quoted sentence is on the page and that it supports`,
      `the claim as stated. Check the beats for unsourced quotations, unsupported causation,`,
      `anachronism and overreach in the payoff, and whether formula_steps and mechanism describe`,
      `what formula_latex actually says.`,
      ``,
      `Write ./validator.out.json in the schema from your brief.`,
    ].join('\n'),
  });
  const vout = path.join(vbox, 'validator.out.json');
  if (!fs.existsSync(vout)) throw new GateClosed('validator', 'no validator.out.json produced');

  // --- isolation boundary: the Verifier checks the formula blind ------------
  if (story.check_script) {
    const box = writeVerifierBox(dir, projectStoryForVerifier(story));
    await runAgent({
      agent: 'axi-verifier',
      cwd: box,
      allowedTools: ['Read', 'Write', 'Bash'],
      expectFile: path.join(box, 'verifier.out.json'),
      log,
      prompt: [
        `Read ./verifier.in.json. It is the only input you get and the only file you may read apart`,
        `from files you write yourself.`,
        ``,
        `This is a STORY: one formula and the claim about why it holds (mechanism, formula_steps).`,
        `Section 3.2 (applicability/counterexample) is waived. Write ONE independent SymPy check`,
        `into ./verifier.checks/${story.story_id}.py that confirms what the formula asserts and`,
        `that each line of formula_steps follows from the previous. Run it with:`,
        `  ${path.join(CORE, '.venv', process.platform === 'win32' ? 'Scripts\\python.exe' : 'bin/python')}`,
        `Its LAST LINE is one line of JSON:`,
        `  {"claim_id": "${story.story_id}", "computed": "<canonical value>", "agrees": true|false}`,
        `"computed" is ONE decisive value in canonical SymPy form — str(sympy.simplify(expr)) for a`,
        `formula, or the result of the procedure on the concrete example the payload names — never`,
        `a sentence or a test log. The gate passes only if it equals the other script's string.`,
        ``,
        `Write your report to ./verifier.out.json in the schema from your brief.`,
      ].join('\n'),
    });
  }

  await runAgent({
    agent: 'axi-lesson-narrator',
    cwd: ROOT,
    allowedTools: ['Read', 'Write', 'Bash'],
    expectFile: path.join(dir, 'narration.out.json'),
    log,
    prompt: [
      `This is a STORY post, not a lesson. Read assets/templates/stories/story.md sections 5 and 9.`,
      ``,
      `Run directory: ${rel}`,
      `Read ${rel}/story.out.json. The narration text of each beat is already written there; you`,
      `may tag it for eleven_v3 and fix how numbers are spoken, but change no claim, no name, no`,
      `number, no formula. Use no [pause] tags, no ellipses, no em-dashes.`,
      ``,
      `Read fast. Every clip is synthesised at tempo 1.12 with pauses cut to 0.15 s — pass BOTH`,
      `flags on every call, the ask included:`,
      `  node core/tools/elevenlabs.mjs say --text "<narration>" --out ${rel}/audio/<beat>.mp3 --tempo 1.12 --keep-silence 0.15`,
      `  node core/tools/elevenlabs.mjs say --text "<ask>" --out ${rel}/audio/outro.mp3 --tempo 1.12 --keep-silence 0.15`,
      `Use the printed "seconds" values verbatim. Tag for energy: [excited] on the hook,`,
      `[whispers] or [thoughtful] for the turn's secret, [confident] for the mechanism, [warm] for`,
      `the payoff. If a beat's narration is over 12 seconds, report it — do not slow down to fit.`,
      ``,
      `Write ${rel}/narration.out.json as:`,
      `  { "beats": [ { "beat": "hook", "narration": "...", "audio": "audio/hook.mp3", "seconds": 7.9 }, ... ],`,
      `    "outro": { "narration": "...", "audio": "audio/outro.mp3", "seconds": 2.4 },`,
      `    "total_seconds": 44.9 }`,
      `in the same beat order as story.out.json. Total must stay under 90 seconds.`,
    ].join('\n'),
  });
  if (!fs.existsSync(path.join(dir, 'narration.out.json'))) {
    throw new GateClosed('narrator', 'no narration.out.json produced');
  }

  const { code } = await runOrchestrator('orchestrate-story.mjs', ['--run', dir], log);
  if (code === 2) throw new GateClosed('orchestrator', readOutcome(dir));
  if (code !== 0) throw new Error(`story orchestrator exited ${code}`);

  const video = path.join(ROOT, 'output', 'posts', 'stories', `${story.story_id}.mp4`);
  if (!fs.existsSync(video)) throw new Error(`orchestrator reported success but ${video} is missing`);

  return {
    kind: 'story', video, runDir: dir,
    meta: { id: story.story_id, title: story.title, area: story.area },
  };
}

// ---------------------------------------------------------------------------
// Caption — the words around the video, per platform
// ---------------------------------------------------------------------------

/**
 * Runs after the render, never before: copy for a video that failed a gate is wasted, and the
 * agent must describe what shipped. A failure here does not fail the post — the worker falls
 * back to plain copy built from the payload (worker/copy.mjs) and says so in the log.
 */
export async function writeCaption({ kind, dir, log = console.log }) {
  const rel = path.relative(ROOT, dir);
  try {
    await runAgent({
      agent: 'axi-caption-writer',
      cwd: ROOT,
      allowedTools: ['Read', 'Write', 'Glob', 'Grep'],
      expectFile: path.join(dir, 'caption.out.json'),
    log,
      prompt: [
        `Run directory: ${rel}. Post kind: ${kind}.`,
        ``,
        `Read the payload in the run directory (plan.out.json + narration.out.json, task.out.json,`,
        `or story.out.json — whichever exists) and write ${rel}/caption.out.json in the schema from`,
        `your brief. Use the caption-and-hashtags skill for the method.`,
        ``,
        `Niche: mathematics, short-form, a mascot ("Axi") who teaches one idea per post. Voice:`,
        `plain, warm, a teacher to one person; no hype words. Handle: math with Axi.`,
        ``,
        `Hard rules: nothing the payload does not say; a task's answer ONLY in first_comment;`,
        `first line under twelve words and never the method's name; one CTA.`,
      ].join('\n'),
    });
  } catch (err) {
    log(`  caption agent failed: ${String(err.message).slice(0, 200)}`);
    return null;
  }
  const file = path.join(dir, 'caption.out.json');
  if (!fs.existsSync(file)) { log('  caption agent wrote nothing'); return null; }
  try {
    const c = readJson(file);
    // Minimal shape check; a half-written caption is worse than the fallback.
    if (!c.instagram?.caption || !c.tiktok?.caption || !c.youtube?.title) {
      log('  caption.out.json is missing required fields; using fallback copy');
      return null;
    }
    return c;
  } catch (err) {
    log(`  caption.out.json unreadable: ${err.message}`);
    return null;
  }
}

function readOutcome(dir) {
  const f = path.join(dir, 'outcome.json');
  return fs.existsSync(f) ? readJson(f) : 'no outcome.json written';
}

/** The three posts a daily run produces, keyed by the names WORKER_POSTS accepts. */
export const PRODUCERS = {
  lesson: (opts) => generateLesson(opts),
  task20: (opts) => generateTask(20, opts),
  task40: (opts) => generateTask(40, opts),
  story: (opts) => generateStory(opts),
};
