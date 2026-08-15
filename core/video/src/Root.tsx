import { Composition } from 'remotion';
import { LessonVideo, lessonSchemaProps, type LessonProps } from './LessonVideo';

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;

/**
 * Duration comes from the capture manifest, not from a constant here. The Playwright stage
 * decides how many frames exist; Remotion composes exactly those.
 */
export const RemotionRoot: React.FC = () => (
  <Composition
    id="Lesson"
    component={LessonVideo}
    durationInFrames={1}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    defaultProps={lessonSchemaProps}
    calculateMetadata={({ props }: { props: LessonProps }) => ({
      durationInFrames: Math.max(1, props.capture?.frames ?? 1),
      fps: props.capture?.fps ?? FPS,
    })}
  />
);
