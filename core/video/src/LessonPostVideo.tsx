/**
 * Lesson post composition.
 *
 * The captured page supplies the background, the mascot hand-off and the card. Remotion adds what
 * a screenshot cannot carry:
 *
 *   1. the keyed intro clip, over the captured background, up to the hand-off
 *   2. the narration — one ElevenLabs clip per step, laid end to end at their measured lengths
 *
 * No stopwatch, no hurry overlay, no ticking. A lesson has no time pressure.
 *
 * Frame numbers come from shared/lesson-timeline.ts, the same module the page used, so the intro
 * cannot end on a different frame than the still begins on.
 */
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';

const DESIGN_W = 720;

export type LessonPostProps = {
  runId: string;
  capture: { publicPath: string; frames: number; fps: number; width: number; height: number };
  intro: {
    src: string;
    /** Frame the mascot clip stops on. The clip is shorter than the intro when narration runs long. */
    clipFrames: number;
    box: { left: number; top: number; width: number; height: number };
  };
  audio: {
    /** Narration clips in order: the intro first, then one per step. */
    clips: Array<{ id: string; src: string; from: number; durationInFrames: number }>;
  };
};

export const lessonPostDefaults: LessonPostProps = {
  runId: 'preview',
  capture: { publicPath: '', frames: 1, fps: 30, width: 1080, height: 1920 },
  intro: { src: '', clipFrames: 0, box: { left: 0, top: 0, width: 0, height: 0 } },
  audio: { clips: [] },
};

export const LessonPostVideo: React.FC<LessonPostProps> = ({ capture, intro, audio }) => {
  const frame = useCurrentFrame();
  const scale = capture.width / DESIGN_W;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <CaptureLayer publicPath={capture.publicPath} frames={capture.frames} frame={frame} />

      {/* Design-unit coordinate space, scaled up to the render resolution once, so everything
          below uses the same numbers as the page and the template. */}
      <AbsoluteFill style={{
        transform: `scale(${scale})`, transformOrigin: 'top left',
        width: DESIGN_W, height: capture.height / scale,
      }}>
        {intro.src && intro.clipFrames > 0 && (
          <Sequence from={0} durationInFrames={intro.clipFrames}>
            <AbsoluteFill>
              <OffthreadVideo
                src={staticFile(intro.src)}
                transparent
                muted
                style={{ position: 'absolute', ...intro.box, objectFit: 'fill' }}
              />
            </AbsoluteFill>
          </Sequence>
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
