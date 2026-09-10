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
import { BODY, BODY_WITH_VISUAL, CARD, FOOTER, STEP_FADE, TITLE, VISUAL } from './layout';
import type { LineFit } from './fit';
import { LessonVisual, type LessonVisualSpec } from './visuals';
import {
  BLUR_PX, LessonTimeline, bodyOpacity, easeOutCubic, lerp, progress, stepAt, visualBuild,
} from '../../../shared/lesson-timeline';

export interface LessonStepContent {
  step_id: string;
  instruction: string;
  working: string;
  /** A step with a diagram re-anchors its text to the top of the card and hands the rest over. */
  visual?: LessonVisualSpec | null;
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

      {content && fit && (() => {
        const spec = content.visual ?? null;
        const body = spec ? BODY_WITH_VISUAL : BODY;
        return (
          <div className={spec ? 'body top' : 'body'} style={{
            top: `${(spec ? BODY_WITH_VISUAL.top : BODY.centreY) - CARD.y}px`,
            width: `${body.maxWidth}px`,
            gap: `${body.gap}px`,
            opacity,
          }}>
            <div className="line instruction" style={{
              fontSize: `${fit.instruction.fontSize}px`,
              lineHeight: `${Math.round(fit.instruction.fontSize * body.instruction.lineHeightRatio)}px`,
              color: body.instruction.colour,
            }}>
              {content.instruction}
            </div>
            <div className="line working" style={{
              fontSize: `${fit.working.fontSize}px`,
              lineHeight: `${Math.round(fit.working.fontSize * body.working.lineHeightRatio)}px`,
              color: body.working.colour,
            }}>
              {content.working}
            </div>
          </div>
        );
      })()}

      {content?.visual && (
        <div className="visual" style={{
          left: `${VISUAL.x - CARD.x}px`, top: `${VISUAL.y - CARD.y}px`,
          width: `${VISUAL.w}px`, height: `${VISUAL.h}px`,
          opacity,
        }}>
          <LessonVisual spec={content.visual} build={visualBuild(frame, timeline)} />
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
