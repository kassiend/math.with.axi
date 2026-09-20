/**
 * Phase math for a lesson post. Imported by BOTH the capture page and the Remotion composition,
 * so the two cannot drift.
 *
 * The shape of the timeline differs from a task in one important way: a task's body has a length
 * chosen up front (the countdown), while a lesson's body is however long the narration turned out
 * to be. Every step holds for exactly its own audio clip. The audio never stretches to fit the
 * visuals; the visuals hold for the audio.
 *
 * Numbers match assets/templates/lesson/lesson.md section 5.4.
 */

export const FPS = 30;
export const FRAME_W = 720;
export const FRAME_H = 1280;

/**
 * THERE IS NO MASCOT INTRO. The lesson opens on the card with the problem already legible, and
 * the hook narration plays over it. A mascot waving does not earn the opening seconds of a
 * short-form post; the question does.
 *
 * The hook phase is not "step 1 with audio over it" any more. Reviewing the first renders: the
 * card showed `Multiply by 11 / 92 × 11 = ?` for the six-second hook and then AGAIN for step 1,
 * which re-posed the same problem — thirteen seconds on one frame. Now the hook has its own
 * layout: the problem large, built digit by digit, with the spoken hook's on-screen line under
 * it. Step 1 then arrives as a change.
 */
export const CARD_IN_FRAMES = 8;
export const HOLD_FRAMES = 12;

/**
 * When the narrator supplied no outro clip, the closing ask still appears — silently — for this
 * long. A post that ends on the answer and cuts asks for nothing, and gets it.
 */
export const SILENT_OUTRO_FRAMES = 45;

/** Background blur. Constant from frame 0 — there is no sharp phase to ramp from any more. */
export const BLUR_PX = 14;

/**
 * Where the animated mascot comes to rest — the story's walking take, composited by Remotion in
 * the band under the working. Design units. Lives here rather than in the page layout because the
 * orchestrator needs it too and cannot import the page's modules.
 */
export const MASCOT_REST = { x: 310, y: 790, w: 100, h: 155 };

/** Hard ceiling from the brief: one minute. */
export const MAX_FRAMES = 60 * FPS;

export interface Phase { start: number; end: number }

export interface LessonStepPhase extends Phase {
  index: number;
  stepId: string;
  seconds: number;
}

export interface LessonTimeline {
  fps: number;
  cardIn: Phase;
  /** The spoken hook, over the hero layout of the first step's problem. */
  hook: Phase;
  steps: LessonStepPhase[];
  /** The closing ask. Its own clip when the narrator wrote one, a silent hold otherwise. */
  outro: Phase & { silent: boolean };
  hold: Phase;
  totalFrames: number;
  totalSeconds: number;
  overCeiling: boolean;
}

export interface StepInput { stepId: string; seconds: number }

/**
 * @param introSeconds  measured duration of the intro narration clip
 * @param steps         measured duration of each step's narration clip, in order
 * @param outroSeconds  measured duration of the outro clip, or null when there is none
 */
export function buildLessonTimeline(
  introSeconds: number,
  steps: StepInput[],
  outroSeconds: number | null = null,
): LessonTimeline {
  const cardIn = { start: 0, end: CARD_IN_FRAMES };

  // The hook starts at frame 0: the card is already there, the problem is already being built.
  const hookFrames = Math.max(1, Math.round(introSeconds * FPS));
  const hook = { start: 0, end: hookFrames };

  const phases: LessonStepPhase[] = [];
  let cursor = hook.end;
  steps.forEach((s, index) => {
    const frames = Math.max(1, Math.round(s.seconds * FPS));
    phases.push({ index, stepId: s.stepId, seconds: s.seconds, start: cursor, end: cursor + frames });
    cursor += frames;
  });

  const silent = outroSeconds == null || outroSeconds <= 0;
  const outroFrames = silent ? SILENT_OUTRO_FRAMES : Math.max(1, Math.round(outroSeconds * FPS));
  const outro = { start: cursor, end: cursor + outroFrames, silent };
  cursor = outro.end;

  const hold = { start: cursor, end: cursor + HOLD_FRAMES };
  const totalFrames = hold.end;

  return {
    fps: FPS,
    cardIn, hook, steps: phases, outro, hold,
    totalFrames,
    totalSeconds: Number((totalFrames / FPS).toFixed(3)),
    overCeiling: totalFrames > MAX_FRAMES,
  };
}

// --- easing -------------------------------------------------------------------
// Frame-driven. No CSS transitions anywhere: a transition is time-based and would render
// differently depending on how fast the capture loop happens to run.

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const progress = (f: number, p: Phase) => clamp01((f - p.start) / Math.max(1, p.end - p.start));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const inHook = (frame: number, t: LessonTimeline) => frame < t.hook.end;

/** The step whose phase contains the frame; the last step through the outro and hold. */
export function stepAt(frame: number, t: LessonTimeline): LessonStepPhase | null {
  return t.steps.find((s) => frame >= s.start && frame < s.end)
      ?? (frame >= t.outro.start ? t.steps[t.steps.length - 1] ?? null : null);
}

/**
 * How much of a step's span a diagram takes to build itself. The remainder holds the finished
 * state, which is the part the viewer actually reads.
 *
 * A lesson diagram gets the whole step rather than the story format's fixed 1.5 s: here the build
 * IS the teaching — the lines going down one at a time is the method — so it has to advance with
 * the sentence explaining it, not race ahead and wait. Holds at 1 through the outro and hold.
 */
export const VISUAL_BUILD_SHARE = 0.85;

export function visualBuild(frame: number, t: LessonTimeline): number {
  const step = stepAt(frame, t);
  if (!step) return 0;
  const span = Math.max(1, step.end - step.start);
  return clamp01((frame - step.start) / (span * VISUAL_BUILD_SHARE));
}
