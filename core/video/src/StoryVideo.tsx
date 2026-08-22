/**
 * Math-story composition.
 *
 * The captured page supplies the background, the card, the title, the visuals and the per-beat
 * text. Remotion adds what a screenshot cannot carry:
 *
 *   1. the mascot — one keyed clip, played in three measured phases
 *   2. the narration — one ElevenLabs clip per beat, at their measured lengths
 *
 * The mascot walks in and opens a book, holds while the story runs, and walks off so that he
 * clears the frame exactly as the video ends. All three phases come from ONE take, seeked to
 * different points: splicing a second clip in would make him jump, since the other available
 * clip is a different aspect and a different scale.
 */
import { AbsoluteFill, Audio, Img, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';

const DESIGN_W = 720;
const DESIGN_H = 1280;

type Span = { start: number; end: number };

export type StoryVideoProps = {
  runId: string;
  capture: { publicPath: string; frames: number; fps: number; width: number; height: number };
  mascot: null | {
    src: string;
    box: { left: number; top: number; width: number; height: number };
    enter: Span;
    rest: Span;
    exit: Span;
    /** Where to seek into the clip for each phase, in composition frames. */
    seek: { enter: number; rest: number; exit: number };
    restLoopFrames: number;
  };
  audio: { clips: Array<{ id: string; src: string; from: number; durationInFrames: number }> };
};

export const storyVideoDefaults: StoryVideoProps = {
  runId: 'preview',
  capture: { publicPath: '', frames: 1, fps: 30, width: 1080, height: 1920 },
  mascot: null,
  audio: { clips: [] },
};

export const StoryVideo: React.FC<StoryVideoProps> = ({ capture, mascot, audio }) => {
  const frame = useCurrentFrame();
  const scale = capture.width / DESIGN_W;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <CaptureLayer publicPath={capture.publicPath} frames={capture.frames} frame={frame} />

      {/* Design-unit space, scaled to the render resolution once, so the numbers below match the
          page and the template. */}
      <AbsoluteFill style={{
        transform: `scale(${scale})`, transformOrigin: 'top left',
        width: DESIGN_W, height: DESIGN_H,
      }}>
        {mascot && (
          <>
            <MascotPhase span={mascot.enter} seek={mascot.seek.enter} src={mascot.src} box={mascot.box} />
            {/* The hold is a short stretch of the same take, looped — a frozen mascot for forty
                seconds reads as a broken render rather than as someone reading. */}
            <MascotPhase
              span={mascot.rest} seek={mascot.seek.rest} src={mascot.src} box={mascot.box}
              loopFrames={mascot.restLoopFrames}
            />
            <MascotPhase span={mascot.exit} seek={mascot.seek.exit} src={mascot.src} box={mascot.box} />
          </>
        )}
      </AbsoluteFill>

      {audio.clips.map((c) => (
        <Sequence key={c.id} from={c.from} durationInFrames={c.durationInFrames}>
          <Audio src={staticFile(c.src)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/**
 * One phase of the mascot take. `trimBefore` seeks into the clip; the Sequence positions it on
 * the composition timeline. Without the Sequence the video would read absolute composition time
 * and every phase would show the wrong moment.
 */
const MascotPhase: React.FC<{
  span: Span; seek: number; src: string;
  box: { left: number; top: number; width: number; height: number };
  loopFrames?: number;
}> = ({ span, seek, src, box, loopFrames }) => {
  const duration = span.end - span.start;
  if (duration <= 0) return null;

  const video = (
    <OffthreadVideo
      src={staticFile(src)}
      transparent
      muted
      trimBefore={seek}
      style={{ position: 'absolute', ...box, objectFit: 'fill' }}
    />
  );

  return (
    <Sequence from={span.start} durationInFrames={duration}>
      <AbsoluteFill>
        {loopFrames ? <Loop durationInFrames={loopFrames}>{video}</Loop> : video}
      </AbsoluteFill>
    </Sequence>
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
      <Img src={staticFile(`${publicPath}/frame-${String(i).padStart(5, '0')}.png`)}
           style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
};
