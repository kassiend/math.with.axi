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

### 2.2 What makes a good lesson topic

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
[excited] Heey — how do you solve 23 times 11 in your head? [pause] Watch this.
[curious] Take the two digits apart. [pause] Two … and three.
[confident] Add them. Two plus three is five. [pause]
[excited] Now drop the five right between them. Two-five-three. That's it.
[warm] Try it on your own number. [pause] Tell me what you got.
```

Rules that matter:

- **`[pause]` is a short beat**, roughly a third of a second. It is not a timed hold. If a longer
  gap is needed, end the step there and let the step boundary carry the silence — a 30-second
  pause inside a 60-second video is not a thing.
- **One or two tags per step**, at the start of the phrase they colour. Tags sprayed across every
  clause make the read theatrical and worse.
- **Say the numbers as words** where the model would otherwise misread them: `23 × 11` reads
  cleanly as "twenty-three times eleven", not as "twenty-three ex eleven".
- **Never put a tag inside a number or formula.**
- Useful tags for this format: `[excited]`, `[curious]`, `[confident]`, `[warm]`, `[thoughtful]`,
  `[whispers]` for an aside. Avoid the comedic ones — this is a teacher, not a bit.

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
    "narration": "[excited] Heey — how do you solve 23 times 11 in your head? [pause] Watch this.",
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
| mascot still | x 174, y 997, w 86, h 132 |
| wordmark | `math with Axi`, Inter SemiBold 36 px, `#000000`, left x = 324, baseline y = 1074 |

### 5.2 Title — the series counter

`Math tricks #N`, Inter ExtraBold 40 px, `#000000`, centred on x = 360, cap band y 243–273.

**N is read from the ledger, never invented**: one more than the highest counter already shipped.
It appears on **every** step of the lesson, unchanged — it identifies the post, not the step.

### 5.3 Step body

Two lines, centred as a group on **y = 561**, centred on x = 360, max width 500.

| line | colour | weight | size | measured band |
|---|---|---|---|---|
| instruction | `#000000` | ExtraBold 800 | 50 px | y 494–532 |
| working | `#1E76C3` | ExtraBold 800 | 52 px | y 591–628 |

Gap between the two blocks: 59 px. Each line auto-fits **down to 34 px** in 2 px steps if it wraps
past its allowance — instruction max 2 lines, working max 3. **If either still does not fit at
34 px, the step is rejected**: shorten the display text. Do not overflow the card, do not clip.

> The mockups disagree slightly on the working-line size — `step2.png` renders it larger than
> `step1/3.png` because its text wraps to two lines. The sizes above are the spec; auto-fit
> handles the wrapping case.

### 5.4 Timeline — 30 fps

| phase | frames | what happens |
|---|---|---|
| **A** intro | 0 → `max(152, intro_audio)` | `mas_chromo` keyed over the background, **intro narration from ElevenLabs** plays from frame 0. If the narration outlasts the clip, the clip holds its last frame. |
| **B** hand-off | 24 frames | Last frame of `mas_chromo` freezes and animates into the footer slot; background blur ramps 0 → 14 px. |
| **C** card in | 14 frames | Card scales 0.85 → 1.00, fades in from centre. |
| **D** steps | Σ clip durations | Each step holds for exactly its audio clip's measured length. Cross-fade 8 frames between steps; text swaps, title and footer never move. |
| **E** hold | 15 frames | Last step stays readable. Cut. |

**No stopwatch, no hurry overlay.** Those belong to the task format; a lesson has no time pressure
and adding one would tell the viewer to rush the one thing they should not.

Pre-recorded `assets/audio/start_audio/*` is **not used** — the intro voice is generated with the
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
