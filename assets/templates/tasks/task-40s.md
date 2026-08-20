# Prompt template — daily task, 40-second timer

Typed prompt for one Instagram post: a single mathematics puzzle with a 40-second countdown.
Self-contained. The 20-second variant lives in `task-20s.md`; it is a **different brief**, not
this one with a number changed — the difficulty design, the category pool and the statement
budget all differ.

Reference mockups: `daily_task.png` (base state) and `daily_task_hurry.png` (hurry state).
Every measurement below was taken from those files and is authoritative.

---

## 1. Output contract

Emit exactly this object. Every field is required; a field you cannot fill is `null` with an
entry in `nulls[]` — never an invented value.

```jsonc
{
  "task_id":        "string",        // slug, kebab-case, derived from the structure
  "duration_s":     40,              // fixed for this template
  "structure_id":   "string",        // the SHAPE of the puzzle, not its numbers.
                                     // e.g. "two-var-system-symmetric",
                                     // "nested-radical-collapse", "work-rate-two-agents"
  "categories":     ["string"],      // 1-2 from §4
  "description":    "string | null", // English, shown at the top of the card.
                                     // null -> the card renders "Answer in the comments"
  "statement":      "string",        // the puzzle AS RENDERED inside the ring. Plain text or
                                     // LaTeX (see §5.4). Must fit; see the hard limit in §5.4
  "statement_latex": "string | null",
  "answer":         "string",        // exact. "17", "3/4", "2\\sqrt{5}". No decimals unless exact
  "answer_latex":   "string | null",
  "solution_sketch": "string",       // 2-4 sentences, English. NOT rendered
  "difficulty_rationale": "string",  // why this needs 40s and not 20s. See §3
  "steps_expected": 2,               // 2 or 3 — the number of real steps after the insight
  "check_script":   "string",        // path to your SymPy script, see §6
  "nulls":          [{"field": "...", "reason": "..."}]
}
```

Write it to `<run>/task.out.json`.

---

## 2. Deduplication — do this first

```bash
node core/pipeline/lib/tasks-ledger.mjs candidates '<structure_id>' '<category,category>' 40
```

| rule | effect |
|---|---|
| `statement_norm` already in the ledger | hard reject, any duration |
| same `structure_id` within the last **10** shipped 40s tasks | reject, pick another shape |
| same primary category within the last **3** shipped 40s tasks | reject, rotate |

Changing operands is not a new task. `x + y = 10, xy = 21` and `x + y = 12, xy = 35` are the same
puzzle. If the shape is in the ledger, change the shape.

**Cross-duration check.** A 40s puzzle must not be a 20s puzzle with bigger numbers. The ledger
compares `structure_id` across both durations for exactly this reason: inflating the arithmetic
of an easy shape produces a boring task, not a harder one.

After five rejected candidates, emit `{"status": "no_task", "tried": [...]}` and stop.

---

## 3. Difficulty target

**An average adult, no paper, must be able to finish in under 40 seconds — and must need
noticeably more than 20.**

The 40-second band is not "the same puzzle, more arithmetic". It is **two or three genuine
steps**, or one insight that takes real searching to find. Bigger numbers are the wrong lever and
make the post worse.

| | example | verdict |
|---|---|---|
| Belongs in the 20s template | `47² − 43² = ?` | one insight, one multiplication. |
| Wrong kind of harder | `4783² − 4779² = ?` | same insight, punishing arithmetic. Rejected. |
| Right | `x + y = 10, xy = 21. Find x² + y²` | insight (`x²+y² = (x+y)² − 2xy`), then two steps: 100 − 42. |
| Right | `√(7 + 4√3) = ?` | recognise the nested radical as `(2 + √3)²`. Real search, clean payoff. |
| Right | `Remainder of 7^100 mod 5` | find the cycle, then reduce the exponent. Two steps. |
| Too hard | anything needing written algebra, a system of three unknowns, or calculus | rejected. |

Rules:

- **Two or three steps after the insight.** Record which in `steps_expected`.
- **Each step must be mentally cheap.** The difficulty is in seeing the route, never in executing it.
- **The answer must be clean** — integer, small fraction, or simple surd. If the honest answer is
  ugly, the puzzle is wrong. Do not round it into looking clean.
- **No recall-only puzzles.** If solving it requires having memorised a named identity, it is
  trivia. The identity must be derivable in the moment or genuinely common knowledge.
- **A solver who spots the trick immediately should still need ~15 s.** If the trick collapses the
  whole thing to one line, it belongs in the 20s template.

Write `difficulty_rationale` as: the naive route and its cost, the insight, the steps after it,
and why 20 seconds is not enough.

---

## 4. Categories — the area is ASSIGNED, not chosen

**The run tells you which area to use.** Your first category must be that one.

Assigned rather than chosen because free choice does not produce variety: an agent picks the most
prototypical example of "hard maths puzzle" every time, and a recency rule over the last three is
too weak to stop it. The area comes from whichever pool position has gone longest without use,
computed in `core/pipeline/lib/rotation.mjs`.

You still choose the idea, the numbers and the framing — just not the subject.

The 40-second pool, deliberately disjoint from the 20-second one:

| | area | what lives there |
|---|---|---|
| 1 | `logarithm-exponent` | index and log laws, change of base, comparing sizes |
| 2 | `modular-arithmetic` | remainder cycles, last digit of a power, divisibility proofs |
| 3 | `telescoping` | sums and products that cancel |
| 4 | `work-rate` | combined rates, pipes and tanks, meeting problems |
| 5 | `weighted-average` | mixtures, alligation, average speed (the harmonic-mean trap) |
| 6 | `trigonometric-identity` | exact values, angle-sum identities, no calculator |
| 7 | `inequality` | AM–GM, bounding, which of two expressions is larger |
| 8 | `series-sum` | finite sums with a closed form, geometric series |
| 9 | `digit-puzzle` | reconstruct digits from constraints |
| 10 | `number-base` | binary/other bases, base conversion tricks |
| 11 | `combinatorics` | arrangements, selections, complementary counting |
| 12 | `geometry-mental` | area or perimeter from a relation, similar triangles, no construction |
| 13 | `functional-pattern` | `f(f(x))`, recursive definitions with a short cycle |
| 14 | `system-of-equations` | two unknowns, symmetric functions, elimination |
| 15 | `quadratic-structure` | Vieta, completing the square, disguised quadratics |
| 16 | `nested-radical` | surds that collapse, denesting, rationalising |

Fall back to another area only if the assigned one genuinely cannot carry a puzzle at this
difficulty — and say so in your report, naming what you used instead and why.

**Structural variety beats category variety.** Two `modular-arithmetic` puzzles with genuinely
different mechanisms beat a `modular-arithmetic` and a `telescoping` that both reduce to "spot
the cycle".

### Sourcing

Author every puzzle yourself. `core/docs/source-assessment.md` applies unchanged: **Project Euler
is CC BY-NC-SA — do not use it, not even as a seed.** Public-domain elementary mathematics,
standard competition folklore, and classical identities are fine; you are writing the expression
of them from scratch.

---

## 5. Render specification

Design units are **720 × 1280**. The renderer captures at `deviceScaleFactor: 1.5` and outputs
**1080 × 1920**, 30 fps. All coordinates below are design units.

### 5.1 Background

Random pick from `assets/images/bg/`, seeded and recorded. `object-fit: cover`, centred — the
2048×2048 source is cropped evenly to 9:16. No scrim. Blur applies at phase B only.

### 5.2 Card

| property | value |
|---|---|
| box | x 54, y 120, w 612, h 1050 |
| radius | 40 |
| fill | `#FFFFFF` |
| border | 5 px `#000000` |

### 5.3 Title (description)

| property | value |
|---|---|
| font | Inter **ExtraBold** (800), 40 px |
| colour | `#000000` |
| alignment | centred on x = 360 |
| block top | y = 245 |
| line height | 47 px |
| max width | 500 px |
| max lines | 3 |
| fallback | `Answer in the comments` when `description` is null |

A 40-second puzzle more often needs a real description — "Find x² + y²" does not fit inside the
ring alongside the givens. Use the title for the *question*, the ring for the *givens*.

### 5.4 Ring and statement

| property | value |
|---|---|
| centre | (360, 675) |
| outer radius | 264 |
| stroke width | 66 |
| inner radius | 198 |
| track colour | `#D1C5C0` |
| accent colour | `#1E76C3` |
| line cap | round |
| glow | `drop-shadow(0 0 18px rgba(30,118,195,0.45))` on the accent arc only |
| direction | **countdown** — starts as a full circle, depletes clockwise from 12 o'clock |

> The mockup's track reads `#EFEFEF`, not `#D1C5C0`. The specified value wins.

**The statement lives inside the ring and must not touch it.**

- centred on (360, 675), colour `#1E76C3`, weight 700
- safe area: circle of radius **176** (inner 198 minus 22 px padding), inscribed box **248 × 248**
- font size auto-fits downward from 56 px in 2 px steps until the bounding box fits
- **if it does not fit at 28 px, the task is rejected**. Do not overflow, clip, or shrink further.
- a 40-second puzzle often has two givens; render them on two lines inside the ring, or move the
  question to the title and keep only the givens in the ring. Two short lines read far better
  than one long one squeezed to 28 px.

### 5.5 Footer

| element | value |
|---|---|
| mascot still | box x 174, y 997, w 86, h 132, `object-fit: contain`, bottom-aligned |
| wordmark | `math with Axi`, Inter SemiBold (600) 36 px, `#000000`, left x = 324, baseline y = 1074 |

The mascot still is the **last frame of the keyed `mas_chromo`**, so the intro animation lands on
exactly the image the footer shows.

### 5.6 Hurry overlay

| property | value |
|---|---|
| box | x 224, y 752, w 270, h 270 |
| source | random clip from `assets/video/hurry/`, **overlaid as-is**, looped if shorter than the audio |
| enter | scale 0.6 → 1.0, opacity 0 → 1, 11 frames, ease-out |
| exit | scale 1.0 → 0.6, opacity 1 → 0, 11 frames, ease-in |

`hurry/dumdum.webm` is excluded from the random pool: its alpha deliberately carries a translucent
sheet of formulas behind the subject, which over the white card reads as a smudge rather than a
sticker. Usable pool: `hurry.webm`, `hurry5.webm`, `hurry6.webm`, `papapa.webm`, `witchcat.webm`.

### 5.7 Alpha — the two rules that keep subjects opaque

Both were learned by shipping a post where the mascot and the hurry cat were visibly see-through.

**1. Never key a clip that already has alpha. Overlay it as-is.**

Every clip in `assets/video/hurry/` is already matted. Running a key over an existing matte eats
what the artist cut and leaves the subject translucent.

Detection must use the **`alpha_mode` tag**, never `pix_fmt`:

```bash
ffprobe -v error -select_streams v:0 -show_entries stream_tags=alpha_mode \
        -of default=nk=1:nw=1 clip.webm     # "1" means it already has alpha
```

A VP9 alpha WebM stores its alpha in a separate layer, so `pix_fmt` still reports `yuv420p`. A
pix_fmt check says "no alpha" about a file that has one. `tools/chromakey.mjs` detects this and
prints `already has alpha, passed through unkeyed`.

**2. Harden the alpha of anything that IS keyed.**

`chromakey`'s `blend` produces an alpha *gradient across the whole subject*, not just its edge. On
`mas_chromo` that left only 9 % of the frame fully opaque against ~16 % of actual subject — barely
half the mascot was solid, and over the white card it read as a ghost.

The fix is a curve applied after the key, in `rgba` so alpha is not chroma-subsampled first:

```
a' = clip((a - 40) * 255 / 60, 0, 255)
```

Below 40 → fully transparent, 100 and above → fully opaque, the band between is the soft edge.
Semi-transparent pixels drop from 4.6 % of the frame to 0.1 %. `tools/chromakey.mjs` applies this
by default and reports `hardened=true`; `--alpha-floor` and `--alpha-width` tune it, `--no-harden`
disables it.

**Check previews against white, not against a dark ground.** A translucent subject is invisible
on dark and obvious on white, and white is what these clips actually sit on.

### 5.8 Fonts

Inter, vendored via `@fontsource/inter` — never the system font, or the capture becomes
machine-dependent and frame determinism is gone.

---

## 6. Timeline — 30 fps

| phase | frames | seconds | what happens |
|---|---|---|---|
| **A** card in | 0 – 11 | 0.00 – 0.40 | Card scales 0.85 → 1.00 and fades in from centre over the blurred background. Title, ring track and statement are legible almost immediately. A random `assets/audio/start_audio/*.mp3` plays from frame 0. |
| **B** timer | 12 – 1211 | 0.40 – 40.40 | 40.0 s countdown. Accent arc depletes to zero. |
| **C** hold | 1212 – 1226 | — | Empty ring, statement still readable. Cut. |

**Total: 1227 frames, 40.90 s.**

> There is NO mascot intro. The post opens on the card, with the puzzle legible in the first
> frame, and the greeting is audio over it. A mascot waving does not earn the opening seconds of
> a short-form post; the problem does. The mascot still sits in the card footer.

### Ticking

`assets/audio/sfx/tick.wav` at frames **12 + 30k** for k = 0…39 — forty ticks, one per second of
the countdown. No tick on the final frame.

### Hurry window

Entry frame is drawn from **60–80 % of the timer**, seeded and recorded:

```
enter = 12 + round(1200 × u),  u ~ Uniform(0.60, 0.80)     
```

At `enter`: the hurry overlay scales in (§5.6) **and** a random `assets/audio/mid_audio/*.mp3`
starts. When that audio ends (`enter + round(duration × 30)`), the overlay scales out.

mid_audio runs 0.68–2.19 s, so the overlay is on screen for roughly 1–3 s and clears well before
the countdown ends.

---

## 7. Correctness gates

The lesson pipeline's rules apply with two deliberate changes, because a puzzle is not a technique.

**§3.1 independent verification — applies, unchanged.** Write a SymPy script that computes the
answer from the statement. The verifier writes its own, blind, and the orchestrator runs both.
Any disagreement fails the task. The text is not edited to match the code and the code is not
edited to match the text.

For a multi-step puzzle, verify the **final answer from the original givens**, not from your
intermediate values. A script that re-walks your own steps will reproduce your own mistake.

Your script prints one line of JSON:

```json
{"task_id": "...", "computed": "<value>", "agrees": true}
```

**§3.2 applicability and counterexample — waived.** A one-off puzzle has no applicability
condition. Requiring one would produce filler. Scoped to this template only.

**§3.3 no gap-filling — applies, unchanged.** Missing information is `null` plus a reason.

**§3.4 random operands — replaced.** For a lesson, hand-picked numbers hide a broken technique.
For a puzzle the numbers *are* the design. The ledger rules in §2 replace it: they are what stop
the same puzzle shipping twice in new clothes.

---

## 8. Output

| what | where |
|---|---|
| video | `output/posts/tasks/40s/<task_id>.mp4` |
| ledger entry | `core/content/tasks-ledger.json` |
| run artifacts | `core/out/runs/<run-id>/` |

The video is written **only** when verification passed and the statement fits the ring. Both are
hard conditions in the orchestration script, not judgement calls.
