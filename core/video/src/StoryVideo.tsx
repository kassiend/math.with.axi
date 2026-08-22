/**
 * Math-story composition.
 *
 * The captured page supplies the background, the card, the title, the visuals and the per-beat
 * text. Remotion adds what a screenshot cannot carry:
 *
 *   1. the mascot — one keyed clip, played in three measured phases
 *   2. the narration — one ElevenLabs clip per beat, at their measured lengths
 *
 * The mascot take is played once and split in three: run it to the pause point, FREEZE that
 * frame while the story runs, then resume so the remaining footage carries him off exactly as the
 * video ends. Freezing rather than looping matters — a looped hold reads as a stutter, while a
 * held frame reads as what he is actually doing, which is standing still and reading.
 */
import { AbsoluteFill, Audio, Freeze, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';

const DESIGN_W = 720;
const DESIGN_H = 1280;

type Span = { start: number; end: number };

export type StoryVideoProps = {
  runId: string;
  capture: { publicPath: string; frames: number; fps: number; width: number; height: number };
  mascot: null | {
    src: string;
    box: { left: number; top: number; width: number; height: number };
    play: Span;
    freeze: Span;
    resume: Span;
    /** The composition frame the take pauses on, and where the resume seeks to. */
    pauseFrame: number;
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
            <MascotSpan span={mascot.play} src={mascot.src} box={mascot.box} />
            <MascotSpan span={mascot.freeze} src={mascot.src} box={mascot.box} freezeAt={mascot.pauseFrame} />
            <MascotSpan span={mascot.resume} src={mascot.src} box={mascot.box} trimBefore={mascot.pauseFrame} />
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
 * One span of the mascot take.
 *
 * The Sequence positions it on the composition timeline; `trimBefore` seeks into the clip;
 * `freezeAt` holds a single frame. Without the Sequence the video reads absolute composition time
 * and every span would show the wrong moment.
 */
const MascotSpan: React.FC<{
  span: Span; src: string;
  box: { left: number; top: number; width: number; height: number };
  trimBefore?: number;
  freezeAt?: number;
}> = ({ span, src, box, trimBefore, freezeAt }) => {
  const duration = span.end - span.start;
  if (duration <= 0) return null;

  const video = (
    <OffthreadVideo
      src={staticFile(src)}
      transparent
      muted
      trimBefore={trimBefore}
      style={{ position: 'absolute', ...box, objectFit: 'fill' }}
    />
  );

  return (
    <Sequence from={span.start} durationInFrames={duration}>
      <AbsoluteFill>
        {freezeAt != null ? <Freeze frame={freezeAt}>{video}</Freeze> : video}
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
