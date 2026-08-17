/**
 * The lesson card scene. Every visual is a pure function of `frame`.
 *
 * What this page does not draw: the intro clip. That is video, composited by Remotion on top of
 * this capture. The page draws the background it sits on, the still it hands off to, and the card.
 *
 * No stopwatch and no hurry overlay — those are the task format's language. A lesson has no time
 * pressure, and putting a countdown on one would tell the viewer to rush the thing they came to
 * understand.
 */
import { BODY, CARD, FOOTER, STEP_FADE, TITLE } from './layout';
import type { LineFit } from './fit';
import {
  BLUR_PX, LessonTimeline, bodyOpacity, easeOutCubic, lerp, progress, stepAt,
} from '../../../shared/lesson-timeline';

export interface StillGeometry {
  frame_rect: { x: number; y: number; w: number; h: number };
}

export interface LessonStepContent {
  step_id: string;
  instruction: string;
  working: string;
}

export interface LessonSceneProps {
  frame: number;
  timeline: LessonTimeline;
  background: string;
  still: StillGeometry;
  /** `Math tricks #N` — same on every step. It identifies the post, not the step. */
  title: string;
  steps: LessonStepContent[];
  fits: Array<{ instruction: LineFit; working: LineFit }>;
}

export function LessonScene(props: LessonSceneProps) {
  const { frame, timeline } = props;
  return (
    <div className="frame">
      <Background frame={frame} timeline={timeline} src={props.background} />
      <Card {...props} />
      <MascotStill frame={frame} timeline={timeline} still={props.still} />
    </div>
  );
}

function Background({ frame, timeline, src }: {
  frame: number; timeline: LessonTimeline; src: string;
}) {
  const t = easeOutCubic(progress(frame, timeline.handoff));
  const blur = frame < timeline.handoff.start ? 0 : lerp(0, BLUR_PX, t);
  return (
    <img className="bg" src={`./bg/${src}`} alt=""
         style={{ filter: blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : 'none' }} />
  );
}

/**
 * The still the intro video hands off to. Hidden while the video is on screen, then animated from
 * exactly where the video left the mascot into the footer slot. Both rects come from
 * tools/extract-mascot-still.mjs, which is what makes the cut invisible.
 */
function MascotStill({ frame, timeline, still }: {
  frame: number; timeline: LessonTimeline; still: StillGeometry;
}) {
  // Visible from the moment the clip stops, not from the hand-off. The greeting is retimed to
  // 1.5 s while the intro narration usually runs longer, so without this the mascot would vanish
  // for the remainder of the intro and reappear when the hand-off began.
  if (frame < timeline.introClipEnd) return null;

  const from = still.frame_rect;
  const to = FOOTER.mascot;
  const t = easeOutCubic(progress(frame, timeline.handoff));

  const h = lerp(from.h, to.h, t);
  const w = h * (from.w / from.h);
  const x = lerp(from.x, to.x + (to.w - w) / 2, t);
  const y = lerp(from.y, to.y + (to.h - h), t);

  return (
    <img className="mascot-still" src="./mascot/axi-still.png" alt=""
         style={{ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` }} />
  );
}

function Card(props: LessonSceneProps) {
  const { frame, timeline, steps, fits } = props;
  if (frame < timeline.cardIn.start) return null;

  const t = easeOutCubic(progress(frame, timeline.cardIn));
  const scale = lerp(0.85, 1, t);

  const step = stepAt(frame, timeline);
  const content = step ? steps[step.index] : null;
  const fit = step ? fits[step.index] : null;
  const opacity = bodyOpacity(frame, timeline, STEP_FADE);

  return (
    <div className="card" style={{
      left: `${CARD.x}px`, top: `${CARD.y}px`, width: `${CARD.w}px`, height: `${CARD.h}px`,
      borderRadius: `${CARD.radius}px`, borderWidth: `${CARD.border}px`,
      opacity: t, transform: `scale(${scale.toFixed(4)})`,
    }}>
      <div className="title" style={{
        top: `${TITLE.top - CARD.y}px`,
        fontSize: `${TITLE.fontSize}px`, lineHeight: `${TITLE.lineHeight}px`,
        maxWidth: `${BODY.maxWidth}px`, color: TITLE.colour,
      }}>
        {props.title}
      </div>

      {content && fit && (
        <div className="body" style={{
          top: `${BODY.centreY - CARD.y}px`,
          width: `${BODY.maxWidth}px`,
          gap: `${BODY.gap}px`,
          opacity,
        }}>
          <div className="line instruction" style={{
            fontSize: `${fit.instruction.fontSize}px`,
            lineHeight: `${Math.round(fit.instruction.fontSize * BODY.instruction.lineHeightRatio)}px`,
            color: BODY.instruction.colour,
          }}>
            {content.instruction}
          </div>
          <div className="line working" style={{
            fontSize: `${fit.working.fontSize}px`,
            lineHeight: `${Math.round(fit.working.fontSize * BODY.working.lineHeightRatio)}px`,
            color: BODY.working.colour,
          }}>
            {content.working}
          </div>
        </div>
      )}

      {/* No mascot image here: the animated still from the hand-off comes to rest in this slot
          and stays. A second copy inside the card would double it mid-flight. */}
      <div className="wordmark" style={{
        left: `${FOOTER.wordmark.x - CARD.x}px`,
        top: `${FOOTER.wordmark.baseline - CARD.y - FOOTER.wordmark.fontSize}px`,
        fontSize: `${FOOTER.wordmark.fontSize}px`,
      }}>
        {FOOTER.wordmark.text}
      </div>
    </div>
  );
}
