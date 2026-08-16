# math.with.axi — core

An automated content factory. Each run produces one finished 9:16 video in which a Pixar-style
mascot ("Axi") teaches a single mathematical idea, method, or trick.

The editorial rule underneath everything: **explain the approach, not just the answer.** A result
without the reasoning that produces it does not ship — the pipeline rejects it before render.

---

## Pipeline

```
  request.json
       │
       ▼
  ┌─────────────┐   payload    ┌──────────────┐   verdict   ┌────────────┐
  │ A Generator │ ───────────► │ B Verifier   │ ──────────► │ C Editor   │
  │  topic      │   allowlist  │  independent │             │  trim to   │
  │  dedup      │   filtered   │  SymPy check │             │  runtime   │
  │  explanation│              │  no prompt   │             │  no maths  │
  └─────────────┘              └──────────────┘             └────────────┘
       │                              │                            │
       │  generator check .py         │  verifier check .py        │
       └──────────────┬───────────────┘                            │
                      ▼                                            │
              cross-check (both must agree)                        │
                      │                                            │
                      ▼                                            ▼
              ╔═══════════════════════════════════════════════════════╗
              ║  RENDER GATE  —  verification passed AND not blocked   ║
              ╚═══════════════════════════════════════════════════════╝
                                      │
                          ┌───────────┴───────────┐
                          ▼                       ▼
                 Playwright capture        Remotion compose
                 PNG sequence              + mascot + audio → mp4
                                      │
                                      ▼
                              content/ledger.json
```

Three agents, three separate `claude -p` processes, no shared context. See
[`agents/ISOLATION.md`](agents/ISOLATION.md) for what enforces that and why it matters.

---

## Setup

Prerequisites: Node ≥ 20 (tested on 24.15.0), Python 3.x, ffmpeg/ffprobe, the Claude Code CLI.

```bash
cd core
npm install
python3 -m venv .venv && ./.venv/bin/pip install sympy
npx playwright install chromium
node tools/sync-agents.mjs      # core/agents/*.md → .claude/agents/
npm run verify:env              # checks every dependency the pipeline shells out to
```

Design skills (installed at the repository root, one level up):

```bash
npm exec --yes -- ui-ux-pro-max-cli init --ai claude
npm exec --yes -- skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"
```

> `npx <pkg>` resolves to `npm` on this machine and fails with "Unknown command". Use
> `npm exec --yes -- <pkg>` for anything not already in `node_modules`.

---

## Running the pipeline

```bash
# 1. stage the background art and build the lesson page
npm run sync:backgrounds        # assets/images/bg/ → web/public/bg/
npm run web:build               # rebuild after any change under web/

# 2. key the mascot clips into alpha WebMs
npm run chromakey
open out/logs/chromakey-previews/     # look at these before trusting a matte
#    then set "src" in video/mascot.json to the keyed .webm you picked
#    findings and limits: docs/mascot-keying.md

# 3. run
npm run pipeline -- --request content/request.example.json

# gate-only rehearsal: agents run, nothing renders
npm run pipeline -- --request content/request.example.json --dry-run
```

Plumbing check with a fixture lesson and **no agents** — proves sampler replay, scope check, the
SymPy cross-check, Playwright capture and the Remotion render without spending three agent
invocations:

```bash
npm run smoke              # gates + capture
npm run smoke -- --render  # + Remotion render → out/renders/smoke.mp4
```

Exit codes:

| code | meaning |
|---|---|
| `0` | video rendered, ledger updated |
| `1` | infrastructure error — missing dependency, agent crash |
| `2` | **gate closed** — lesson failed, blocked, or deduped. Not a bug. The expected outcome for a lesson that should not ship. |

Everything from a run lands in `out/runs/<run-id>/`: the payloads, both sets of SymPy scripts,
`verify.summary.json`, `outcome.json`, and `run.log.jsonl`.

---

## The rules the code enforces

These are gates, not prompt suggestions. A model cannot talk past any of them.

**§3.1 — independent symbolic verification.** Two SymPy scripts per claim, written blind by two
agents that never saw each other's work, both executed by the orchestrator. If the code disagrees
with the text, the lesson is **failed** — the text is not edited to match the code, and the code
is not edited to match the text. A mismatch is a rejection, not a repair. There is no
fix-and-resubmit loop, on purpose: a Generator shown which check caught it learns to pass checks
rather than to be right. → `pipeline/lib/sympy.mjs`

**§3.2 — scope of every technique.** Every method states an applicability condition and a
counterexample. If neither a counterexample nor a proof of universality exists, the topic is
rejected; "seems to always work" is not shippable. For genuinely universal techniques, the only
accepted support is a whitelisted theorem from `verify/theorems.json` with an explicit hypothesis
mapping, or an exhaustive SymPy check over a domain that is stated, finite, and actually complete.
An agent naming a theorem from memory is still just an agent's assertion. → `pipeline/lib/theorems.mjs`

**§3.3 — no gap-filling.** A missing value is `null` plus a machine-readable reason, never an
invented value. This holds at the view layer too: `web/src/Lesson.tsx` renders an absent field as
a visible marker rather than filler copy. → `pipeline/lib/payload.mjs`

**§3.4 — numbers are not hand-picked.** Operands come from a seeded draw over a declared range.
A presentation filter may constrain only rendering properties (digit count, sign, zero), must be
declared before any draw is seen, and every rejection is recorded. The orchestrator replays the
declared seed and spec; if the reported operands are not what the sampler produces, the run fails.
→ `pipeline/lib/sampling.mjs`

**§3.5 — render gate.** Playwright and Remotion execute only when verification passed and the
Editor did not block. One condition, one file, no override flag. → `pipeline/orchestrate.mjs`

---

## Topic ledger

`content/ledger.json`. Every run appends an entry whatever the outcome.

Dedup matches on **normalised concept, not title string** — "Divisibility by 9" and "the digit-sum
rule for 9" collapse to the same key. The Generator queries it before proposing anything:

```bash
node pipeline/lib/ledger.mjs candidates 'digit-sum-divisibility-9' 'number-theory,divisibility'
node pipeline/lib/ledger.mjs list
```

Exact slug collision with a `shipped` entry blocks a topic outright. Tag overlap of two or more
returns near-misses, which the Generator judges semantically — a set intersection cannot decide
whether a viewer would learn anything new. `failed` entries do not block a retry, but three
failures on one slug close it.

---

## Layout, and why

See [`docs/rationale.md`](docs/rationale.md) — directory structure, why capture is a PNG sequence,
why the page is frame-driven, why KaTeX over MathJax, why no new MCP servers, why the mascot is
keyed ahead of time.

## Source material

See [`docs/source-assessment.md`](docs/source-assessment.md). Short version: Project Euler is
CC BY-NC-SA (NonCommercial + ShareAlike) and the content is the wrong shape — **not used**.
Open Problem Garden hosts unsolved problems that cannot satisfy §3.1 or §3.2 — **not used**.
Lean/Mathlib is Apache 2.0 and is a genuinely stronger verification backend than SymPy for §3.2
— **adopt in phase 2**, never as a topic source. Topics for v1 are self-authored from the public
domain of elementary mathematics.

---

## Known gaps

- **Lesson schema is undefined.** Deliberately out of scope for the bootstrap session. Placeholder
  and the decisions it will need: [`schema/lesson.schema.TODO.md`](schema/lesson.schema.TODO.md).
- **Mascot frame rate and length.** `mas_chromo.mp4` keys cleanly (real green screen) but is
  24 fps against a 30 fps timeline and only 5.06 s long — it needs looping, and a 24→30 pulldown
  can judder. Details: [`docs/mascot-keying.md`](docs/mascot-keying.md).
- **Visual design is scaffold-grade.** `web/src/styles.css` is a placeholder. The installed design
  skills are the tools for the real thing.
- **No publishing stage.** The pipeline produces a file. Getting it onto Instagram is manual.
