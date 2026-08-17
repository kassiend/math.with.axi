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
import { projectTask, projectLesson, writeVerifierBox, withheldFrom } from '../pipeline/lib/projection.mjs';

const CLAUDE = () => resolveBin('claude');
const AGENT_TIMEOUT_MS = 25 * 60 * 1000;

export class GateClosed extends Error {
  constructor(stage, detail) { super(`gate closed at ${stage}`); this.stage = stage; this.detail = detail; }
}

/**
 * Spawn an agent. The prompt goes in on stdin rather than argv: prompts are long, contain
 * newlines and quotes, and under a Windows shell an argv prompt is re-parsed by cmd.
 */
function runAgent({ agent, prompt, cwd, allowedTools, log }) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--agent', agent];
    if (allowedTools?.length) args.push('--allowedTools', allowedTools.join(' '));

    const child = spawnTool(CLAUDE(), args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${agent} timed out after ${AGENT_TIMEOUT_MS / 60000} minutes`));
    }, AGENT_TIMEOUT_MS);

    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      log?.(`  ${agent} exited ${code}`);
      if (code !== 0) return reject(new Error(`${agent} exited ${code}: ${err.slice(-500)}`));
      resolve(out);
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
  log(`  run dir: ${path.relative(ROOT, dir)}`);

  await runAgent({
    agent: 'axi-task-generator',
    cwd: ROOT,
    allowedTools: ['Read', 'Write', 'Glob', 'Grep', 'Bash'],
    log,
    prompt: [
      `Read ${brief} in full — it is your brief for this run.`,
      ``,
      `Run directory: ${path.relative(ROOT, dir)}`,
      ``,
      `Produce ONE puzzle with a ${durationS}-second timer.`,
      ``,
      `Deduplicate FIRST against core/content/tasks-ledger.json using the CLI in your brief.`,
      `Shapes already shipped are blocked, including across the other duration.`,
      ``,
      `The statement renders inside the countdown ring: safe box ~249x249 design px, auto-fit`,
      `floor 28px. Keep it short. If it needs two givens, put the question in "description" and`,
      `only the givens in "statement".`,
      ``,
      `Write ${path.relative(ROOT, dir)}/task.out.json and`,
      `${path.relative(ROOT, dir)}/generator.checks/<task_id>.py, run the check with the venv`,
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

  await runAgent({
    agent: 'axi-verifier',
    cwd: box,
    allowedTools: ['Read', 'Write', 'Bash'],
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
    kind: `task${durationS}`, video, runDir: dir,
    meta: { id: task.task_id, statement: task.statement, answer: task.answer, structure: task.structure_id },
  };
}

// ---------------------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------------------

export async function generateLesson({ log = console.log } = {}) {
  const dir = freshRunDir('lesson');
  const rel = path.relative(ROOT, dir);
  fs.mkdirSync(path.join(dir, 'audio'), { recursive: true });
  log(`  run dir: ${rel}`);

  const seed = Number(BigInt(Date.now()) % 2147483647n);

  await runAgent({
    agent: 'axi-lesson-planner',
    cwd: ROOT,
    allowedTools: ['Read', 'Write', 'Glob', 'Grep', 'Bash'],
    log,
    prompt: [
      `Read assets/templates/lesson/lesson.md in full — it is the brief.`,
      ``,
      `Run directory: ${rel}`,
      ``,
      `Deduplicate against core/content/ledger.json FIRST. Anything already shipped is blocked,`,
      `and so is a paraphrase of it — match on concept, not wording.`,
      ``,
      `Read the counter from the ledger: one more than the highest already shipped.`,
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
      `Write ${rel}/plan.out.json, then write ${rel}/generator.checks/<lesson_id>.py confirming the`,
      `worked example and any universality claim, run it, and report what it printed.`,
    ].join('\n'),
  });

  const planFile = path.join(dir, 'plan.out.json');
  if (!fs.existsSync(planFile)) throw new GateClosed('planner', 'no plan.out.json produced');
  const plan = readJson(planFile);
  if (plan.status === 'no_topic') throw new GateClosed('dedup', plan);

  await runAgent({
    agent: 'axi-lesson-narrator',
    cwd: ROOT,
    allowedTools: ['Read', 'Write', 'Bash'],
    log,
    prompt: [
      `Read assets/templates/lesson/lesson.md in full — it is the brief.`,
      ``,
      `Run directory: ${rel}`,
      `Read ${rel}/plan.out.json. It is your only input about what is taught. Change no number,`,
      `formula, step order, counter or applicability.`,
      ``,
      `Write two parallel scripts: spoken narration with eleven_v3 emotion tags, and the display`,
      `copy, which is the instruction/working lines from the plan used as-is.`,
      ``,
      `Synthesize one clip per step plus one for the intro with the existing tool. Do not hand-roll`,
      `HTTP and never print the API key:`,
      `  node core/tools/elevenlabs.mjs say --text "<narration>" --out ${rel}/audio/intro.mp3`,
      `  node core/tools/elevenlabs.mjs say --text "<narration>" --out ${rel}/audio/s1.mp3`,
      `It caches by text hash, measures duration with ffprobe and prints JSON. Use the printed`,
      `"seconds" values verbatim.`,
      ``,
      `Budget: the whole post must land under 60 seconds including a ~5.1s intro clip and ~1.3s of`,
      `transitions. Speech runs roughly 12 characters per second. Aim for 30-40 seconds of speech.`,
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

  await runAgent({
    agent: 'axi-verifier',
    cwd: box,
    allowedTools: ['Read', 'Write', 'Bash'],
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

function readOutcome(dir) {
  const f = path.join(dir, 'outcome.json');
  return fs.existsSync(f) ? readJson(f) : 'no outcome.json written';
}

/** The three posts a daily run produces, keyed by the names WORKER_POSTS accepts. */
export const PRODUCERS = {
  lesson: (opts) => generateLesson(opts),
  task20: (opts) => generateTask(20, opts),
  task40: (opts) => generateTask(40, opts),
};
