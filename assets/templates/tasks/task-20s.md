# Prompt template — daily task, 20-second timer

Typed prompt for one Instagram post: a single mathematics puzzle with a 20-second countdown.
Self-contained. The 40-second variant lives in `task-40s.md` and is **not** a parameter of this
one — the two differ in difficulty design, not only in a number.

Reference mockups: `daily_task.png` (base state) and `daily_task_hurry.png` (hurry state).
Every measurement below was taken from those files and is authoritative.

---

## 1. Output contract

Emit exactly this object. Every field is required; a field you cannot fill is `null` with an
entry in `nulls[]` — never an invented value.

```jsonc
{
  "task_id":        "string",        // slug, kebab-case, derived from the structure
  "duration_s":     20,              // fixed for this template
  "structure_id":   "string",        // the SHAPE of the puzzle, not its numbers.
                                     // e.g. "difference-of-squares-mental",
                                     // "percent-of-percent", "remainder-cycle-power"
  "categories":     ["string"],      // 1-2 from §4
  "description":    "string | null", // English, shown at the top of the card.
                                     // null -> the card renders "Answer in the comments"
  "statement":      "string",        // the puzzle AS RENDERED inside the ring. Plain text or
                                     // LaTeX (see §5.4). Must fit; see the hard limit in §5.4
  "statement_latex": "string | null",// LaTeX form if the plain form cannot express it
  "answer":         "string",        // exact. "17", "3/4", "2\\sqrt{5}". No decimals unless exact
  "answer_latex":   "string | null",
  "solution_sketch": "string",       // 1-3 sentences, English. NOT rendered. For the ledger and
                                     // for the caption you write by hand later
  "difficulty_rationale": "string",  // why this is hard-but-20s-solvable. See §3
  "check_script":   "string",        // path to your SymPy script, see §6
  "nulls":          [{"field": "...", "reason": "..."}]
}
```

Write it to `<run>/task.out.json`.

---

## 2. Deduplication — do this first

Query the ledger before inventing anything:

```bash
node core/pipeline/lib/tasks-ledger.mjs candidates '<structure_id>' '<category,category>' 20
```

Three rejection rules, all enforced in code:

| rule | effect |
|---|---|
| `statement_norm` already in the ledger | hard reject, any duration |
| same `structure_id` within the last **10** shipped 20s tasks | reject, pick another shape |
| same primary category within the last **3** shipped 20s tasks | reject, rotate |

The point of `structure_id` is that "12² − 8²" and "31² − 29²" are the *same puzzle* wearing
different numbers. Changing the operands is not a new task. If you find yourself reaching for a
shape you have seen in the ledger, the correct move is a different shape, not different digits.

After five rejected candidates, emit `{"status": "no_task", "tried": [...]}` and stop. An empty
result is acceptable. A near-duplicate is not.

---

## 3. Difficulty target

**An average adult, no paper, must be able to finish in under 20 seconds — and must not be able
to finish in two.**

That band is narrow and it is the entire craft of this format. Calibrate against these:

| | example | verdict |
|---|---|---|
| Too easy | `15 × 4 = ?` | one step, no insight. Rejected. |
| Right | `47² − 43² = ?` | looks like squaring two-digit numbers; is `(47−43)(47+43) = 4 × 90`. |
| Right | `What is 8% of 25?` | reversal trick: equals 25% of 8 = 2. |
| Too hard | `Solve x³ − 6x² + 11x − 6 = 0` | three roots, needs paper. Belongs in the 40s template. |

Rules that keep you in the band:

- **One idea.** At most two mechanical steps after the insight lands.
- **The insight must be findable, not recalled.** A puzzle that requires knowing an obscure
  identity is trivia, not a puzzle.
- **No large arithmetic.** Nothing that forces multi-digit long multiplication or division.
- **The answer must be clean** — an integer, a small fraction, or a simple surd. If the honest
  answer is `7.3846…`, the puzzle is wrong; do not round it into looking clean.
- **It must look harder than it is.** That gap is what makes someone stop scrolling.

Write `difficulty_rationale` as: what the naive route costs, what the insight is, and why the
insight is reachable cold in a few seconds.

---

## 4. Categories — the area is ASSIGNED, not chosen

**The run tells you which area to use.** Your first category must be that one.

This is assigned rather than chosen because free choice does not produce variety. An agent asked
to pick a category picks the most prototypical example of "maths trick" — multiplication
shortcuts and square roots — every single time, and a recency rule over the last three is far too
weak to stop it oscillating between two favourites forever. The area comes from whichever pool
position has gone longest without use, computed in `core/pipeline/lib/rotation.mjs`.

You still choose the idea, the numbers and the framing. You do not choose the subject, because
that is the one decision this pipeline has watched an agent get reliably wrong.

The 20-second pool:

| | area | what lives there |
|---|---|---|
| 1 | `percentage` | reversal (`a% of b = b% of a`), successive discounts |
| 2 | `divisibility-remainder` | digit rules, remainder cycles of powers |
| 3 | `logarithm` | `log` of a product, change of base, comparing two logs |
| 4 | `sequence` | next term, where the rule is structural rather than arithmetic |
| 5 | `fractions` | unit fractions, telescoping pairs |
| 6 | `clock-calendar` | angles between hands, weekday arithmetic |
| 7 | `counting` | small combinatorics, handshakes, pairs |
| 8 | `parity-argument` | odd/even reasoning that settles a question instantly |
| 9 | `ratio-proportion` | scaling, sharing, unit rates |
| 10 | `absolute-value` | `\|x − a\| = b`, distance-on-a-line reasoning |
| 11 | `linear-equation` | one unknown, a twist in the setup |
| 12 | `unit-conversion` | rates, speeds, compound units |
| 13 | `arithmetic-shortcut` | difference of squares, complements, doubling-halving |
| 14 | `powers-roots` | index laws, surds that simplify, negative indices |

Fall back to another area only if the assigned one genuinely cannot carry a puzzle at this
difficulty — and say so in your report, naming what you used instead and why.

**Structural variety matters more than category variety.** Two `arithmetic-shortcut` puzzles with
genuinely different mechanisms are better than an `arithmetic-shortcut` and a `percentage` that
both reduce to "spot the complement".

### Sourcing

Author every puzzle yourself. If you need inspiration, the constraint from
`core/docs/source-assessment.md` applies unchanged: **Project Euler is CC BY-NC-SA — do not use
it, not even as a seed.** Public-domain elementary mathematics, standard competition folklore,
and mental-arithmetic technique are all fine, because a mathematical fact is not copyrightable
and you are writing the expression of it from scratch.

---

## 5. Render specification

Design units are **720 × 1280**. The renderer captures at `deviceScaleFactor: 1.5` and outputs
**1080 × 1920**, 30 fps. All coordinates below are design units.

### 5.1 Background

Random pick from `assets/images/bg/` (currently 4 files), seeded and recorded in the run log.
`object-fit: cover`, centred — the source is 2048×2048 and the frame is 9:16, so it is cropped
evenly on both sides. No scrim.

The card is opaque white, so the background needs no darkening. Blur is applied at phase B only.

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

> The mockup's track reads `#EFEFEF`, not `#D1C5C0`. The specified value wins; if the render
> looks wrong against the mockup, that is why.

**The statement lives inside the ring and must not touch it.**

- centred on (360, 675), colour `#1E76C3`, weight 700
- safe area: a circle of radius **176** (inner radius 198 minus 22 px padding), i.e. an inscribed
  box of **248 × 248**
- font size auto-fits downward from 56 px in 2 px steps until the rendered bounding box fits the
  safe box
- **if it does not fit at 28 px, the task is rejected** — shorten the statement or pick another
  puzzle. Do not overflow the ring, do not clip, do not shrink further.
- keep the plain-text statement under ~22 characters where possible; that is what comfortably
  fits at a readable size

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

Inter, vendored via `@fontsource/inter` — never the system font. A system font makes the capture
machine-dependent, which breaks frame determinism.

---

## 6. Timeline — 30 fps

| phase | frames | seconds | what happens |
|---|---|---|---|
| **A** intro | 0 – 151 | 0.00 – 5.07 | `mas_chromo` keyed, full frame, over the random background. A random `assets/audio/start_audio/*.mp3` plays from frame 0 (they run 2.2–3.2 s and simply end; the intro continues silent). |
| **B** hand-off | 152 – 175 | 5.07 – 5.87 | The **last frame** of `mas_chromo` freezes and animates — scale and translate — into the footer slot (§5.5). Background blur ramps 0 → 14 px over the same 24 frames. |
| **C** card in | 176 – 189 | 5.87 – 6.33 | Card scales 0.85 → 1.00 and fades 0 → 1 from centre. Title, ring track and statement appear with it. Ring accent starts full. |
| **D** timer | 190 – 789 | 6.33 – 26.33 | 20.0 s countdown. Accent arc depletes to zero. |
| **E** hold | 790 – 804 | 26.33 – 26.83 | Empty ring, statement still readable. Cut. |

**Total: 805 frames, 26.83 s.**

### Ticking

`assets/audio/sfx/tick.wav` at frames **190 + 30k** for k = 0…19 — twenty ticks, one per second of
the countdown. No tick on the final frame.

### Hurry window

Entry frame is drawn from **60–80 % of the timer**, seeded and recorded:

```
enter = 190 + round(600 × u),  u ~ Uniform(0.60, 0.80)     // frames 550 – 670
```

At `enter`: the hurry overlay scales in (§5.6) **and** a random `assets/audio/mid_audio/*.mp3`
starts. When that audio ends (`enter + round(duration × 30)`), the overlay scales out.

mid_audio runs 0.68–2.19 s, so the overlay is on screen for roughly 1–3 s and always clears well
before the countdown ends.

---

## 7. Correctness gates

The lesson pipeline's rules apply here with two deliberate changes, because a puzzle is not a
technique.

**§3.1 independent verification — applies, unchanged.** Write a SymPy script that computes the
answer from the statement. The verifier writes its own, blind, and the orchestrator runs both.
Any disagreement fails the task. The text is not edited to match the code and the code is not
edited to match the text.

Your script prints one line of JSON:

```json
{"task_id": "...", "computed": "<value>", "agrees": true}
```

**§3.2 applicability and counterexample — waived.** A one-off puzzle has no applicability
condition and nothing to find a counterexample to. Requiring one here would produce filler.
This waiver is scoped to this template and does not touch the lesson pipeline.

**§3.3 no gap-filling — applies, unchanged.** Missing information is `null` plus a reason. Never
invent a value to complete the object.

**§3.4 random operands — replaced.** For a lesson, hand-picked numbers hide a broken technique.
For a puzzle the numbers *are* the design, and randomising them destroys it. The protection that
replaces it is the ledger: the `structure_id` rules in §2 are what stop the same puzzle shipping
twice in new clothes.

---

## 8. Output

| what | where |
|---|---|
| video | `output/posts/tasks/20s/<task_id>.mp4` |
| ledger entry | `core/content/tasks-ledger.json` |
| run artifacts | `core/out/runs/<run-id>/` |

The video is written **only** when verification passed and the statement fits the ring. Both are
hard conditions in the orchestration script, not judgement calls.
