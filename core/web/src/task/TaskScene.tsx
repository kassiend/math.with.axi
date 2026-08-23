/**
 * The task card scene. Every visual is a pure function of `frame`.
 *
 * There is no mascot intro any more: the post opens on the card so the puzzle is legible in the
 * first frame, with the greeting audio over it. The mascot sits in the footer, where it always
 * appeared once the card was up.
 *
 * What this page does NOT draw: the hurry clip. That is video, composited by Remotion on top.
 */
import { CARD, FOOTER, RING, STATEMENT, TITLE } from './layout';
import {
  BLUR_PX, TaskTimeline, clamp01, easeOutCubic, lerp, progress, timerRemaining,
} from '../../../shared/task-timeline';

export interface TaskSceneProps {
  frame: number;
  timeline: TaskTimeline;
  background: string;
  /** Plain text, or pre-rendered KaTeX markup when the description contains mathematics. */
  title: string;
  titleIsHtml?: boolean;
  statementHtml: string;
  statementFontSize: number;
}

export function TaskScene(props: TaskSceneProps) {
  return (
    <div className="frame">
      <Background src={props.background} />
      <Card {...props} />
    </div>
  );
}

/**
 * Blurred from frame 0. There is no sharp intro phase to ramp from any more; the blur is simply
 * what stops the busy line-art competing with the ring.
 */
function Background({ src }: { src: string }) {
  return <img className="bg" src={`./bg/${src}`} alt="" style={{ filter: `blur(${BLUR_PX}px)` }} />;
}

function Card(props: TaskSceneProps) {
  const { frame, timeline } = props;
  if (frame < timeline.cardIn.start) return null;

  const t = easeOutCubic(progress(frame, timeline.cardIn));
  const scale = lerp(0.85, 1, t);

  return (
    <div
      className="card"
      style={{
        left: `${CARD.x}px`, top: `${CARD.y}px`, width: `${CARD.w}px`, height: `${CARD.h}px`,
        borderRadius: `${CARD.radius}px`, borderWidth: `${CARD.border}px`,
        opacity: t, transform: `scale(${scale.toFixed(4)})`,
      }}
    >
      {/* A title like "Find 4^x + 8^x" printed literally puts raw carets on the card beside a
          properly typeset ring. When the payload supplies LaTeX, the title is typeset too. */}
      <div
        className="title"
        style={{
          top: `${TITLE.top - CARD.y}px`,
          fontSize: `${TITLE.fontSize}px`,
          lineHeight: `${TITLE.lineHeight}px`,
          maxWidth: `${TITLE.maxWidth}px`,
        }}
        {...(props.titleIsHtml
          ? { dangerouslySetInnerHTML: { __html: props.title } }
          : { children: props.title })}
      />

      <Ring frame={frame} timeline={timeline} />

      <div
        className="statement"
        style={{
          left: `${RING.cx - CARD.x}px`, top: `${RING.cy - CARD.y}px`,
          fontSize: `${props.statementFontSize}px`, color: STATEMENT.colour,
        }}
        dangerouslySetInnerHTML={{ __html: props.statementHtml }}
      />

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
      <div
        className="wordmark"
        style={{
          left: `${FOOTER.wordmark.x - CARD.x}px`,
          top: `${FOOTER.wordmark.baseline - CARD.y - FOOTER.wordmark.fontSize}px`,
          fontSize: `${FOOTER.wordmark.fontSize}px`,
        }}
      >
        {FOOTER.wordmark.text}
      </div>
    </div>
  );
}

/**
 * Countdown ring. Starts as a full circle and depletes clockwise from 12 o'clock — the standard
 * affordance for time remaining, as opposed to a filling arc which reads as time elapsed.
 */
function Ring({ frame, timeline }: { frame: number; timeline: TaskTimeline }) {
  const remaining = clamp01(timerRemaining(frame, timeline));
  const c = 2 * Math.PI * RING.pathR;
  const size = RING.outerR * 2;

  return (
    <svg
      className="ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ left: `${RING.cx - RING.outerR - CARD.x}px`, top: `${RING.cy - RING.outerR - CARD.y}px` }}
    >
      <circle
        cx={RING.outerR} cy={RING.outerR} r={RING.pathR}
        fill="none" stroke={RING.track} strokeWidth={RING.stroke}
      />
      {remaining > 0.0005 && (
        <circle
          className="ring-accent"
          cx={RING.outerR} cy={RING.outerR} r={RING.pathR}
          fill="none" stroke={RING.accent} strokeWidth={RING.stroke} strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - remaining)}
          transform={`rotate(-90 ${RING.outerR} ${RING.outerR})`}
        />
      )}
    </svg>
  );
}
