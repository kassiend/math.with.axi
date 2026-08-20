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
 * THERE IS NO MASCOT INTRO. The lesson opens on the card with the first step already legible,
 * and the hook narration plays over it. A mascot waving does not earn the opening seconds of a
 * short-form post; the question does. The mascot still stays in the card footer, where it was.
 *
 * The hook still exists as AUDIO — it is the thing that has to catch someone in three seconds.
 * It simply plays over the first step instead of over a wave.
 */
export const CARD_IN_FRAMES = 12;
export const HOLD_FRAMES = 15;

/** Background blur. Constant from frame 0 — there is no sharp phase to ramp from any more. */
export const BLUR_PX = 14;

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
  /** The spoken hook, played over the first step rather than over a mascot. */
  hook: Phase;
  steps: LessonStepPhase[];
  hold: Phase;
  totalFrames: number;
  totalSeconds: number;
  overCeiling: boolean;
}

export interface StepInput { stepId: string; seconds: number }

/**
 * @param introSeconds  measured duration of the intro narration clip
 * @param steps         measured duration of each step's narration clip, in order
 */
export function buildLessonTimeline(introSeconds: number, steps: StepInput[]): LessonTimeline {
  const cardIn = { start: 0, end: CARD_IN_FRAMES };

  // The hook is spoken over the FIRST step, so the viewer reads the problem while hearing why it
  // is interesting. It is a phase rather than a prepended silence because the audio clip is
  // separate and has to be placed on the timeline.
  const hookFrames = Math.max(1, Math.round(introSeconds * FPS));
  const hook = { start: cardIn.end, end: cardIn.end + hookFrames };

  const phases: LessonStepPhase[] = [];
  let cursor = hook.start;
  steps.forEach((s, index) => {
    const frames = Math.max(1, Math.round(s.seconds * FPS));
    // Step 0 stays on screen for the hook as well as for its own line.
    const span = index === 0 ? frames + hookFrames : frames;
    phases.push({ index, stepId: s.stepId, seconds: s.seconds, start: cursor, end: cursor + span });
    cursor += span;
  });

  const hold = { start: cursor, end: cursor + HOLD_FRAMES };
  const totalFrames = hold.end;

  return {
    fps: FPS,
    cardIn, hook, steps: phases, hold,
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

export function stepAt(frame: number, t: LessonTimeline): LessonStepPhase | null {
  return t.steps.find((s) => frame >= s.start && frame < s.end)
      ?? (frame >= t.hold.start ? t.steps[t.steps.length - 1] ?? null : null);
}

/**
 * Body opacity: fades in at the head of a step and out at its tail, so the text swaps while the
 * card is empty rather than cutting mid-glyph. During the closing hold the last step stays solid.
 */
export function bodyOpacity(frame: number, t: LessonTimeline, fade: { in: number; out: number }): number {
  if (frame >= t.hold.start) return 1;
  const step = stepAt(frame, t);
  if (!step) return 0;
  const fadeIn = clamp01((frame - step.start) / Math.max(1, fade.in));
  const fadeOut = clamp01((step.end - frame) / Math.max(1, fade.out));
  return Math.min(fadeIn, fadeOut);
}
