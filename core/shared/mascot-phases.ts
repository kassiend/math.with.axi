/**
 * The mascot take, placed on a composition timeline. Shared by the story and lesson formats.
 *
 * assets/video/10s.mp4 is one continuous take: he walks in from the left, opens a book, reads,
 * then walks off left again. It is PLAYED to the pause point, FROZEN there while the post runs,
 * then RESUMED so the remaining footage carries him off exactly as the video ends. No loop — a
 * looped hold reads as a stutter, and a held frame reads as what he is doing, which is standing
 * still and reading.
 *
 * Geometry is measured once by tools/story-mascot.mjs into video/public/mascot/story-mascot.json.
 */

export interface Phase { start: number; end: number }

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
  rest_rect?: { x: number; y: number; w: number; h: number };
}

export interface MascotPhases {
  play: Phase;
  freeze: Phase;
  resume: Phase;
  /** The composition frame the take is paused on, and where the resume seeks to. */
  pauseFrame: number;
}

export function mascotPhases(totalFrames: number, fps: number, m: MascotGeometry): MascotPhases {
  // Source frames are at the clip's own rate; composition frames are at FPS. Convert once.
  const toComp = (srcFrames: number) => Math.round((srcFrames / m.source_fps) * fps);
  const pauseFrame = toComp(m.phases.play.to);
  const resumeFrames = toComp(m.phases.resume.to - m.phases.resume.from);

  // The resume is anchored to the END of the video, so he clears the frame as it finishes. If the
  // post is too short to fit both halves, the freeze collapses rather than the exit being cut.
  const resumeStart = Math.max(pauseFrame, totalFrames - resumeFrames);

  return {
    play: { start: 0, end: Math.min(pauseFrame, resumeStart) },
    freeze: { start: Math.min(pauseFrame, resumeStart), end: resumeStart },
    resume: { start: resumeStart, end: totalFrames },
    pauseFrame,
  };
}

/**
 * The clip's placement box, moved so the mascot comes to rest at `rest` instead of where the
 * measurement put him. The box keeps its size; only its origin shifts.
 */
export function mascotBoxAt(
  m: MascotGeometry, rest: { x: number; y: number },
): MascotGeometry['box'] {
  const measured = m.rest_rect ?? { x: 310, y: 150 };
  return {
    ...m.box,
    left: m.box.left + (rest.x - measured.x),
    top: m.box.top + (rest.y - measured.y),
  };
}
