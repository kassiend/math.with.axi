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
 * The greeting, at the clip's own speed.
 *
 * mas_chromo is 121 frames at 24 fps = 5.0417 s. It was previously squeezed into 1.5 s, which
 * meant a 3.36x playback rate — the wave came out frantic rather than brisk. Retiming a gesture
 * that was animated for one speed does not read as the same gesture faster, it reads as wrong,
 * so the clip now plays at 1x and the intro is as long as the clip.
 *
 * A lesson's intro also carries narration. Whichever of the two is longer sets the phase length;
 * if the narration wins, the clip holds its last frame in the same place, so nothing pops.
 */
export const INTRO_SOURCE_SECONDS = 121 / 24;
export const INTRO_SECONDS = INTRO_SOURCE_SECONDS;
export const INTRO_CLIP_FRAMES = Math.round(INTRO_SECONDS * FPS);        // 151
export const INTRO_PLAYBACK_RATE = 1;

export const HANDOFF_FRAMES = 24;
export const CARD_IN_FRAMES = 14;
export const HOLD_FRAMES = 15;
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
  intro: Phase;
  /** Frame the mascot CLIP stops on. The intro phase can run longer if the narration does. */
  introClipEnd: number;
  handoff: Phase;
  cardIn: Phase;
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
  // The intro runs for whichever is longer: the mascot clip or the narration over it. If the
  // narration outlasts the clip, the clip holds its last frame — which is the same still the
  // hand-off then animates, so nothing jumps.
  const introFrames = Math.max(INTRO_CLIP_FRAMES, Math.round(introSeconds * FPS));

  const intro = { start: 0, end: introFrames };
  const handoff = { start: intro.end, end: intro.end + HANDOFF_FRAMES };
  const cardIn = { start: handoff.end, end: handoff.end + CARD_IN_FRAMES };

  const phases: LessonStepPhase[] = [];
  let cursor = cardIn.end;
  steps.forEach((s, index) => {
    const frames = Math.max(1, Math.round(s.seconds * FPS));
    phases.push({ index, stepId: s.stepId, seconds: s.seconds, start: cursor, end: cursor + frames });
    cursor += frames;
  });

  const hold = { start: cursor, end: cursor + HOLD_FRAMES };
  const totalFrames = hold.end;

  return {
    fps: FPS,
    intro, introClipEnd: Math.min(INTRO_CLIP_FRAMES, intro.end), handoff, cardIn, steps: phases, hold,
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
