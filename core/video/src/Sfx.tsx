/**
 * One short sound at each listed frame. Used for the pop that marks a step or beat landing —
 * motion with a sound has rhythm; motion without one is a slideshow.
 */
import { Audio, Sequence, staticFile } from 'remotion';

export type SfxProps = { src: string; frames: number[]; volume?: number };

export const Sfx: React.FC<SfxProps> = ({ src, frames, volume = 0.5 }) => (
  <>
    {frames.map((f) => (
      <Sequence key={`sfx-${f}`} from={f} durationInFrames={6}>
        <Audio src={staticFile(src)} volume={volume} />
      </Sequence>
    ))}
  </>
);
