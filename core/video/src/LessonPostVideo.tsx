/**
 * Lesson post composition.
 *
 * The captured page supplies the background and the card. Remotion adds what a screenshot cannot
 * carry:
 *
 *   1. the mascot — the same keyed walking take the story uses, in three measured phases, placed
 *      in the band the lesson layout reserves under the working
 *   2. the narration — the hook, one clip per step, and the closing ask, laid end to end at their
 *      measured lengths
 *
 * There is no intro clip. The lesson opens on the card with the problem being built; the hook is
 * audio over that. No stopwatch, no hurry overlay, no ticking. A lesson has no time pressure.
 *
 * Frame numbers come from shared/lesson-timeline.ts, the same module the page used, so a clip
 * cannot land on a frame the page did not draw.
 */
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { MascotTake, type MascotTakeProps } from './MascotTake';
import { Sfx, type SfxProps } from './Sfx';

/** Design units the page works in; the composition renders at 1.5x this. */
const DESIGN_W = 720;
const DESIGN_H = 1280;

export type LessonPostProps = {
  runId: string;
  capture: { publicPath: string; frames: number; fps: number; width: number; height: number };
  mascot: null | MascotTakeProps;
  audio: {
    /** Narration clips in order: the hook, one per step, then the outro when there is one. */
    clips: Array<{ id: string; src: string; from: number; durationInFrames: number }>;
  };
  /** A pop at each step boundary and at the ask. */
  sfx: null | SfxProps;
};

export const lessonPostDefaults: LessonPostProps = {
  runId: 'preview',
  capture: { publicPath: '', frames: 1, fps: 30, width: 1080, height: 1920 },
  mascot: null,
  audio: { clips: [] },
  sfx: null,
};

export const LessonPostVideo: React.FC<LessonPostProps> = ({ capture, mascot, audio, sfx }) => {
  const frame = useCurrentFrame();
  const scale = capture.width / DESIGN_W;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <CaptureLayer publicPath={capture.publicPath} frames={capture.frames} frame={frame} />

      {/* Design-unit space, scaled to the render resolution once, so the mascot box uses the
          same numbers as the page layout. */}
      <AbsoluteFill style={{
        transform: `scale(${scale})`, transformOrigin: 'top left',
        width: DESIGN_W, height: DESIGN_H,
      }}>
        {mascot && <MascotTake {...mascot} src={staticFile(mascot.src)} />}
      </AbsoluteFill>

      {audio.clips.map((c) => (
        <Sequence key={c.id} from={c.from} durationInFrames={c.durationInFrames}>
          <Audio src={staticFile(c.src)} />
        </Sequence>
      ))}
      {sfx && <Sfx {...sfx} />}
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
