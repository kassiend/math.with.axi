/**
 * Frame -> visual state. Pure, total, and deterministic: given a lesson and a frame number,
 * exactly one layout comes out. No clocks, no randomness.
 *
 * The lesson schema is not defined yet (see core/schema/lesson.schema.TODO.md), so this reads
 * the payload defensively and treats every field as possibly absent. It does NOT invent content
 * for a missing field — a missing section is simply not shown, and the caption says so.
 */
import { FPS, seconds } from './capture-contract';

export interface Beat {
  id: string;
  kind: 'title' | 'method' | 'example' | 'mechanism' | 'applicability' | 'counterexample';
  start: number;   // inclusive frame
  end: number;     // exclusive frame
  data: any;
}

export const DEFAULT_BEAT_SECONDS: Record<Beat['kind'], number> = {
  title: 3,
  method: 7,
  example: 9,
  mechanism: 8,
  applicability: 6,
  counterexample: 8,
};

/**
 * Build the beat list. When the run is audio-locked, `segmentSeconds` maps a beat id to its real
 * narration duration and those win — the audio is fixed and the visuals fit it, never the reverse.
 */
export function buildTimeline(lesson: any, segmentSeconds?: Record<string, number>): Beat[] {
  const beats: Beat[] = [];
  let cursor = 0;

  const push = (id: string, kind: Beat['kind'], data: any) => {
    if (data == null) return;
    const secs = segmentSeconds?.[id] ?? DEFAULT_BEAT_SECONDS[kind];
    const len = seconds(secs);
    beats.push({ id, kind, start: cursor, end: cursor + len, data });
    cursor += len;
  };

  push('title', 'title', lesson?.title ?? null);
  push('method', 'method', lesson?.method ?? null);
  (lesson?.examples ?? []).forEach((ex: any, i: number) => push(`example-${i}`, 'example', ex));
  push('mechanism', 'mechanism', lesson?.mechanism ?? null);
  push('applicability', 'applicability', lesson?.applicability ?? null);
  push('counterexample', 'counterexample', lesson?.counterexample ?? null);

  return beats;
}

export const totalFrames = (beats: Beat[]) => (beats.length ? beats[beats.length - 1].end : 0);

export function beatAt(beats: Beat[], frame: number): Beat | null {
  return beats.find((b) => frame >= b.start && frame < b.end) ?? null;
}

/** 0 -> 1 across the first `overSeconds` of a beat. Linear; easing lives in CSS-free transforms. */
export function progressIn(beat: Beat, frame: number, overSeconds = 0.4): number {
  const span = Math.max(1, overSeconds * FPS);
  return Math.min(1, Math.max(0, (frame - beat.start) / span));
}

/** How many steps of a worked example are revealed at this frame. */
export function revealedSteps(beat: Beat, frame: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  const span = beat.end - beat.start;
  const perStep = span / (stepCount + 1);
  return Math.min(stepCount, Math.floor((frame - beat.start) / perStep));
}
