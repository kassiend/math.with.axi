/**
 * Phase math for a daily-task post. Imported by BOTH the capture page and the Remotion
 * composition, so the two can never drift: the page draws the card at frame 176 because this
 * module says so, and Remotion stops the intro video at frame 151 for the same reason.
 *
 * Every visual is a pure function of the frame index. Nothing here reads a clock.
 *
 * Numbers match assets/templates/tasks/task-20s.md §6 exactly. Changing one changes the template.
 */

export const FPS = 30;
export const FRAME_W = 720;
export const FRAME_H = 1280;

/** mas_chromo is 121 frames at 24 fps = 5.0417 s, which is 151.25 frames at 30 fps. */
export const INTRO_FRAMES = 152;
export const HANDOFF_FRAMES = 24;
export const CARD_IN_FRAMES = 14;
export const HOLD_FRAMES = 15;

/** Background blur at rest, in px. Ramps up across the hand-off. */
export const BLUR_PX = 14;

/** The hurry overlay enters somewhere in this window of the countdown. */
export const HURRY_WINDOW = [0.60, 0.80] as const;

export interface Phase { start: number; end: number }

export interface TaskTimeline {
  fps: number;
  durationS: number;
  intro: Phase;
  handoff: Phase;
  cardIn: Phase;
  timer: Phase;
  hold: Phase;
  totalFrames: number;
  tickFrames: number[];
  hurry: { enter: number; exit: number; audioFrames: number };
}

/** Deterministic [0,1) from an integer seed — same value on every machine. */
function unitFromSeed(seed: number): number {
  let a = (seed >>> 0) + 0x6d2b79f5;
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}

/**
 * @param durationS  countdown length — 20 or 40. NOT the video length.
 * @param seed       recorded in the run log so a post can be rebuilt frame-identical.
 * @param hurryAudioSeconds  measured duration of the chosen mid_audio clip.
 */
export function buildTaskTimeline(
  durationS: number,
  seed: number,
  hurryAudioSeconds: number,
): TaskTimeline {
  const timerFrames = Math.round(durationS * FPS);

  const intro = { start: 0, end: INTRO_FRAMES };
  const handoff = { start: intro.end, end: intro.end + HANDOFF_FRAMES };
  const cardIn = { start: handoff.end, end: handoff.end + CARD_IN_FRAMES };
  const timer = { start: cardIn.end, end: cardIn.end + timerFrames };
  const hold = { start: timer.end, end: timer.end + HOLD_FRAMES };

  // One tick per second of countdown, none on the final frame.
  const tickFrames = Array.from({ length: durationS }, (_, k) => timer.start + k * FPS);

  const u = HURRY_WINDOW[0] + unitFromSeed(seed) * (HURRY_WINDOW[1] - HURRY_WINDOW[0]);
  const enter = timer.start + Math.round(timerFrames * u);
  const audioFrames = Math.max(1, Math.round(hurryAudioSeconds * FPS));

  return {
    fps: FPS,
    durationS,
    intro, handoff, cardIn, timer, hold,
    totalFrames: hold.end,
    tickFrames,
    hurry: { enter, exit: enter + audioFrames, audioFrames },
  };
}

// --- easing -------------------------------------------------------------------
// Frame-driven, so these are plain functions of progress. No CSS transitions anywhere: a
// transition is time-based and would render differently depending on capture speed.

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const progress = (f: number, p: Phase) => clamp01((f - p.start) / Math.max(1, p.end - p.start));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Fraction of the countdown still remaining at this frame — drives the depleting ring. */
export function timerRemaining(frame: number, t: TaskTimeline): number {
  if (frame < t.timer.start) return 1;
  if (frame >= t.timer.end) return 0;
  return 1 - (frame - t.timer.start) / (t.timer.end - t.timer.start);
}

/** Whole seconds left, for a numeric readout if one is ever added. */
export function secondsLeft(frame: number, t: TaskTimeline): number {
  return Math.max(0, Math.ceil((t.timer.end - frame) / t.fps));
}
