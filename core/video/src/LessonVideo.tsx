/**
 * Final composition.
 *
 * Three layers, bottom to top:
 *   1. the Playwright PNG sequence — the lesson itself, already rendered and frozen
 *   2. the mascot, a chroma-keyed alpha WebM produced by tools/chromakey.mjs
 *   3. the hand-authored narration audio
 *
 * Remotion does no typesetting and no layout of mathematics. Every formula was rendered once, by
 * KaTeX, in the captured page. Re-rendering it here would mean two sources of truth for what the
 * viewer sees.
 */
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';

// A type alias, not an interface: Remotion's Composition constrains props to
// Record<string, unknown>, and TypeScript only gives implicit index signatures to type aliases.
export type LessonProps = {
  runId: string;
  capture: { publicPath: string; frames: number; fps: number };
  audio: Array<{ id: string; seconds: number; src: string }>;
  mascot: null | {
    src: string;              // path inside video/public, an alpha WebM
    startFrame?: number;
    width?: number;
    right?: number;
    bottom?: number;
  };
};

export const lessonSchemaProps: LessonProps = {
  runId: 'preview',
  capture: { publicPath: '', frames: 1, fps: 30 },
  audio: [],
  mascot: null,
};

export const LessonVideo: React.FC<LessonProps> = ({ capture, audio, mascot }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0d12' }}>
      <CaptureLayer publicPath={capture.publicPath} frames={capture.frames} frame={frame} />
      {mascot && <MascotLayer {...mascot} />}
      <AudioTrack segments={audio} fps={capture.fps} />
    </AbsoluteFill>
  );
};

/**
 * One PNG per frame. Clamped rather than wrapped: running past the last captured frame should
 * hold the final image, not silently loop back to the start of the lesson.
 */
const CaptureLayer: React.FC<{ publicPath: string; frames: number; frame: number }> = ({
  publicPath, frames, frame,
}) => {
  if (!publicPath || frames <= 0) return null;
  const i = Math.min(Math.max(frame, 0), frames - 1);
  const name = `frame-${String(i).padStart(5, '0')}.png`;
  return (
    <AbsoluteFill>
      <Img src={staticFile(`${publicPath}/${name}`)} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
};

/**
 * The mascot source clips carry no alpha channel (they are yuv420p VP9/H.264), so the alpha is
 * produced ahead of time by tools/chromakey.mjs. If `src` still points at a non-keyed file the
 * mascot will render as an opaque rectangle — that is a visible failure, on purpose, rather than
 * a silent one.
 */
const MascotLayer: React.FC<NonNullable<LessonProps['mascot']>> = ({
  src, startFrame = 0, width = 520, right = 0, bottom = 0,
}) => (
  <Sequence from={startFrame}>
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-end' }}>
      <OffthreadVideo
        src={staticFile(src)}
        transparent
        muted
        style={{ width, marginRight: right, marginBottom: bottom }}
      />
    </AbsoluteFill>
  </Sequence>
);

/** Segments are laid end to end at their measured durations. Nothing is stretched to fit. */
const AudioTrack: React.FC<{ segments: LessonProps['audio']; fps: number }> = ({ segments, fps }) => {
  let cursor = 0;
  return (
    <>
      {segments.map((seg) => {
        const from = cursor;
        const len = Math.round(seg.seconds * fps);
        cursor += len;
        return (
          <Sequence key={seg.id} from={from} durationInFrames={len}>
            <Audio src={staticFile(seg.src)} />
          </Sequence>
        );
      })}
    </>
  );
};
