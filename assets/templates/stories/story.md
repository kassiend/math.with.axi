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
      "visual": "image|formula|shape|none",
      "image_id": "i1",                  // REQUIRED for every beat but a formula beat: the image
                                         // that fills the card behind it. A formula beat keeps
                                         // the previous image, dimmed.
      "stat": { "prefix": "1 in", "value": "73M", "suffix": null, "count": true } },
                                         // OPTIONAL: the number the thumb stops for, counted up
                                         // huge in the accent. value <= 9 characters ("73M",
                                         // "$1.2B", "38 µs"). One or two beats at most. A
                                         // quantity counts up from zero; a year does not
                                         // (detected, or set count:false).
    { "beat": "turn",      "narration": "...", "display": "...", "visual": "image", "image_id": "i2" },
    { "beat": "mechanism", "narration": "...", "display": "...", "visual": "formula" },
    { "beat": "payoff",    "narration": "...", "display": "...", "visual": "image", "image_id": "i1" }
  ],

  "formula_latex": "e^{i\\pi} + 1 = 0",  // exactly one. Mandatory — see §6
  "formula_steps": ["string"],           // the derivation, 2-4 LaTeX lines ending in
                                         // formula_latex, built line by line in time with the
                                         // mechanism narration. See §6. null + reason if there
                                         // is genuinely no derivation to show
  "mechanism":     "string",             // why it is true / why it works, plain language
  "ask":           "Save this one.",     // the closing line, <= 6 words. One action.
  "music_prompt":  "string",             // the bed, one sentence: mood, tempo, instruments.
                                         // Instrumental is added automatically. See §5.5
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

## 3.5 Viral, or it does not ship

The area is assigned; the *subject and angle inside it* are chosen to be shared. Use the
**going-viral** skill for the strategy and **story-hook** for the opening. Before writing, answer
in one line each, and put the answers in `viral_read` in the output:

1. **Goal** — SHARE (awe, indignation, "you're being lied to") or SAVE ("I'll need this"). Pick
   one. A story that wants both gets neither.
2. **The identity signal** — what does sending this make the sender look like? Smart, early,
   right, the one who knows the trick. If sending it makes nobody look like anything, change
   the angle.
3. **The stat** — one number a viewer can repeat at dinner. `1 in 73,000,000`. `38 microseconds`.
   `$1,000,000,000`. If the story has one, it goes on the hook or turn beat as `stat`.
4. **The gap** — what the viewer does not know at 0:03 and cannot leave without.

**Subjects that carry.** Money made or lost, a person jailed or freed, a casino or a lottery
beaten, a machine or a phone that only works because of the maths, a disaster a number could have
prevented, a thing everyone believes that is false, a trick the viewer can use tonight. A
biography carries only when the angle is one of those — nobody shares a birth date.

**Titles are consequences.** `The number that jailed a mother`, not `The prosecutor's fallacy`.
`Your GPS is wrong by 11 km a day`, not `Relativity in satellites`. Six words or fewer, a thing
that happened, no names, no dates. The title is the on-screen hook for the whole post; it is on
every frame.

**The test.** Would a sixteen-year-old send this to a friend with no caption? If the honest
answer is no, it is a lecture. Change the angle, not the polish.

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

**Pace.** The first render was slow. Sentences of **three to nine words**. Full stops, not
commas. No subordinate clauses. The hook beat is under **3 seconds** of speech — one sentence,
maybe two. The whole story is **35–50 seconds** of speech, never more; the narrator renders at
tempo 1.12 with pauses cut to 0.15 s, and what is left has to have been tight to begin with.
Read every beat aloud with a stopwatch before writing it down.

**Display lines are headlines, not formulas.** Five words or fewer, and never a formula in
words — the mechanism beat's display says what the maths *does* (`One number, squared`), while
the formula itself is drawn from `formula_steps`. Copying narration onto the card is the worst
outcome available: the viewer reads faster than you speak, finishes early, and stops listening.

Each beat carries **two texts, and they are not the same text**:

- `narration` — full sentences, spoken. This is what is heard.
- `display` — the minimum on the card. What a viewer would write down, not the sentence you said.

Copying narration onto the card is the worst outcome available: the viewer reads faster than you
speak, finishes early, and stops listening.

---

### 5.5 Music

Every story has a bed, generated from `music_prompt` at the post's length and ducked under the
voice. One sentence: **mood, tempo, instruments, and what it must not be.** It follows the
story, not the area — a jailed mother is not a jaunty bed.

| story | prompt |
|---|---|
| a wrongful conviction | `slow cinematic tension, sparse piano over a low string drone, a soft ticking pulse, no melody, documentary underscore` |
| a casino beaten | `sly, confident mid-tempo groove, muted brass stabs, upright bass, a hint of swing, heist film` |
| a satellite that would drift | `airy synth pads, slow arpeggio, quiet awe, science documentary, no drums until the last third` |

No vocals is added automatically. Never ask for a known artist or a named track.

---

## 6. The mechanism is mandatory

**One formula, shown and explained.** A story without one is trivia, and this channel does not
make trivia. `formula_latex` is what appears; `mechanism` is why it is true or why it works.

**Show it being built.** `formula_steps` is the derivation as 2–4 LaTeX lines, the last of which
is `formula_latex`. The page lands them one at a time across the mechanism beat, in the order
the narration reaches them, earlier lines dimming as the next arrives. The first render put the
finished `V = πh³/6` alone on a white card for twenty-one seconds while the voice talked about
annuli and cancelling R² — none of which was ever on screen. The narration and the lines must
agree in order: what is said third lands third.

Every line is a claim. When the check script can confirm a step (an equality, a simplification,
an integral), it does; a derivation with a wrong middle line is a wrong story. When there is no
derivation to show — a definition, a historical statement — set `formula_steps` to `null` with a
reason in `nulls[]` rather than padding it with restatements.

When the formula asserts something SymPy can settle, write a check exactly as the task and lesson
pipelines do — the orchestrator runs it against an independent one from `axi-verifier`, and any
disagreement fails the story. The text is not edited to match the code. The script's **last line
is the JSON report** `{"claim_id": "<story_id>", "computed": "...", "agrees": true}` printed with
`json.dumps`; the orchestrator reads that line and nothing else. For a story both scripts must
report `agrees: true`; their `computed` strings describe what was checked and are not compared
to each other (a lesson's numeric result is; a sentence written twice blind never matches).

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

**Every beat except a formula beat has its own image, and it fills the card.** The image is not
an illustration in a slot any more; it is the frame the story plays in. Generate — do not
hesitate. The budget exists to be spent on images that make a thumb stop.

**Gemini generation** is the default:

```bash
node core/tools/gemini-image.mjs generate "<prompt>" --out <run>/images/i1.png --aspect 9:16
```

`--aspect 9:16` is mandatory for stories: the card is 612 × 1040 inside its border and covers the
image with almost no crop at 9:16. A 4:3 or square image loses a third of itself.

**How to prompt.** Cinematic photograph, not illustration, unless the story is about an
abstraction. One subject, off-centre, dramatic light, shallow depth, a colour the whole story can
share. Leave the top third and bottom third quiet — the title and the line sit on dark scrims
there — so the subject lives in the middle band. Name the era and the place. Never text in the
image; the card supplies the words. Never a face meant to be a real person.

| beat | prompt shape |
|---|---|
| hook | the consequence as an object or a scene: an empty cot in a dim room, a courtroom bench under one lamp, a satellite against a black limb of Earth |
| turn | the person or the thing, without a face if the person is real: hands on a ledger, a chalk board, a lab bench |
| payoff | where it lives today: a phone on a dashboard at night, a betting slip, a signed paper |

**Wikimedia Commons** for a real person's likeness and for historical photographs, through the
tool that refuses anything not public domain or permissive CC and returns the attribution owed:

```bash
node core/tools/wikimedia.mjs search "Leonhard Euler portrait" --limit 6
```

> **A real person's likeness is never generated.** A generated "Euler" is an invented face
> presented as a historical fact — the visual form of the fabrication §3.3 forbids everywhere
> else. Real people come from Commons, or the story runs without a portrait.

**Cost.** Each generated image is billed (`gemini-3-pro-image`, $0.134; cheaper tiers exist —
see `core/tools/gemini-image.mjs`). Three images a story, about $0.40. Check the running total
with `node core/tools/gemini-image.mjs cost`. Generation may be unavailable — the key is supplied
separately and `gemini-image.mjs check` reports it; if so, say so in `nulls[]` and use Commons.
Do not ship a placeholder and do not ship a beat with no image.

---

## 9. Render specification

Design units **720 × 1280**; captured at `deviceScaleFactor: 1.5` → **1080 × 1920**, 30 fps.

### 9.1 Card, background, wordmark

Identical to the other two sections — the same component, the same numbers:

| property | value |
|---|---|
| card | x 54, y 120, w 612, h 1050, radius 40, border 5 px `#000000`, fill `#FFFFFF` |
| background | rotated from `assets/images/bg/`, `object-fit: cover`, blurred 14 px |

### 9.2 The card — documentary-cinematic

The image covers the card's interior (612 × 1040 inside the 5 px border, clipped to the radius)
and drifts in 9 % over its beat. Dark scrims (`#07090F`) carry the type: top 420 px at 78 %
fading to clear, bottom 560 px at 92 % fading to clear. Nothing inside the card is white.

| element | spec |
|---|---|
| mascot | at rest x 310, y 150, w 100, h 155, over the top scrim — Remotion draws it |
| title | Outfit 900, 62 px (fit to 40), white, tracking −0.03 em, left x 110, top y 330, max 3 lines, on every frame |
| stat | optional per beat: prefix Outfit 700 40 px white/85 %, value Outfit 900 128 px (fit to 64, one unwrapped line) in `#F26B1D`, counted up from zero over 36 frames, centred on y 700, left-aligned |
| formula stack | over the image dimmed to 28 % and blurred 8 px: lines in white, the last in `#F26B1D`, 56 px single / 48 px stacked (fit to 26 against 564 px), centred on y 640 |
| display line | Outfit 800 54 px (fit to 34), white, left x 110, top y 918, max 3 lines, built token by token |
| ask | Outfit 600 28 px white/72 %, left x 110, centred on y 1120, 24 frames into the payoff beat and through the hold |
| progress | 5 px hairline along the card's bottom edge, `#F26B1D` over white/18 %, filling across the post |

Beat changes cross-fade over 8 frames — image and type together; there is never an empty card.
A formula beat keeps the previous beat's image behind it.

**Audio.** Narration at tempo 1.12 with pauses cut to 0.15 s. A whoosh on every beat change, a
soft impact where a stat lands, a bell where the formula stack begins, and the music bed from
`music_prompt` at 50 % ducked to 16 % under speech. SFX live in `assets/audio/sfx/story/`.

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

Below ~35 s the mechanism beat cannot breathe. Below **10 s** the post is impossible: the mascot
alone needs 6 s to enter and 4 s to leave.

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
