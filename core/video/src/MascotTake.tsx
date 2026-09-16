/**
 * The mascot take as a Remotion layer — one keyed clip, played in three measured phases.
 * Shared by the story and lesson compositions; the phase maths lives in shared/mascot-phases.ts.
 *
 * Rendered inside the design-unit coordinate space (720x1280), so `box` is in the same numbers the
 * page and the template use.
 */
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence } from 'remotion';

type Span = { start: number; end: number };

export type MascotTakeProps = {
  src: string;
  box: { left: number; top: number; width: number; height: number };
  play: Span;
  freeze: Span;
  resume: Span;
  /** The composition frame the take pauses on, and where the resume seeks to. */
  pauseFrame: number;
};

export const MascotTake: React.FC<MascotTakeProps> = ({ src, box, play, freeze, resume, pauseFrame }) => (
  <>
    <MascotSpan span={play} src={src} box={box} />
    <MascotSpan span={freeze} src={src} box={box} freezeAt={pauseFrame} />
    <MascotSpan span={resume} src={src} box={box} trimBefore={pauseFrame} />
  </>
);

/**
 * One span of the take. The Sequence positions it on the composition timeline; `trimBefore` seeks
 * into the clip; `freezeAt` holds a single frame. Without the Sequence the video reads absolute
 * composition time and every span would show the wrong moment.
 */
const MascotSpan: React.FC<{
  span: Span; src: string;
  box: MascotTakeProps['box'];
  trimBefore?: number;
  freezeAt?: number;
}> = ({ span, src, box, trimBefore, freezeAt }) => {
  const duration = span.end - span.start;
  if (duration <= 0) return null;

  const video = (
    <OffthreadVideo
      src={src}
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
