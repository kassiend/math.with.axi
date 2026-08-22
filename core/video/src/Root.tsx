import { Composition } from 'remotion';
import { LessonVideo, lessonSchemaProps, type LessonProps } from './LessonVideo';
import { TaskVideo, taskVideoDefaults, type TaskVideoProps } from './TaskVideo';
import { LessonPostVideo, lessonPostDefaults, type LessonPostProps } from './LessonPostVideo';
import { StoryVideo, storyVideoDefaults, type StoryVideoProps } from './StoryVideo';

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;

/**
 * Duration always comes from the capture manifest, never from a constant here. The Playwright
 * stage decides how many frames exist; Remotion composes exactly those.
 */
export const RemotionRoot: React.FC = () => (
  <>
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

    <Composition
      id="Task"
      component={TaskVideo}
      durationInFrames={1}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={taskVideoDefaults}
      calculateMetadata={({ props }: { props: TaskVideoProps }) => ({
        durationInFrames: Math.max(1, props.capture?.frames ?? 1),
        fps: props.capture?.fps ?? FPS,
      })}
    />

    <Composition
      id="LessonPost"
      component={LessonPostVideo}
      durationInFrames={1}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={lessonPostDefaults}
      calculateMetadata={({ props }: { props: LessonPostProps }) => ({
        durationInFrames: Math.max(1, props.capture?.frames ?? 1),
        fps: props.capture?.fps ?? FPS,
      })}
    />

    <Composition
      id="Story"
      component={StoryVideo}
      durationInFrames={1}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={storyVideoDefaults}
      calculateMetadata={({ props }: { props: StoryVideoProps }) => ({
        durationInFrames: Math.max(1, props.capture?.frames ?? 1),
        fps: props.capture?.fps ?? FPS,
      })}
    />
  </>
);
