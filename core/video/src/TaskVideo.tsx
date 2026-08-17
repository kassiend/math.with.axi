/**
 * Daily-task composition.
 *
 * The captured page supplies the background, the mascot hand-off and the card. Remotion adds the
 * two things a screenshot cannot carry — the video layers and the audio:
 *
 *   1. the keyed intro clip, on top of the captured background, up to the hand-off
 *   2. the keyed hurry clip, during its window
 *   3. audio: one opener, one tick per second of countdown, one mid clip with the hurry overlay
 *
 * Frame numbers come from shared/task-timeline.ts, the same module the page used, so the intro
 * cannot end on a different frame than the still begins on.
 */
import {
  AbsoluteFill, Audio, Img, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame,
} from 'remotion';
import { HURRY } from '../../web/src/task/layout';
import { easeOutCubic, easeInCubic, clamp01, lerp } from '../../shared/task-timeline';

/** Design units the page works in; the composition renders at 1.5x this. */
const DESIGN_W = 720;
const DESIGN_H = 1280;

export type TaskVideoProps = {
  runId: string;
  capture: { publicPath: string; frames: number; fps: number; width: number; height: number };
  intro: {
    src: string;
    endFrame: number;
    /** Retimes the greeting to ~1.5s; see shared/task-timeline.ts. */
    playbackRate?: number;
    /** Absolute CSS box, in design units, from tools/extract-mascot-still.mjs. */
    box: { left: number; top: number; width: number; height: number };
  };
  /** clipSeconds is the keyed clip's own length — the overlay loops it to cover the audio. */
  hurry: null | { src: string; enter: number; exit: number; clipSeconds: number };
  audio: {
    start: string | null;
    tick: string | null;
    tickFrames: number[];
    mid: string | null;
    midFrame: number | null;
  };
};

export const taskVideoDefaults: TaskVideoProps = {
  runId: 'preview',
  capture: { publicPath: '', frames: 1, fps: 30, width: 1080, height: 1920 },
  intro: { src: '', endFrame: 0, playbackRate: 1, box: { left: 0, top: 0, width: 0, height: 0 } },
  hurry: null,
  audio: { start: null, tick: null, tickFrames: [], mid: null, midFrame: null },
};

export const TaskVideo: React.FC<TaskVideoProps> = ({ capture, intro, hurry, audio }) => {
  const frame = useCurrentFrame();
  const scale = capture.width / DESIGN_W;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <CaptureLayer publicPath={capture.publicPath} frames={capture.frames} frame={frame} />

      {/* Design-unit coordinate space, scaled up to the render resolution once. Everything below
          can then use the same numbers the page and the template use. */}
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: 'top left',
                             width: DESIGN_W, height: DESIGN_H }}>
        {intro.src && (
          <Sequence from={0} durationInFrames={intro.endFrame}>
            <AbsoluteFill>
              <OffthreadVideo
                src={staticFile(intro.src)}
                transparent
                muted
                playbackRate={intro.playbackRate ?? 1}
                style={{ position: 'absolute', ...intro.box, objectFit: 'fill' }}
              />
            </AbsoluteFill>
          </Sequence>
        )}

        {hurry && (
          // Inside a Sequence so the clip's own time starts at the entry frame. Without it,
          // OffthreadVideo reads absolute composition time — at frame 605 that seeks 20 s into a
          // 5 s clip, which (with loop) lands near its end where the subject has already left.
          <Sequence
            from={hurry.enter}
            durationInFrames={hurry.exit - hurry.enter + HURRY.exitFrames}
          >
            <HurryLayer
              durationFrames={hurry.exit - hurry.enter}
              src={hurry.src}
              clipFrames={Math.max(1, Math.round(hurry.clipSeconds * capture.fps))}
            />
          </Sequence>
        )}
      </AbsoluteFill>

      {audio.start && <Sequence from={0}><Audio src={staticFile(audio.start)} /></Sequence>}

      {audio.tick && audio.tickFrames.map((f) => (
        <Sequence key={`tick-${f}`} from={f} durationInFrames={4}>
          <Audio src={staticFile(audio.tick!)} volume={0.55} />
        </Sequence>
      ))}

      {audio.mid && audio.midFrame != null && (
        <Sequence from={audio.midFrame}><Audio src={staticFile(audio.mid)} /></Sequence>
      )}
    </AbsoluteFill>
  );
};

/** One PNG per frame, clamped at the end rather than wrapped. */
const CaptureLayer: React.FC<{ publicPath: string; frames: number; frame: number }> = ({
  publicPath, frames, frame,
}) => {
  if (!publicPath || frames <= 0) return null;
  const i = Math.min(Math.max(frame, 0), frames - 1);
  return (
    <AbsoluteFill>
      <Img
        src={staticFile(`${publicPath}/frame-${String(i).padStart(5, '0')}.png`)}
        style={{ width: '100%', height: '100%' }}
      />
    </AbsoluteFill>
  );
};

/**
 * The hurry clip, scaling in when the audio starts and out when it ends. Looped, because the
 * source clips run 0.3–5.1 s while the mid audio runs 0.7–2.2 s — whichever is shorter would
 * otherwise freeze or cut.
 */
const HurryLayer: React.FC<{ src: string; durationFrames: number; clipFrames: number }> = ({
  src, durationFrames, clipFrames,
}) => {
  // Relative to the enclosing Sequence, so 0 is the entry frame and the clip starts at its start.
  const local = useCurrentFrame();

  const inT = easeOutCubic(clamp01(local / HURRY.enterFrames));
  const outT = local >= durationFrames
    ? easeInCubic(clamp01((local - durationFrames) / HURRY.exitFrames))
    : 0;

  const scale = lerp(0.6, 1, inT) * lerp(1, 0.6, outT);
  const opacity = inT * (1 - outT);

  return (
    <div style={{
      position: 'absolute', left: HURRY.x, top: HURRY.y, width: HURRY.w, height: HURRY.h,
      opacity, transform: `scale(${scale.toFixed(4)})`, transformOrigin: 'center center',
    }}>
      {/* OffthreadVideo has no `loop` prop; <Loop> restarts the sequence instead. The clips run
          0.3-5.1 s while the mid audio runs 0.7-2.2 s, so the short ones must repeat or they
          would freeze on their last frame halfway through the overlay. */}
      <Loop durationInFrames={clipFrames}>
        <OffthreadVideo
          src={staticFile(src)}
          transparent
          muted
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </Loop>
    </div>
  );
};
