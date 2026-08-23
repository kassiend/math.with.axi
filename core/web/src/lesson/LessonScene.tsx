/**
 * The lesson card scene. Every visual is a pure function of `frame`.
 *
 * There is no mascot intro any more: the lesson opens on the card with the first step already
 * legible, and the spoken hook plays over it. The mascot sits in the footer, where it always
 * appeared once the card was up.
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

export interface LessonStepContent {
  step_id: string;
  instruction: string;
  working: string;
}

export interface LessonSceneProps {
  frame: number;
  timeline: LessonTimeline;
  background: string;
  /** `Math tricks #N` — same on every step. It identifies the post, not the step. */
  title: string;
  steps: LessonStepContent[];
  fits: Array<{ instruction: LineFit; working: LineFit }>;
}

export function LessonScene(props: LessonSceneProps) {
  return (
    <div className="frame">
      <Background src={props.background} />
      <Card {...props} />
    </div>
  );
}

function Background({ src }: { src: string }) {
  // Blurred from frame 0 — there is no sharp intro phase to ramp from any more.
  return <img className="bg" src={`./bg/${src}`} alt="" style={{ filter: `blur(${BLUR_PX}px)` }} />;
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

      {/* The mascot lives here and only here now — there is no intro clip for it to fly in from. */}
      <img
        className="footer-mascot"
        src="./mascot/axi-still.png"
        alt=""
        style={{
          left: `${FOOTER.mascot.x - CARD.x}px`, top: `${FOOTER.mascot.y - CARD.y}px`,
          width: `${FOOTER.mascot.w}px`, height: `${FOOTER.mascot.h}px`,
        }}
      />
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
