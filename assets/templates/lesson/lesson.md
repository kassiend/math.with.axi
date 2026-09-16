# Prompt template — math tricks lesson

Typed prompt for one Instagram post that teaches a **method**: how to multiply fast, how to cut a
calculation short, how to see the shape of a problem. Not a puzzle — the daily-task templates in
`assets/templates/tasks/` cover those, and a lesson must never be one of those wearing a title.

Reference mockups: `step1.png`, `step2.png`, `step3.png`. Every measurement below was taken from
those files and is authoritative. (`step2.png` is 1440×2560, i.e. 2× the 720×1280 design frame.)

**Length is free but must not exceed 60 seconds.** There are no fixed 20 s / 40 s buckets here:
the narration decides how long the video is, and the Editor cuts it if it overruns.

---

## 1. Agents

Four, in a chain. Two are new; two already exist and are reused unchanged.

```
  ledger ──► A1 axi-lesson-planner ──► plan + scenario
                                          │
                                          ▼
                        A2 axi-lesson-narrator ──► narration script (ElevenLabs)
                                          │         display script (on screen)
                                          │         per-step audio clips
                                          ▼
                        B axi-verifier  (existing, unchanged)
                                          │  independent SymPy check per step
                                          ▼
                        C axi-editor    (existing, unchanged)
                                          │  trim to the 60 s ceiling, touch no maths
                                          ▼
                                    RENDER GATE
```

**A1 and A2 are separate agents, not one agent doing two jobs.** The planner decides *what is
taught and in what order*; the narrator decides *how it is said and shown*. Merging them produces
a script written to be easy to say rather than a lesson written to be understood, which is the
failure mode this split exists to prevent.

**B and C never see the planner's or narrator's reasoning.** Same isolation boundary as everywhere
else in this pipeline — see `core/agents/ISOLATION.md`. The Verifier receives an allowlisted
projection of the lesson object and writes its own SymPy check blind.

---

## 2. Agent A1 — planner

### 2.1 Deduplication comes first

Lessons share the concept ledger with everything else taught on this channel:

```bash
node core/pipeline/lib/ledger.mjs candidates '<concept_slug>' '<tag,tag,...>'
```

Match on **normalised concept, not on wording**. These are the same lesson:

- "Multiply by 11" and "The 11 shortcut"
- "Squaring numbers ending in 5" and "Fast squares for 25, 35, 45"
- "Multiply by 11" taught with `23 × 11` and the same taught with `52 × 11`

**No paraphrase, no re-framing, no "same trick, different numbers."** If a viewer who watched the
earlier lesson would learn nothing new, it is a duplicate. Different operands are not a different
lesson; a genuinely different *mechanism* is.

After five rejected candidates, emit `{"status": "no_topic", "tried": [...]}` and stop.

### 2.2 The subject area is ASSIGNED, not chosen

**The run tells you which branch of technique to teach.** Echo it back in the plan as `area`.

This is assigned because free choice does not produce a curriculum. An agent asked to pick a
"maths trick" picks multiplication shortcuts and square roots, every time — and a channel that
only ever shows those reads as a party trick rather than as teaching. The area comes from
whichever pool position has gone longest without use, in `core/pipeline/lib/rotation.mjs`:

`divisibility-rules`, `algebraic-identity`, `percentage-and-discount`, `estimation-and-bounding`,
`modular-arithmetic`, `fraction-manipulation`, `logarithm-and-exponent`, `sequence-and-series`,
`equation-solving-strategy`, `geometry-shortcut`, `combinatorial-counting`,
`probability-intuition`, `number-base-and-digits`, `inequality-technique`,
`trigonometry-shortcut`, `division-shortcut`, `multiplication-shortcut`, `squaring-and-roots`.

You still choose the method, the framing and the numbers. You do not choose the branch.

Fall back only if the assigned area genuinely cannot carry a 30–60 second method lesson, and say
which you used instead and why.

### 2.3 What makes a good lesson topic

The goal is **transferable method**. A viewer should leave able to do a whole class of
calculations faster, not able to recite one answer.

| | example | verdict |
|---|---|---|
| Good | multiply any 2-digit number by 11 | one rule, huge reach, instantly testable |
| Good | square any number ending in 5 | same |
| Good | multiply two numbers near 100 by the base trick | reach beyond the examples shown |
| Bad | `47² − 43²` | that is a puzzle, not a method — belongs in the task templates |
| Bad | "what is a prime number" | definition, not technique; nothing to practise |
| Bad | a trick that only works for one specific pair | no transfer |

Prefer techniques a viewer can try on their own numbers **while still watching**. That is what
makes this format worth the runtime.

### 2.3 Content plan output

The planner emits a plan the narrator then dresses. Steps are variable in number — the mockups
show three, which is a good default, but a method that genuinely needs two or four should get them.

```jsonc
{
  "lesson_id":     "string",          // kebab-case slug
  "counter":       12,                // series number, see §5.2 — read from the ledger, never guessed
  "concept_slug":  "multiply-by-11-two-digit",
  "tags":          ["mental-arithmetic", "multiplication"],
  "method_name":   "Multiply by 11",  // the black line on step 1
  "applicability": "any two-digit number whose digits sum to less than 10",
  "carry_case":    "string | null",   // the case the simple rule does NOT cover, if one exists
  "steps": [
    {
      "step_id": "s1",
      "purpose": "pose",              // pose | rule | apply | result | caveat
      "instruction": "Multiply by 11",// the BLACK line
      "working":     "23 × 11 = ?"    // the BLUE line
    }
  ],
  "worked_example": { "operands": [23, 11], "result": "253" },
  "nulls": [{"field": "...", "reason": "..."}]
}
```

Write it to `<run>/plan.out.json`.

### 2.4 The caveat is not optional

Almost every mental-arithmetic trick has a case where the simple form breaks — `29 × 11` does not
give `2 9 9`, it carries. **State it in `carry_case`.** A lesson that teaches a rule and hides the
case where it fails teaches a bug, and the viewer finds it within a minute of trying.

If the technique genuinely has no exception, `carry_case` is `null` **with a reason in `nulls[]`**,
and the Verifier will be asked to confirm that. An unstated exception is the single most common
way this format goes wrong.

---

## 3. Agent A2 — narrator

Receives the plan. Produces **two parallel scripts** and the audio. They are not the same text.

### 3.1 Narration script — spoken, ElevenLabs

Full sentences, conversational, teacher-to-one-person. This is what the viewer *hears*.

Model is **`eleven_v3`**, which supports inline audio tags for emotion and pacing. Voice id and
key come from the environment, never from this file:

```bash
ELEVENLABS_API_KEY=…      # in .env, gitignored. NEVER committed.
ELEVENLABS_VOICE_ID=…
ELEVENLABS_MODEL=eleven_v3
```

**Tag every line with intonation and stops.** A flat read loses the viewer in the first second.

```
[excited] Heey, how do you solve 23 times 11 in your head? Watch this.
[curious] Take the two digits apart. Two, and three.
[confident] Add them. Two plus three is five.
[excited] Now drop the five right between them. Two-five-three. That's it.
[warm] Try it on your own number, and tell me what you got.
```

Rules that matter:

- **Do not use `[pause]`.** Measured: one tag produced 2.98 s of dead air in a ten-second clip.
  It reads as a buffering video, not as a dramatic beat. Punctuation paces a line well enough,
  and long gaps are trimmed after synthesis anyway.
- **No ellipses or em-dashes as pacing devices** — the same mechanism reads them as long holds.
- **One or two tags per step**, at the start of the phrase they colour. Tags sprayed across every
  clause make the read theatrical and worse.
- **Say the numbers as words** where the model would otherwise misread them: `23 × 11` reads
  cleanly as "twenty-three times eleven", not as "twenty-three ex eleven".
- **Never put a tag inside a number or formula.**
- Useful tags for this format: `[excited]`, `[curious]`, `[confident]`, `[warm]`, `[thoughtful]`,
  `[whispers]` for an aside. Avoid the comedic ones — this is a teacher, not a bit.

**The intro must not re-pose the problem step 1 poses.** Reviewed in the first render: the intro
asked "how do you solve ninety-two times eleven in your head?", then step 1 said "Ninety-two
times eleven. Looks tricky" — thirteen seconds on one problem, said twice. The intro opens a
gap (*why* this is worth thirty seconds); step 1 starts the method. If step 1's plan says
`pose`, its narration is one short phrase, not a restatement.

**The intro also has an on-screen line**, `intro.display`, at most six words: the claim that
lands under the problem at ~1.2 s while the voice is still talking. `In your head. No
calculator.` — a promise or a gap, never the title of the method.

**The outro is one ask**, `outro`: one sentence spoken, one short line shown. Save, share, or try
it on their own number — one action, not a menu. A post that ends on the answer and cuts asks
for nothing and gets it.

### 3.2 Display script — on screen, minimal

What the viewer *reads*. **Minimum information, maximum practical application.** The card is not
a transcript: the voice carries the explanation, the card carries the thing you would write down.

| narration says | card shows |
|---|---|
| "Take the two digits apart — two and three" | `Split 23 → 2 _ 3` |
| "Add them, two plus three is five" | `Do 2 + 3 = 5` |
| "Drop it in the middle and you get two-five-three" | `then put 5 between 2 and 3 to get 253` |

The instruction line is a verb phrase. The working line is the arithmetic. Neither is a sentence
from the narration.

### 3.3 Per-step audio

**One TTS request per step, plus one for the intro.** Not one continuous take.

Two reasons: `eleven_v3` returns no character-level timestamps, so a single take gives nothing to
sync against; and a per-step clip means a step that reads badly can be regenerated alone.

Each clip's measured duration **is** its step's on-screen duration — the audio never stretches to
fit the visuals, the visuals hold for the audio.

```
POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
{ "text": "...", "model_id": "eleven_v3",
  "voice_settings": { "stability": 0.45, "similarity_boost": 0.8, "style": 0.35 } }
```

Cache by hash of `(text, voice_id, model_id, settings)`. The account is on a metered character
plan; regenerating an unchanged line burns quota for nothing.

### 3.4 Narrator output

```jsonc
{
  "intro": {
    "narration": "[excited] Heey, twenty-three times eleven, in your head, faster than a calculator. Watch.",
    "display": "In your head. No calculator.",   // <= 6 words, lands under the problem at ~1.2 s
    "audio": "audio/intro.mp3",
    "seconds": 4.12
  },
  "steps": [
    {
      "step_id": "s1",
      "narration": "[curious] Take the two digits apart. [pause] Two … and three.",
      "instruction": "Multiply by 11",
      "working": "23 × 11 = ?",
      "audio": "audio/s1.mp3",
      "seconds": 3.44
    }
  ],
  "outro": {                                     // the ask. Optional but expected.
    "narration": "[warm] Save this, and try it on your own number.",
    "display": "Save this. Try it on yours.",     // one line, <= 8 words
    "audio": "audio/outro.mp3",
    "seconds": 2.6
  },
  "total_seconds": 26.9,
  "nulls": []
}
```

---

## 4. Agents B and C — reused unchanged

### 4.1 Verifier

Receives an allowlisted projection: steps, working lines, `worked_example`, `applicability`,
`carry_case`. **Never** the plan's reasoning, the narration script, or the narrator's own checks.

It writes an independent SymPy script confirming the worked example **from the stated rule**, not
by re-walking the displayed steps. For `23 × 11 = 253` that means computing `23 * 11` directly and
comparing — a script that reproduces the trick reproduces its bug.

It also answers: **does the stated `applicability` actually hold, and does `carry_case` actually
break the simple rule?** For multiply-by-11 that means checking that every two-digit number with
digit sum < 10 satisfies the rule and that at least one with digit sum ≥ 10 does not.

The mismatch rule is unchanged and absolute: code disagrees with text → lesson failed. The text is
not edited to match the code and the code is not edited to match the text.

### 4.2 Editor

Trims to the **60-second ceiling**. Timing is audio-locked: `editor.budget.json` carries every
clip's measured duration, and the Editor may not extend one.

Frozen — may not be touched at any cost: every number, every formula, the working lines, the
applicability condition, the carry case. If the only way under 60 s is to cut the caveat, the
lesson comes back **blocked**, unedited, with a reason.

To cut, the Editor shortens **narration**, and the narrator re-renders only the changed clips.

---

## 5. Render specification

Design units are **720 × 1280**. Captured at `deviceScaleFactor: 1.5` → **1080 × 1920**, 30 fps.

### 5.1 Card, footer, background

Identical to the task card — same component, same numbers:

| property | value |
|---|---|
| card | x 54, y 120, w 612, h 1050, radius 40, border 5 px `#000000`, fill `#FFFFFF` |
| background | random from `assets/images/bg/`, `object-fit: cover`, blurred 14 px from the hand-off on |
| mascot | the story's keyed walking take (`assets/video/10s.mp4`, geometry from `tools/story-mascot.mjs`), composited by Remotion, at rest in the band x 310, y 790, w 100, h 155. He walks in, reads while the lesson runs (frozen frame), and walks off as it ends. The footer still is gone — a still is not a character. |
| wordmark | `math with Axi`, Inter SemiBold 36 px, `#000000`, centred on x = 360, baseline y = 1074 |
| progress | one 12 px dot per step, 14 px apart, centred on (360, 310); `#1E76C3` done, `#D9DEE5` pending |

### 5.2 Title — the series counter

`Math tricks #N`, Inter ExtraBold 40 px, `#000000`, centred on x = 360, cap band y 243–273.

**N is read from the ledger, never invented**: one more than the highest counter already shipped.
It appears on **every** step of the lesson, unchanged — it identifies the post, not the step.

### 5.3 Hook layout, step body, ask

**Hook layout** (phase B). The first step's `working` is the hero: ExtraBold up to **96 px**
(auto-fit to 56, max 2 lines), `#1E76C3`, centred on y = 540, built token by token so the last
token lands by frame 36. `intro.display` then lands under it, ExtraBold 42 px (fit to 30, max 2
lines), `#000000`, centred on y = 690. Motion, then lock, then claim.

**Step body.** Two lines, centred as a group on **y = 561**, centred on x = 360, max width 500.

**The working line is drawn, not swapped.** Each character is its own glyph. At a step boundary
the glyphs that also existed in the previous step (longest common subsequence over characters)
SLIDE from where they were to where they are now, over 14 frames — `92` splits into `9 _ 2`, the
`11` travels to the end, the two 1s of `11` become the carry-1 and the middle-1 of `9+1|1|2`.
Glyphs that are new pop in afterwards in `#F26B1D` and settle to the working blue over 30
frames, staggered so they have all landed within the first 45 % of the step (at most 40 frames).
The instruction line waits for the slide (frame 10 of the step) and then builds at 3 frames per
token — motion first, then the words for it. Between the hook layout and step 1 the same rule
applies: the large problem shrinks into its body position.

A pop (`assets/audio/sfx/pop.wav`, −7 dB) marks each step boundary and the ask.

| line | colour | weight | size | measured band |
|---|---|---|---|---|
| instruction | `#000000` | ExtraBold 800 | 50 px | y 494–532 |
| working | `#1E76C3` | ExtraBold 800 | 60 px | y 591–628 |

Gap between the two blocks: 59 px. Each line auto-fits **down to 34 px** in 2 px steps if it wraps
past its allowance — instruction max 2 lines, working max 3. **If either still does not fit at
34 px, the step is rejected**: shorten the display text. Do not overflow the card, do not clip.

> The mockups disagree slightly on the working-line size — `step2.png` renders it larger than
> `step1/3.png` because its text wraps to two lines. The sizes above are the spec; auto-fit
> handles the wrapping case.

**Ask** (phase D). `outro.display`, Inter SemiBold 34 px (fit to 26, one line), `#5B6470`,
centred on y = 745, under the last step, which stays on screen. Fallback when the narrator wrote
none: `Save this. Try it on your own number.`

### 5.4 Timeline — 30 fps

| phase | frames | what happens |
|---|---|---|
| **A** card in | 8 | Card is **opaque from frame 0** and settles from scale 0.96. Frame 0 is the thumbnail; the first token of the problem is already on it. |
| **B** hook | length of the intro clip, from frame 0 | The hook layout: the problem built large, then `intro.display` lands at ~1.2 s. The spoken hook plays over it. |
| **C** steps | Σ clip durations | Each step holds for exactly its audio clip's measured length and is built token by token inside it. An 8-frame **cross-fade** at every boundary — the outgoing state drifts up and out while the incoming rises in; there is never a frame with an empty card. Title, progress row and wordmark never move; the progress row fills one dot per step. |
| **D** outro | length of the outro clip, or 45 silent frames | The last step stays; the ask builds under it. |
| **E** hold | 12 frames | Cut. |

The blurred background drifts 6 % over the whole post. Nothing on the card is ever fully still.

**There is NO mascot intro.** The lesson opens on the card. A mascot waving does not earn the
opening seconds of a short-form post — the question does, and the first three seconds are the
whole of retention. The mascot walks into his band under the working during the hook, reads
while the lesson runs, and leaves as it ends.

**The hook survives as audio.** It is still the first thing heard, still written to catch someone
in three seconds; it plays over the hook layout rather than over a wave.

**No stopwatch, no hurry overlay.** Those belong to the task format; a lesson has no time pressure
and adding one would tell the viewer to rush the one thing they should not.

Pre-recorded `assets/audio/start_audio/*` is **not used** — the hook voice is generated with the
rest of the narration so it is one performance.

### 5.5 Hard ceiling

Total > **1800 frames (60 s)** fails the run. The Editor is given the chance to cut first; if it
returns blocked, the lesson does not ship.

### 5.6 Fonts

Inter, vendored via `@fontsource/inter` — never the system font, or the capture becomes
machine-dependent and frame determinism is gone.

---

## 6. Correctness gates

**§3.1 independent verification — applies.** Two SymPy scripts per worked example, written blind,
run by the orchestrator. Any disagreement fails the lesson.

**§3.2 applicability and counterexample — applies in full.** Unlike a one-off puzzle, a lesson
teaches a *technique*, so the rule from the original brief is back in force: state precisely when
it works, and give the case where it breaks. `carry_case` is that case. A technique that "seems to
always work" needs either a whitelisted theorem from `core/verify/theorems.json` or an exhaustive
SymPy check over a stated finite domain — an assertion of universality is not evidence.

**§3.3 no gap-filling — applies.** Missing information is `null` plus a machine-readable reason.

**§3.4 random operands — applies.** The worked example's operands come from a seeded draw over a
declared range. This is the lesson case the rule was written for: hand-picked numbers are exactly
how a trick that only works for `23 × 11` survives review.

---

## 7. Output

| what | where |
|---|---|
| video | `output/posts/lessons/<lesson_id>.mp4` |
| ledger entry | `core/content/ledger.json` (concept dedup + the `Math tricks #N` counter) |
| audio clips | `core/out/runs/<run-id>/audio/` |
| run artifacts | `core/out/runs/<run-id>/` |

The video is written **only** when verification passed, the Editor did not block, and the total is
under 60 s. All three are hard conditions in the orchestration script, not judgement calls.

---

## 8. Secrets

The ElevenLabs key lives in `.env`, which is gitignored, and is read as `ELEVENLABS_API_KEY`.
**It is never written into this file, into a prompt, into a run artifact, or into a commit.** If a
key has ever been pasted into a chat, a ticket, or a terminal that syncs, rotate it — a key that
has been seen is a key that is spent.
