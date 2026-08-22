/**
 * Phase math for a math-story post. Imported by BOTH the capture page and the Remotion
 * composition, so the two cannot drift.
 *
 * Like a lesson, the body length is whatever the narration turned out to be: each beat holds for
 * exactly its own audio clip. Unlike a lesson, a mascot walks through the whole thing, and its
 * three phases are measured from the clip rather than assumed — see tools/story-mascot.mjs.
 */

export const FPS = 30;
export const FRAME_W = 720;
export const FRAME_H = 1280;

export const CARD_IN_FRAMES = 12;
export const HOLD_FRAMES = 15;
export const BLUR_PX = 14;

/** Reels and TikTok's short-form surface both take 90 s comfortably. */
export const MAX_FRAMES = 90 * FPS;

/** Cross-fade at beat boundaries, so text swaps while the card is empty rather than mid-glyph. */
export const BEAT_FADE = { in: 6, out: 4 };

export interface Phase { start: number; end: number }

export interface StoryBeatPhase extends Phase {
  index: number;
  beat: string;
  seconds: number;
}

/** A span of SOURCE frames as tools/story-mascot.mjs writes it. */
export interface SourceSpan { from: number; to: number }

/** Measured from the clip by tools/story-mascot.mjs, in SOURCE frames at its own fps. */
export interface MascotGeometry {
  source: string;
  source_fps: number;
  source_frames: number;
  phases: { enter: SourceSpan; rest: SourceSpan; exit: SourceSpan };
  seconds: { enter: number; rest: number; exit: number };
  box: { left: number; top: number; width: number; height: number };
}

export interface StoryTimeline {
  fps: number;
  cardIn: Phase;
  beats: StoryBeatPhase[];
  hold: Phase;
  totalFrames: number;
  totalSeconds: number;
  overCeiling: boolean;
  /** Composition-frame windows for the three mascot phases. */
  mascot: {
    enter: Phase;
    rest: Phase;
    exit: Phase;
    /** Where to seek into the clip for each phase, in composition frames. */
    seek: { enter: number; rest: number; exit: number };
    restLoopFrames: number;
  };
}

export interface BeatInput { beat: string; seconds: number }

export function buildStoryTimeline(beats: BeatInput[], mascot: MascotGeometry): StoryTimeline {
  const cardIn = { start: 0, end: CARD_IN_FRAMES };

  const phases: StoryBeatPhase[] = [];
  let cursor = cardIn.end;
  beats.forEach((b, index) => {
    const frames = Math.max(1, Math.round(b.seconds * FPS));
    phases.push({ index, beat: b.beat, seconds: b.seconds, start: cursor, end: cursor + frames });
    cursor += frames;
  });

  const hold = { start: cursor, end: cursor + HOLD_FRAMES };
  const totalFrames = hold.end;

  // Source frames are at the clip's own rate; composition frames are at FPS. Convert once.
  const toComp = (srcFrames: number) => Math.round((srcFrames / mascot.source_fps) * FPS);
  const enterFrames = toComp(mascot.phases.enter.to - mascot.phases.enter.from);
  const exitFrames = toComp(mascot.phases.exit.to - mascot.phases.exit.from);
  const restLoopFrames = toComp(mascot.phases.rest.to - mascot.phases.rest.from);

  // The exit is anchored to the END of the video, so he clears the frame exactly as it finishes.
  const exitStart = Math.max(enterFrames, totalFrames - exitFrames);

  return {
    fps: FPS,
    cardIn,
    beats: phases,
    hold,
    totalFrames,
    totalSeconds: Number((totalFrames / FPS).toFixed(3)),
    overCeiling: totalFrames > MAX_FRAMES,
    mascot: {
      enter: { start: 0, end: Math.min(enterFrames, exitStart) },
      rest: { start: Math.min(enterFrames, exitStart), end: exitStart },
      exit: { start: exitStart, end: totalFrames },
      seek: {
        enter: toComp(mascot.phases.enter.from),
        rest: toComp(mascot.phases.rest.from),
        exit: toComp(mascot.phases.exit.from),
      },
      restLoopFrames: Math.max(1, restLoopFrames),
    },
  };
}

// --- easing -------------------------------------------------------------------
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const progress = (f: number, p: Phase) => clamp01((f - p.start) / Math.max(1, p.end - p.start));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function beatAt(frame: number, t: StoryTimeline): StoryBeatPhase | null {
  return t.beats.find((b) => frame >= b.start && frame < b.end)
      ?? (frame >= t.hold.start ? t.beats[t.beats.length - 1] ?? null : null);
}

/** Fades in at the head of a beat and out at its tail; solid through the closing hold. */
export function beatOpacity(frame: number, t: StoryTimeline): number {
  if (frame >= t.hold.start) return 1;
  const b = beatAt(frame, t);
  if (!b) return 0;
  return Math.min(
    clamp01((frame - b.start) / Math.max(1, BEAT_FADE.in)),
    clamp01((b.end - frame) / Math.max(1, BEAT_FADE.out)),
  );
}
