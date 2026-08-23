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
  pause_at_seconds: number;
  phases: { play: SourceSpan; freeze: SourceSpan; resume: SourceSpan };
  seconds: { play: number; resume: number };
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
  /**
   * The mascot take, played once and split in three: run it to the pause point, hold that frame
   * while the story runs, then resume so the remaining footage carries him off exactly as the
   * video ends. No loop — a looped hold reads as a stutter, and a frozen frame reads as someone
   * standing still, which is what he is doing.
   */
  mascot: {
    play: Phase;
    freeze: Phase;
    resume: Phase;
    /** The composition frame the take is paused on, and where the resume seeks to. */
    pauseFrame: number;
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
  const pauseFrame = toComp(mascot.phases.play.to);
  const resumeFrames = toComp(mascot.phases.resume.to - mascot.phases.resume.from);

  // The resume is anchored to the END of the video, so he clears the frame as it finishes. If the
  // story is too short to fit both halves, the freeze collapses rather than the exit being cut.
  const resumeStart = Math.max(pauseFrame, totalFrames - resumeFrames);

  return {
    fps: FPS,
    cardIn,
    beats: phases,
    hold,
    totalFrames,
    totalSeconds: Number((totalFrames / FPS).toFixed(3)),
    overCeiling: totalFrames > MAX_FRAMES,
    mascot: {
      play: { start: 0, end: Math.min(pauseFrame, resumeStart) },
      freeze: { start: Math.min(pauseFrame, resumeStart), end: resumeStart },
      resume: { start: resumeStart, end: totalFrames },
      pauseFrame,
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
