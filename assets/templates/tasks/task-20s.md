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
  "description_latex": "string | null", // REQUIRED when the description contains mathematics.
                                     // Without it "Find 4^x + 8^x" prints raw carets next to a
                                     // properly typeset ring. Wrap prose in \\text{...}.
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
| fallback | `Can you solve it in 20 seconds?` when `description` is null. The headline is the challenge; the ask is a separate line under the ring (§5.4). The first renders opened on "Answer in the comments" as the biggest text on the card — an ask before the viewer knew the question. |

### 5.4 Ring, statement, readout, ask

| property | value |
|---|---|
| centre | (360, 660) |
| outer radius | 270 |
| stroke width | 26 |
| inner radius | 244 |
| track colour | `#D1C5C0` |
| accent colour | `#1E76C3`, warming to `#F26B1D` over 15 frames at 75 % of the countdown — a re-hook with no words |
| line cap | round |
| glow | `drop-shadow(0 0 18px <accent>73)` on the accent arc only, following the accent colour |
| direction | **countdown** — starts as a full circle, depletes clockwise from 12 o'clock |

> Thinner and wider than the mockup (stroke 66, outer 264). The ring is the clock, not the
> subject; at 66 px it left a 249 px box for the puzzle, which made the puzzle the smallest thing
> on screen. The mockup's track reads `#EFEFEF`, not `#D1C5C0`; the specified value wins.

**The statement is the hero. It fills the ring and must not touch it.**

- centred on (360, 630) — the ring centre raised by half the readout band — colour `#1E76C3`, weight 700
- safe area: a circle of radius **228** (inner radius 244 minus 16 px padding), i.e. an inscribed
  box **322 wide**; the height allowance is that box less the 60 px readout band, **262**
- a plain-text statement may wrap to **two lines** inside the ring when that makes it larger
  (`84% of 25 = ?` becomes two lines at ~90 px instead of one at 50); a LaTeX statement never wraps
- font size auto-fits downward from **96 px** in 2 px steps until the rendered bounding box fits
- **if it does not fit at 40 px, the task is rejected** — shorten the statement or pick another
  puzzle. Do not overflow the ring, do not clip, do not shrink further.
- pops in over the first 10 frames from scale 0.8, already most of the way in on frame 0
- keep the plain-text statement under ~14 characters where possible; that is what fits large

**Readout** — whole seconds left, `12s`, Inter SemiBold 30 px tabular, `#8A94A6` warming with the
ring, centred on (360, 860). It nudges 8 % on every tick. A number is a finish line; the viewer
can see how far the payoff is.

**Ask** — `Answer in the comments`, Inter SemiBold 26 px `#5B6470`, centred on (360, 962). One
line, one action, under the ring rather than over it. When the timer ends it becomes the payoff:
over 12 frames it grows to 32 px, warms to `#F26B1D` and reads `Time! Answer in the comments ↓`,
and the readout disappears. The post ends on the thing to do, not on an empty circle.

**Mascot still** — breathes (scale ±2 %, 84-frame period, from the feet). A still that never
moves reads as a sticker.

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
| box | x 225, y 640, w 270, h 270 — centred in the ring |
| source | `assets/video/hurry/hurry.webm` — the white rabbit with the stopwatch — **overlaid as-is**, looped if shorter than the audio |
| enter | scale 0.6 → 1.0, opacity 0 → 1, 11 frames, ease-out |
| exit | scale 1.0 → 0.6, opacity 1 → 0, 11 frames, ease-in |

The pool is the rabbit alone. It is the one clip that is *about* time; the others in the folder
(a capybara, a chihuahua, popcat, a witch cat) are memes with no connection to the post, and a
second off-brand character in the frame reads as a different channel. `dumdum.webm` is
additionally unusable: its alpha carries a translucent sheet of formulas that reads as a smudge
over the white card.

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
| **A** card in | 0 – 7 | 0.00 – 0.27 | Card is **opaque from frame 0** and settles from scale 0.96. Frame 0 is the thumbnail; a card fading in from nothing wastes it. Title, ring track and statement are legible on frame 0. A random `assets/audio/start_audio/*.mp3` plays from frame 0. The blurred background drifts 6 % over the whole post so no frame is identical to the last. |
| **B** timer | 8 – 607 | 0.27 – 20.27 | 20.0 s countdown. Accent arc depletes to zero. |
| **C** hold | 608 – 652 | — | The ask grows into the payoff (§5.4); statement still readable. Cut. |

**Total: 653 frames, 21.77 s.**

### Ticking

`assets/audio/sfx/tick.wav` at frames **8 + 30k** for k = 0…19 — twenty ticks, one per second of
the countdown. No tick on the final frame.

### Hurry window

Entry frame is drawn from **60–80 % of the timer**, seeded and recorded:

```
enter = 8 + round(600 × u),  u ~ Uniform(0.60, 0.80)     
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
