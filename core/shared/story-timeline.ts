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

/** The card is opaque from frame 0 and only settles in scale — frame 0 is the thumbnail. */
export const CARD_IN_FRAMES = 8;
/** Long enough for the ask to be read after the payoff line lands. */
export const HOLD_FRAMES = 36;
export const BLUR_PX = 14;

/** Reels and TikTok's short-form surface both take 90 s comfortably. */
export const MAX_FRAMES = 90 * FPS;

/**
 * Cross-fade at beat boundaries: the outgoing beat drifts up and out while the incoming one rises
 * in, over this many frames. There is never a frame with an empty card — the first renders had a
 * ten-frame blank at every swap, and a blank card is a scroll point.
 */
export const BEAT_FADE = 8;

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

// Extension on purpose: this module is loaded by Node (the orchestrator) as well as by Vite, and
// Node's ESM loader does not guess extensions.
import { mascotPhases, type MascotGeometry, type MascotPhases } from './mascot-phases.ts';
export type { MascotGeometry, SourceSpan } from './mascot-phases.ts';

export interface StoryTimeline {
  fps: number;
  cardIn: Phase;
  beats: StoryBeatPhase[];
  /** The spoken ask, when the narrator wrote one; a silent hold otherwise. */
  outro: Phase & { silent: boolean };
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
  mascot: MascotPhases;
}

export interface BeatInput { beat: string; seconds: number }

export function buildStoryTimeline(
  beats: BeatInput[], mascot: MascotGeometry, outroSeconds: number | null = null,
): StoryTimeline {
  const cardIn = { start: 0, end: CARD_IN_FRAMES };

  const phases: StoryBeatPhase[] = [];
  // Beats start at frame 0 — the card is already there.
  let cursor = 0;
  beats.forEach((b, index) => {
    const frames = Math.max(1, Math.round(b.seconds * FPS));
    phases.push({ index, beat: b.beat, seconds: b.seconds, start: cursor, end: cursor + frames });
    cursor += frames;
  });

  // The ask has landed under the payoff line by now; a spoken outro plays over it, and the hold
  // is what remains after it.
  const silent = outroSeconds == null || outroSeconds <= 0;
  const outroFrames = silent ? 0 : Math.max(1, Math.round(outroSeconds * FPS));
  const outro = { start: cursor, end: cursor + outroFrames, silent };
  cursor = outro.end;

  const hold = { start: cursor, end: cursor + HOLD_FRAMES };
  const totalFrames = hold.end;

  return {
    fps: FPS,
    cardIn,
    beats: phases,
    outro,
    hold,
    totalFrames,
    totalSeconds: Number((totalFrames / FPS).toFixed(3)),
    overCeiling: totalFrames > MAX_FRAMES,
    mascot: mascotPhases(totalFrames, FPS, mascot),
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
export interface StepState extends Phase { index: number; count: number; build: number; fade: number }

export function stepAt(frame: number, beat: Phase, weights: number[]): StepState {
  const count = weights.length;
  if (count <= 1) {
    return { index: 0, count: Math.max(1, count), build: progress(frame, beat), fade: 1, start: beat.start, end: beat.end };
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
      // for the sentence and only dissolves at the seams. Only at the INTERNAL seams: the beat's
      // own cross-fade handles its head and tail, and a step that faded there as well would
      // leave the slot empty for a few frames — a blank card is a scroll point.
      const fadeIn = i > 0 ? clamp01(build / 0.12) : 1;
      const fadeOut = i < count - 1 ? clamp01((1 - build) / 0.08) : 1;
      const start = beat.start + Math.round((acc / total) * span);
      const end = beat.start + Math.round(((acc + w) / total) * span);
      return { index: i, count, build, fade: Math.min(fadeIn, fadeOut), start, end };
    }
    acc += w;
  }
  return { index: count - 1, count, build: 1, fade: 1, start: beat.start, end: beat.end };
}

// --- easing -------------------------------------------------------------------
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const progress = (f: number, p: Phase) => clamp01((f - p.start) / Math.max(1, p.end - p.start));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function beatAt(frame: number, t: StoryTimeline): StoryBeatPhase | null {
  return t.beats.find((b) => frame >= b.start && frame < b.end)
      ?? (frame >= t.outro.start ? t.beats[t.beats.length - 1] ?? null : null);
}

/**
 * How far a drawn visual has built itself, 0 to 1, measured from the start of the beat it belongs
 * to. Holds at 1 once built, and through the outro and the closing hold.
 */
export function beatBuild(frame: number, t: StoryTimeline): number {
  const b = beatAt(frame, t);
  if (!b) return 0;
  if (frame >= t.outro.start) return 1;
  return clamp01((frame - b.start) / Math.max(1, Math.min(BUILD_FRAMES, b.end - b.start)));
}
