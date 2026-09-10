# Prompt template — math story

Typed prompt for one Instagram/TikTok post that **tells a story about mathematics**: a person, an
object, a phenomenon, or a formula that changed something. Not a lesson and not a puzzle — the
other two sections cover those, and a story must never be one of them with a narrator over it.

Reference mockups: `story_template.png` (empty card) and `story_example.png` (a filled one).
Both are 1440×2560, i.e. 2× the 720×1280 design frame. Every measurement below was taken from
them and is authoritative.

Skills this template assumes: **story-hook** (structure and openings), **math-visual** (formulas
and drawn shapes), **video-prompt** (when revising this file).

---

## 1. Agents

```
  ledger ──► A  axi-story-writer ──► script + sources + images
                        │
                        ▼
             B  axi-story-validator ──► opens every URL BLIND, checks the quote
                        │
                        ▼
             C  axi-verifier (existing) ──► SymPy check when the formula is checkable
                        │
                        ▼
             D  axi-lesson-narrator (existing) ──► ElevenLabs, one clip per beat
                        │
                        ▼
             E  axi-editor (existing) ──► trim to the ceiling, touch no claim
                        │
                        ▼
                   RENDER GATE
```

The writer never validates its own facts, and the validator never sees the writer's reasoning —
same isolation boundary as everywhere else, `core/agents/ISOLATION.md`.

---

## 2. Output contract

```jsonc
{
  "story_id":     "string",              // kebab-case slug
  "area":         "string",              // ASSIGNED by the run, see §3
  "subject_slug": "leonhard-euler",      // WHO or WHAT the story is about
  "angle_slug":   "seven-bridges",       // WHAT is said about it — see §4
  "title":        "Who is Euler?",       // the card headline, English, <= 3 lines

  "beats": [                             // four, in this order. See §5
    { "beat": "hook",      "narration": "...", "display": "...",
      "visual": "image|formula|shape|plot|none",
      "image_id": "i1" },                // REQUIRED when visual is "image" — which image.
                                         // Omitted, images are handed out in order and a beat
                                         // may get one that does not match what it says.
    { "beat": "turn",      "narration": "...", "display": "...", "visual": "image", "image_id": "i2" },
    { "beat": "mechanism", "narration": "...", "display": "...", "visual": "formula" },
                                         // or "plot" plus a `plot` object — a curve computed from
                                         // its equation and built on screen. See math-visual.
    { "beat": "payoff",    "narration": "...", "display": "...", "visual": "image", "image_id": "i1" }
  ],

  "formula_latex": "e^{i\\pi} + 1 = 0",  // exactly one. Mandatory — see §6
  "mechanism":     "string",             // why it is true / why it works, plain language
  "check_script":  "string | null",      // relative to the run dir; null with a reason if the
                                         // claim is not the kind SymPy can settle

  "facts": [                             // EVERY factual claim, see §7
    { "claim_id": "f1",
      "claim": "Euler published 886 works.",
      "url":   "https://...",
      "quote": "the sentence from that page, verbatim" }
  ],

  "images": [
    { "image_id": "i1", "role": "portrait|scene|diagram",
      "source": "commons|generated",
      "file": "images/i1.jpg",
      "attribution": "string | null",    // REQUIRED for commons, null for generated
      "source_url": "string | null",
      "prompt": "string | null" }        // REQUIRED for generated, null for commons
  ],

  "nulls": [{ "field": "...", "reason": "..." }]
}
```

Write it to `<run>/story.out.json`.

---

## 3. The category is ASSIGNED

The run names one of five. Your first job is to work inside it, not to pick it.

| area | what it is | what makes it work |
|---|---|---|
| `topology-and-geometry` | the mesmerising visual | a shape doing something the viewer did not expect — a curve that turns out to be a heart, a cut that does not separate |
| `probability-and-statistics` | the illusion of control | a result that contradicts intuition and costs people money or lives |
| `financial-mathematics` | about money | a formula that moves capital, and what it does to a real number the viewer recognises |
| `math-in-real-life` | already running | the mathematics inside something they used this morning |
| `biography` | a person + a formula | never a life summary; a person, one problem they were stuck on, and where that formula is used today |

**Assigned rather than chosen because free choice collapses to biography.** "Math story" evokes
dead European men, and an agent asked to pick will produce them until the section has one flavour.
The area comes from whichever pool position has gone longest without use, in
`core/pipeline/lib/rotation.mjs`.

Fall back only if the assigned area genuinely cannot carry a story this week, and say which you
used instead and why.

---

## 4. Deduplication — subject AND angle

```bash
node core/pipeline/lib/stories-ledger.mjs candidates '<subject_slug>' '<angle_slug>' '<area>'
```

| rule | window | effect |
|---|---|---|
| same `subject_slug` | last 30 shipped | blocked — let a subject rest |
| same `angle_slug` | forever | blocked — a retelling is not a story |

The split matters. Euler told as the bridges of Königsberg and Euler told as `e^{iπ}+1=0` are two
different stories; blocking on subject alone would lose the second one permanently. Blocking on
angle alone would let the same person carry the section.

After five rejected candidates, emit `{"status": "no_story", "tried": [...]}` and stop.

---

## 5. The four beats

Structure is fixed. See the **story-hook** skill for why, and for openings that work.

| beat | length | job |
|---|---|---|
| `hook` | 0–3 s | the impossible-sounding consequence. No names, no dates, no context. |
| `turn` | 3–12 s | who or what, and the problem they were actually stuck on |
| `mechanism` | 12–40 s | the formula, shown and explained |
| `payoff` | last 8–12 s | where it lives today — what the viewer now holds |

**Narration must sound like speech, not like a recording.** No `[pause]` tags, no ellipses, no
em-dashes as pacing: one `[pause]` was measured producing 2.98 s of silence in a ten-second clip.
Emotion tags yes, one or two per beat; timing comes from punctuation, and the pipeline trims
anything longer than 0.3 s afterwards.

Each beat carries **two texts, and they are not the same text**:

- `narration` — full sentences, spoken. This is what is heard.
- `display` — the minimum on the card. What a viewer would write down, not the sentence you said.

Copying narration onto the card is the worst outcome available: the viewer reads faster than you
speak, finishes early, and stops listening.

---

## 6. The mechanism is mandatory

**One formula, shown and explained.** A story without one is trivia, and this channel does not
make trivia. `formula_latex` is what appears; `mechanism` is why it is true or why it works.

When the formula asserts something SymPy can settle, write a check exactly as the task and lesson
pipelines do — the orchestrator runs it against an independent one from `axi-verifier`, and any
disagreement fails the story. The text is not edited to match the code.

**The check's output contract, which bites hardest on story claims.** The orchestrator reads only
the **last line** of stdout and requires it to be exactly one JSON object:

```
{"claim_id": "...", "computed": "<canonical value string>", "agrees": true}
```

and it passes the formula gate only when the generator's `computed` string **equals** the
verifier's, character for character. Print nothing after that line; do not pretty-print it across
several lines (the last line would then be a bare `}`); do not emit only human "OK" lines.

`computed` is a single decisive value, not a test log. For a formula that reduces to an
expression, it is that expression in canonical SymPy form (the napkin-ring story emitted
`pi*h**3/6` from both scripts). For a claim with no single scalar — an identity, a procedure, an
optimisation — anchor it on a **canonical worked instance** and emit the SymPy-canonical string of
that instance's decisive result, so two blind scripts converge on the same characters:

- an identity or procedure → run it on the concrete example the story's own text names, and emit
  that result (e.g. the Euclid loop on 1920 and 1080 emits `120`);
- an optimisation → evaluate the closed-form optimum on one fixed dataset named in the check
  itself, and emit the coefficients (e.g. the least-squares fit to `x=(1,2,3), y=(2,3,5)` emits
  `(1/3, 3/2)`).

The rich, per-script assertions still belong in the script — they are each script's own thorough
check — but they go to stderr or to earlier stdout lines, never into `computed`.

When it cannot — a definition, a historical statement, a modelling assumption — set
`check_script` to `null` **with a reason in `nulls[]`**. An invented check that proves nothing is
worse than an honest gap.

---

## 7. Every factual claim carries a source

This is the gate that makes the section trustworthy, and it is enforced by an agent that opens
the links.

For each claim: the claim, a URL, and the supporting sentence quoted verbatim. The Validator
fetches each URL **without your script**, confirms the quote is on the page, and confirms it
supports the claim rather than merely sitting near it.

Where this bites hardest: **dates, counts, ages, and firsts.** They are exactly what a language
model states confidently and wrongly, and exactly what a viewer will check.

Three absolute rules:

- **Never invent a quotation.** Attributed lines are the most-repeated fabrication in mathematics
  history. Unsourced quote → the story fails.
- **Never imply causation a source does not state.** "He went blind, so he turned inward" is a
  good line and an invented claim.
- **Never cite a page you did not read.** A plausible URL is a fabricated citation.

---

## 8. Images

Two sources, and no third.

**Wikimedia Commons**, through the tool, which refuses anything that is not public domain or
permissive Creative Commons and returns the attribution the post owes:

```bash
node core/tools/wikimedia.mjs search "Leonhard Euler portrait" --limit 6
```

NonCommercial and NoDerivatives are rejected outright: the channel is monetisable and the image
is composited into a derived work, so both would be violated by the use itself.

**Gemini generation**, for diagrams, scenes, objects and eras Commons cannot supply:

```bash
node core/tools/gemini-image.mjs generate "<prompt>" --out <run>/images/i2.png
```

> **A real person's likeness is never generated.** A generated "Euler" is an invented face
> presented as a historical fact — the visual form of the fabrication §3.3 forbids everywhere
> else. Real people come from Commons, or the story runs without a portrait.

**Cost.** Each generated image is billed. Published prices, Aug 2026:

| model | per image | note |
|---|---|---|
| `imagen-4.0-fast-generate-001` | $0.020 | cheapest; strong on photoreal scenes |
| `gemini-3.1-flash-lite-image` | $0.0336 | newest cheap tier |
| `gemini-2.5-flash-image` | $0.039 | good instruction-following, much cheaper |
| `imagen-4.0-generate-001` | $0.040 | |
| **`gemini-3-pro-image`** | **$0.134** | **default** — best composition fidelity |

The card shows images at 350 × 294 design px, so resolution above 1K is cropped away unseen. Pro
is the default for hit-rate rather than pixels: a regeneration costs a full image either way, so
a model that lands the brief first time is cheaper than its sticker price.

**At this price the image budget is the binding constraint on the section.** Roughly $0.40 a
story at three images, so a $25 balance is about 62 stories. Generate only what the story
genuinely needs — two or three — never one per beat, and reach for Commons first every time.
Check the running total:

```bash
node core/tools/gemini-image.mjs cost          # spend so far against a $25 budget
```

Generated images come back **4:3** (1200 × 896 observed). Left unset the model returns landscape
(1408 × 768), and the card slot is 350 × 294 — `object-fit: cover` would then discard most of the
frame, so the composition the prompt asked for is not the one that ships. Write prompts for a
4:3 frame with the subject centred and margins to spare.

Generation may be unavailable — the key is supplied separately and `gemini-image.mjs check`
reports it. If it is unavailable, say so in `nulls[]` and design around what Commons has. Do not
ship a placeholder.

---

## 9. Render specification

Design units **720 × 1280**; captured at `deviceScaleFactor: 1.5` → **1080 × 1920**, 30 fps.

### 9.1 Card, background, wordmark

Identical to the other two sections — the same component, the same numbers:

| property | value |
|---|---|
| card | x 54, y 120, w 612, h 1050, radius 40, border 5 px `#000000`, fill `#FFFFFF` |
| background | rotated from `assets/images/bg/`, `object-fit: cover`, blurred 14 px |

### 9.2 Content bands, measured from `story_example.png`

| element | band |
|---|---|
| mascot | x 328–397 (w 69), y 157–264 (h 107) — centred on x ≈ 360 |
| title | y 367–407, centred, Inter ExtraBold ≈ 52 px, max 3 lines |
| image / visual | x 185–535 (w 350), y 520–814 (h 294), rounded corners, centred |

The formula, drawn shapes and plots occupy the same band as the image — one visual at a time,
swapped per beat. A `plot` gets the band at 564 x 470 and builds itself over its first 1.5 s.

A long beat — the mechanism runs past 30 s — should not hold one still picture. Give it `steps`:
an ordered list of visuals, each weighted by the WORD COUNT of the narration it illustrates, so the
picture advances with the voice. Steps may be formulas, plots, shapes, or `anim` (computed
animations: `gcd-subtraction`, `least-squares`, `fourier-build`, `nash-matrix`, `nash-mixing`). See
the math-visual skill.
Auto-fit as elsewhere; if it does not fit at the floor, the beat is rejected rather than
overflowing.

### 9.3 The mascot — enter, read, leave

Source: `assets/video/10s.mp4`, 1920×1080, 24 fps, 10.08 s, green screen `0x02a63a`. One
continuous take: he walks in holding a closed book, **opens it at about 5.5–6 s**, reads, then
**walks off to the left over the last 4 s**, leaving an empty frame at 10 s.

That maps onto the post directly:

| phase | frames (30 fps) | what plays |
|---|---|---|
| enter + open | 0 → ~165 | `10s.mp4` from its start; he comes in **from the top-left of the card border** and settles in the mascot band by ~5.5–6 s |
| read | ~165 → end − 120 | held with the book open, at the mockup size in §9.2 |
| leave | last 120 frames (4 s) | the tail of `10s.mp4`, timed so he clears the frame exactly as the video ends |

Rendered at the **mockup size**, not full-bleed: ~69 × 107 design px in the mascot band.

> `assets/video/stories_idle.mp4` exists (720×1280, green `0x266731`, a loop with the book open)
> but is **not used**: it is a different aspect ratio and a different mascot scale, so splicing it
> between the two halves of `10s.mp4` makes the mascot jump at both seams. Everything comes from
> the one clip.

### 9.4 Length

Free, with a hard ceiling of **90 seconds** — the practical limit shared by Reels and TikTok's
short-form surface. The narration decides the length; the Editor cuts only if it overruns.

Both numbers below are the length of the WHOLE POST, not of a beat. Below ~35 s of finished
video there is not enough room left for the mechanism beat to breathe once the other three have
had their seconds. Below **10 s** the post is impossible: the mascot alone needs 6 s to enter and
4 s to leave.

There is no floor on an individual beat. A mechanism that carries its whole construction in 28 s
is a well-cut mechanism, not a rushed one.

**Write to a word budget, because the ceiling is enforced after the audio is paid for.** The
orchestrator builds the timeline from the measured clip lengths and only then checks 90 s, so a
script that runs long closes as `blocked / over-90s-ceiling` having already spent the ElevenLabs
characters.

Measured on this voice and model, twice: **2.27 words per second**, counting narration with the
emotion tags stripped. (101 words / 44.91 s on the first shipped story; 82 words / 36.11 s on a
single mechanism beat.) Emotion tags cost time without being words, so the figure already
includes them.

| target | clean words |
|---|---|
| 90 s, the hard ceiling | 202 — do not aim here |
| 85 s | 191 |
| **80 s, the sane target** | **180** |
| 70 s | 157 |

Add ~1 s for the card-in and the closing hold. Do not estimate at some other rate: two drafts
were written at an assumed 2.6 words/s and both came out over the ceiling.

### 9.5 Fonts

Inter, vendored via `@fontsource/inter`. Never the system font, or the capture becomes
machine-dependent and frame determinism is gone.

---

## 10. Gates

| gate | what fails it |
|---|---|
| **sources** | any citation whose quote is not on the page, or does not support the claim |
| **formula** | two independent SymPy scripts disagreeing, or disagreeing with the text |
| **images** | a Commons file without an accepted licence, or a generated likeness of a real person |
| **fit** | any display line that does not fit the card at the minimum size |
| **ceiling** | total runtime over 90 s after the Editor has had its chance |
| **no gap-filling** | a required field invented rather than returned as `null` + reason |

All are conditions in the orchestration script. None has an override flag.

---

## 11. Output

| what | where |
|---|---|
| video | `output/posts/stories/<story_id>.mp4` |
| ledger | `core/content/stories-ledger.json` |
| images + attribution | `core/out/runs/<run-id>/images/` |
| run artifacts | `core/out/runs/<run-id>/` |
