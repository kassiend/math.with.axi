/**
 * A music bed under the narration, ducked while the voice is speaking.
 *
 * The envelope is a pure function of the frame: `bed` volume in the gaps, `duck` volume while any
 * narration clip is playing, with short ramps either side so the change is felt as a dip rather
 * than heard as a cut. Fades in over the first half-second and out over the last second.
 */
import { Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export type MusicBedProps = {
  src: string;
  /** Narration spans, in composition frames — the bed ducks inside them. */
  speech: Array<{ from: number; to: number }>;
  bed?: number;
  duck?: number;
  rampFrames?: number;
  totalFrames: number;
};

export const MusicBed: React.FC<MusicBedProps> = ({
  src, speech, bed = 0.55, duck = 0.2, rampFrames = 10, totalFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // How deep in speech the frame is: 1 inside a clip, ramping to 0 outside.
  let inSpeech = 0;
  for (const s of speech) {
    const lead = Math.min(1, Math.max(0, (frame - (s.from - rampFrames)) / rampFrames));
    const tail = Math.min(1, Math.max(0, ((s.to + rampFrames) - frame) / rampFrames));
    inSpeech = Math.max(inSpeech, Math.min(lead, tail));
  }
  const level = bed + (duck - bed) * inSpeech;
  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [totalFrames - fps, totalFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return <Audio src={staticFile(src)} volume={Math.max(0, level * fadeIn * fadeOut)} />;
};
