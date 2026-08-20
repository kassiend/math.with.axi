/**
 * Lesson post composition.
 *
 * The captured page supplies the background, the card and the mascot. Remotion adds what a
 * screenshot cannot carry:
 *
 *   the narration — one ElevenLabs clip per step, laid end to end at their measured lengths.
 *
 * There is no intro clip. The lesson opens on the card with the first step legible; the hook is
 * audio only, spoken over that first step.
 *
 * No stopwatch, no hurry overlay, no ticking. A lesson has no time pressure.
 *
 * Frame numbers come from shared/lesson-timeline.ts, the same module the page used, so a clip
 * cannot land on a frame the page did not draw.
 */
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame } from 'remotion';

export type LessonPostProps = {
  runId: string;
  capture: { publicPath: string; frames: number; fps: number; width: number; height: number };
  audio: {
    /** Narration clips in order: the intro first, then one per step. */
    clips: Array<{ id: string; src: string; from: number; durationInFrames: number }>;
  };
};

export const lessonPostDefaults: LessonPostProps = {
  runId: 'preview',
  capture: { publicPath: '', frames: 1, fps: 30, width: 1080, height: 1920 },
  audio: { clips: [] },
};

export const LessonPostVideo: React.FC<LessonPostProps> = ({ capture, audio }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <CaptureLayer publicPath={capture.publicPath} frames={capture.frames} frame={frame} />

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
