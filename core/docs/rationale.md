# Directory layout and why it is shaped this way

```
math.push/
├── assets/                     mascot and audio source material (pre-existing, untouched)
│   ├── audio/                  hand-authored narration + stings
│   ├── images/                 mascot stills, RGBA
│   └── video/                  mascot clips — none carry alpha, see below
├── .claude/
│   ├── agents/                 generated from core/agents/ by tools/sync-agents.mjs
│   └── skills/                 ui-ux-pro-max + design-taste-frontend
├── .agents/skills/             skills-cli install root; Claude Code symlinks into it
└── core/                       everything this pipeline is
    ├── agents/                 THE agent definitions (source of truth) + ISOLATION.md
    ├── pipeline/
    │   ├── orchestrate.mjs     the render gate lives here and only here
    │   ├── stages/             generate · verify · edit · capture · render
    │   └── lib/                ledger · payload · sampling · sympy · theorems · agent-runner
    ├── schema/                 lesson.schema.TODO.md — deliberately empty this session
    ├── content/
    │   ├── ledger.json         topic ledger, dedup source of truth
    │   └── lessons/            shipped lesson payloads
    ├── verify/theorems.json    whitelist for §3.2 universality citations
    ├── web/                    the lesson page — React + Vite + KaTeX, captured by Playwright
    ├── video/                  the Remotion project; public/ is what staticFile() sees
    ├── tools/                  verify-env · probe-assets · chromakey · sync-agents
    ├── docs/                   this file + source-assessment.md
    └── out/                    runs/ captures/ renders/ logs/ — all generated, all gitignored
```

## Why `core/` holds data as well as code

The brief says implement everything in `core/`, and `content/ledger.json` is named relative to
nothing in particular. Ledger and lesson payloads live under `core/` because they are pipeline
state, not user media: they are written by the pipeline, read by the pipeline, and meaningless
without it. `assets/` stays at the repository root because it is human-authored input that
predates the pipeline and survives a rewrite of it.

## Why the agent definitions live in `core/agents/` and are copied to `.claude/agents/`

Claude Code loads subagents from `.claude/agents/`. But the agent definitions *are* pipeline
source — they encode §3.1 through §3.4 in prose, and they change together with the code that
enforces those rules. Splitting them across two trees would mean reviewing a rule change in two
places. So the definitions live next to the code and `tools/sync-agents.mjs` copies them one
direction, with a generated-file marker so nobody edits the copy.

## Why the render gate is in exactly one file

§3.5 requires that Playwright and Remotion run only when verification passed and the Editor did
not block. That condition appears once, in `pipeline/orchestrate.mjs`, as two `if` statements
with a `return` — no override flag, no `--force`, no "warn and continue".

The stages downstream deliberately do **not** re-check it. A stage that re-checks the gate invites
someone to weaken the gate ("it's checked later anyway"), and a gate checked in four places is a
gate with four places to get it wrong.

## Why `lib/` is CLI-callable

`ledger.mjs`, `sampling.mjs` and `theorems.mjs` each have a small `main` block. The Generator
runs them as commands rather than reimplementing dedup or seeded sampling in prose. An agent that
computes its own dedup will eventually compute it charitably; an agent that shells out to a
deterministic script cannot.

## Why capture is a PNG sequence, not a video

Playwright captures the lesson page frame by frame and Remotion composes those frames. Two
consequences worth stating:

- **Timing belongs to one system.** If Playwright produced a video, it would encode its own
  frame timing and Remotion would have to conform to it. A PNG sequence has no opinion about time.
- **Every frame is inspectable.** When a lesson looks wrong, the failing frame is a file on disk,
  not a seek offset into a container.

The cost is disk and a slower capture stage. At 45 seconds × 30 fps that is ~1350 PNGs per run,
which is fine at this volume and would need revisiting at a hundred runs a day.

## Why the page is frame-driven and not time-driven

`web/src/capture-contract.ts` forbids `setTimeout`, CSS transitions, and rAF loops in the lesson.
Every visual is a pure function of the frame index, driven by `window.__axiSeek(frame)`.

A time-driven page renders differently depending on how fast the capture loop happens to run,
which means the same lesson produces a different video on a different machine, or on the same
machine under load. `styles.css` enforces this with a blanket `transition: none !important`.

## Why KaTeX and not MathJax

KaTeX renders synchronously. In a capture loop an async typesetter produces screenshots that land
before typesetting finishes — intermittently, on whichever frames happen to lose the race. §4.3
of the brief calls this out and it is correct.

`@vuepress/plugin-markdown-math` from the original brief is **not installed**. It is a VuePress
plugin, and these lessons are React components consumed by a React renderer. `katex.renderToString()`
is called directly in `web/src/Math.tsx`. If lessons ever become Markdown in a VuePress site, that
decision changes; today it would add a static-site generator to a project that has no site.

MathJax is not installed either. If some construct falls outside KaTeX's LaTeX subset, add it as
an **offline** pre-render step producing static SVG — never as a second runtime typesetter.

## Why the mascot is keyed ahead of time

None of the clips in `assets/video/` carry an alpha channel — they are `yuv420p`, including the
WebMs, where VP9 alpha would appear as `yuva420p`. The brief assumed pre-rendered alpha sources;
they do not exist yet.

`tools/chromakey.mjs` produces alpha WebMs as a build step rather than keying at render time, for
two reasons: the matte is a file you can look at before it reaches a video, and the render stage
stays a plain composite with nothing to tune. It samples the key colour from the first frame's
corner instead of assuming green, because assuming green on a clip that is not green-screened
produces a confidently wrong matte.

## Why there are no new MCP servers

§4.4 asks for a minimal set with justification. The justified set is empty:

- **Filesystem** — Claude Code has native file tools. An MCP server would add a hop.
- **Ledger persistence** — the ledger is `content/ledger.json`, by the brief's own naming. A few
  thousand entries of a few hundred bytes is a file, and a file shows up in a diff during review.
  A database would hide topic-history changes from code review, which is where they belong.
- **Playwright** — driven directly from Node in `stages/capture.mjs`. Routing it through MCP
  would put a model in a loop that must be deterministic.

The one server already connected that *could* earn a place is `pollinations` (TTS, image
generation). It is not wired in: narration is hand-authored for this project, so there is nothing
for it to do yet.
