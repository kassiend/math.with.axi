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

/**
 * How long a drawn visual takes to build itself, in frames.
 *
 * 1.5 s. A curve that draws in front of the viewer shows where the shape comes from; the same
 * curve fading in is a slide. Long enough to be watched, short enough that the finished state
 * still holds for most of the beat — a build running to the end of the beat never resolves.
 */
export const BUILD_FRAMES = 45;

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

/**
 * Which visual step is showing inside a beat, and how far through its own slice it is.
 *
 * A long beat — the mechanism runs 35 s — cannot hold one static picture without the viewer
 * reading it in the first two seconds and then waiting out the narration. Instead the beat carries
 * an ordered list of steps, each weighted by the WORD COUNT of the narration it illustrates.
 * Speech runs at a near-constant rate (measured 2.27 words/s), so a step sized to its words is a
 * step that lasts as long as the sentence it belongs to — the picture advances with the voice
 * without any word-level timestamps, which eleven_v3 does not provide.
 *
 * Returns the active step index, the count, and `build` — progress 0..1 through that step's own
 * time, which an animation or a draw-on uses to move inside the step. `fade` eases the swap so a
 * step change happens between pictures, not mid-stroke.
 */
export interface StepState { index: number; count: number; build: number; fade: number }

export function stepAt(frame: number, beat: Phase, weights: number[]): StepState {
  const count = weights.length;
  if (count <= 1) {
    return { index: 0, count: Math.max(1, count), build: progress(frame, beat), fade: 1 };
  }
  const total = weights.reduce((a, w) => a + Math.max(0, w), 0) || count;
  const span = Math.max(1, beat.end - beat.start);
  const local = clamp01((frame - beat.start) / span) * total;   // position in "weight units"

  let acc = 0;
  for (let i = 0; i < count; i++) {
    const w = Math.max(0, weights[i]) || total / count;
    if (local < acc + w || i === count - 1) {
      const build = clamp01((local - acc) / Math.max(1e-6, w));
      // Fade in over the first ~12% of a step and out over the last ~8%, so the picture is solid
      // for the sentence and only dissolves at the seams.
      const fade = Math.min(clamp01(build / 0.12), clamp01((1 - build) / 0.08));
      return { index: i, count, build, fade };
    }
    acc += w;
  }
  return { index: count - 1, count, build: 1, fade: 1 };
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

/**
 * How far a drawn visual has built itself, 0 to 1, measured from the start of the beat it belongs
 * to. Holds at 1 once built, and through the closing hold.
 */
export function beatBuild(frame: number, t: StoryTimeline): number {
  const b = beatAt(frame, t);
  if (!b) return 0;
  if (frame >= t.hold.start) return 1;
  return clamp01((frame - b.start) / Math.max(1, Math.min(BUILD_FRAMES, b.end - b.start)));
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
