#!/usr/bin/env node
/**
 * End-to-end plumbing check with a fixture lesson and no agents.
 *
 * Proves the machinery works — sampler replay, scope check, SymPy cross-check, Playwright
 * capture, Remotion render — without spending three agent invocations. It uses a hand-written
 * fixture, which is exactly what §3.4 forbids in real content; that is fine here because nothing
 * this produces is publishable and the fixture never touches the ledger.
 *
 *   node core/tools/smoke.mjs            # capture only (fast)
 *   node core/tools/smoke.mjs --render   # capture + Remotion render
 */
import fs from 'node:fs';
import path from 'node:path';
import { capture } from '../pipeline/stages/capture.mjs';
import { render } from '../pipeline/stages/render.mjs';
import { crossCheckAll } from '../pipeline/lib/sympy.mjs';
import { checkScope } from '../pipeline/lib/theorems.mjs';
import { verifyDraw, draw } from '../pipeline/lib/sampling.mjs';
import { projectForVerifier, frozenHash } from '../pipeline/lib/payload.mjs';
import { CORE, OUT } from '../pipeline/lib/paths.mjs';

const FRAMES = Number(process.env.SMOKE_FRAMES ?? 12);
const doRender = process.argv.includes('--render');

const runId = 'smoke';
const dir = path.join(OUT, 'runs', runId);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(path.join(dir, 'generator.checks'), { recursive: true });
fs.mkdirSync(path.join(dir, 'verifier.checks'), { recursive: true });
const run = { id: runId, dir, request: {}, started_at: new Date().toISOString() };

// --- fixture lesson --------------------------------------------------------
const sampling = draw(20260815, { min: 100, max: 9999, filter: { max_digits: 4, nonzero: true } }, 2);
const [a, b] = sampling.draws;

const lesson = {
  lesson_id: 'smoke-1',
  concept_slug: 'smoke-difference-of-squares',
  tags: ['algebra', 'identities'],
  title: 'Разность квадратов',
  language: 'ru',
  method: 'Чтобы перемножить два числа, симметричных относительно круглого n, считай n² − d².',
  mechanism: '(n − d)(n + d) = n² − d², потому что перекрёстные члены сокращаются.',
  claims: [{ claim_id: 'c1', statement: `${a}*${b}`, formula: '(n-d)(n+d) = n^2 - d^2', value: String(a * b) }],
  examples: [{
    claim_id: 'c1',
    operands: [a, b],
    steps: [{ tex: `n = ${(a + b) / 2},\\; d = ${Math.abs(a - b) / 2}` }, { tex: `n^2 - d^2` }],
    result: String(a * b),
    result_tex: `${a} \\cdot ${b} = ${a * b}`,
  }],
  sampling,
  applicability: { condition: 'Работает для любых a, b; выгодно, когда (a+b)/2 — круглое.', formal: 'a, b \\in \\mathbb{Z}' },
  counterexample: null,
  universality: {
    kind: 'theorem',
    theorem_id: 'difference-of-squares',
    hypothesis_mapping: { 'a, b in a commutative ring': 'a и b — целые числа, ℤ коммутативно' },
  },
  nulls: [{ field: 'counterexample', reason: 'universal identity; supported by whitelisted theorem difference-of-squares' }],
};

// --- gates -----------------------------------------------------------------
const results = {};
results.sampling_replay = verifyDraw(lesson.sampling).ok;
results.scope = checkScope(lesson);
results.isolation_projection = Object.keys(projectForVerifier(lesson)).length;
results.frozen_hash = frozenHash(lesson).slice(0, 12);

// --- two independent SymPy scripts ----------------------------------------
const genScript = path.join(dir, 'generator.checks', 'c1.py');
const verScript = path.join(dir, 'verifier.checks', 'c1.py');
fs.writeFileSync(genScript, `import json, sympy
n, d = sympy.Integer(${(a + b) / 2}), sympy.Integer(${Math.abs(a - b) / 2})
computed = n**2 - d**2
print(json.dumps({"claim_id": "c1", "computed": str(computed), "agrees": computed == ${a * b}}))
`);
fs.writeFileSync(verScript, `import json, sympy
computed = sympy.Integer(${a}) * sympy.Integer(${b})
print(json.dumps({"claim_id": "c1", "computed": str(computed), "agrees": computed == ${a * b}}))
`);
results.cross_check = await crossCheckAll([
  { claim_id: 'c1', generator_script: genScript, verifier_script: verScript },
]);

console.log('operands            ', a, b);
console.log('sampling replays    ', results.sampling_replay);
console.log('scope               ', results.scope.ok, `(${results.scope.kind})`, results.scope.problems);
console.log('verifier sees fields', results.isolation_projection);
console.log('frozen hash         ', results.frozen_hash);
console.log('sympy cross-check   ', results.cross_check.passed,
  '| gen:', results.cross_check.results[0].generator.computed,
  '| ver:', results.cross_check.results[0].verifier.computed);

if (!results.cross_check.passed) {
  console.error('cross-check failed:', JSON.stringify(results.cross_check, null, 2));
  process.exit(1);
}

// --- capture ---------------------------------------------------------------
const shot = await capture(run, lesson, { frames: FRAMES });
console.log('capture             ', shot.frames, 'frames →', path.relative(CORE, shot.dir));

if (doRender) {
  const mascotFile = path.join(CORE, 'video', 'mascot.json');
  const mascot = fs.existsSync(mascotFile) ? JSON.parse(fs.readFileSync(mascotFile, 'utf8')) : null;
  const video = await render(run, {
    capture: shot,
    budget: { mode: 'estimated' },
    mascot: mascot?.src ? mascot : null,
  });
  console.log('render              ', path.relative(CORE, video.file));
}

console.log('\n✓ smoke passed');
