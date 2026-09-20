/**
 * The task card scene. Every visual is a pure function of `frame`.
 *
 * There is no mascot intro: the post opens on the card so the puzzle is legible in the first
 * frame, with the greeting audio over it. The mascot sits in the footer, where it always appeared
 * once the card was up.
 *
 * After reviewing the first renders against the short-form playbook:
 *   - the statement is the hero — it fills the ring rather than sitting in its centre at 56 px
 *   - the headline is the challenge; the ask is one small line under the ring
 *   - a seconds readout inside the ring gives a visible finish line
 *   - the ring warms from blue to orange over the last quarter — a re-hook with no words
 *   - the card is opaque from frame 0, the statement pops in, the background drifts throughout
 *
 * What this page does NOT draw: the hurry clip. That is video, composited by Remotion on top.
 */
import { CARD, CTA, FOOTER, READOUT, RING, STATEMENT, TITLE } from './layout';
import {
  BLUR_PX, TaskTimeline, clamp01, secondsLeft, timerRemaining,
} from '../../../shared/task-timeline';
import { backgroundDrift, breathe, cardSettle, easeOutBack, easeOutCubic, lerp, mixHex } from '../../../shared/motion';

export interface TaskSceneProps {
  frame: number;
  timeline: TaskTimeline;
  background: string;
  /** Plain text, or pre-rendered KaTeX markup when the description contains mathematics. */
  title: string;
  titleIsHtml?: boolean;
  statementHtml: string;
  statementFontSize: number;
  /** Plain text laid out to the ring's width; KaTeX stays on one line. */
  statementWraps?: boolean;
}

export function TaskScene(props: TaskSceneProps) {
  return (
    <div className="frame">
      <Background src={props.background} frame={props.frame} total={props.timeline.totalFrames} />
      <Card {...props} />
    </div>
  );
}

/** Blurred from frame 0 — the blur is what stops the busy line-art competing with the ring. */
function Background({ src, frame, total }: { src: string; frame: number; total: number }) {
  return (
    <img
      className="bg" src={`./bg/${src}`} alt=""
      style={{ filter: `blur(${BLUR_PX}px)`, transform: backgroundDrift(frame, total) }}
    />
  );
}

function Card(props: TaskSceneProps) {
  const { frame, timeline } = props;
  const { scale } = cardSettle(frame, timeline.cardIn.end);

  // The statement pops in over the first frames — already most of the way there on frame 0.
  const pop = easeOutBack(clamp01((frame + 4) / STATEMENT.popFrames));
  const statementScale = lerp(0.8, 1, pop);

  return (
    <div
      className="card"
      style={{
        left: `${CARD.x}px`, top: `${CARD.y}px`, width: `${CARD.w}px`, height: `${CARD.h}px`,
        borderRadius: `${CARD.radius}px`, borderWidth: `${CARD.border}px`,
        transform: `scale(${scale.toFixed(4)})`,
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
          // An explicit width: absolutely positioned with left:50%, a max-width box shrink-wraps
          // to half the card and a two-line title wraps to three.
          width: `${TITLE.maxWidth}px`,
        }}
        {...(props.titleIsHtml
          ? { dangerouslySetInnerHTML: { __html: props.title } }
          : { children: props.title })}
      />

      <Ring frame={frame} timeline={timeline} />

      <div
        className={`statement${props.statementWraps ? ' wraps' : ''}`}
        style={{
          left: `${RING.cx - CARD.x}px`,
          // Raised by half the readout band so statement + readout sit centred in the ring.
          top: `${RING.cy - CARD.y - READOUT.reserve / 2}px`,
          width: props.statementWraps ? `${Math.round(STATEMENT.safeBox)}px` : undefined,
          fontSize: `${props.statementFontSize}px`, color: STATEMENT.colour,
          opacity: clamp01(pop * 1.5),
          transform: `translate(-50%, -50%) scale(${statementScale.toFixed(4)})`,
        }}
        dangerouslySetInnerHTML={{ __html: props.statementHtml }}
      />

      <Readout frame={frame} timeline={timeline} />

      {/* Time's up: the ask is the payoff. It grows and warms as the ring empties, so the post
          ends on the one thing to do rather than on an empty circle. */}
      {(() => {
        const t = easeOutCubic(clamp01((frame - timeline.timer.end) / CTA.endFrames));
        const size = lerp(CTA.fontSize, CTA.endFontSize, t);
        return (
          <div className="cta" style={{
            top: `${CTA.centreY - CARD.y - size * 0.6}px`,
            fontSize: `${size.toFixed(2)}px`, color: mixHex(CTA.colour, RING.urgent, t),
            transform: `translateX(-50%)`,
          }}>
            {t > 0 ? CTA.endText : CTA.text}
          </div>
        );
      })()}

      {/* A still, but not a frozen one: a slow breath keeps him from reading as a sticker. */}
      <img
        className="footer-mascot"
        src="./mascot/axi-still.png"
        alt=""
        style={{
          left: `${FOOTER.mascot.x - CARD.x}px`, top: `${FOOTER.mascot.y - CARD.y}px`,
          width: `${FOOTER.mascot.w}px`, height: `${FOOTER.mascot.h}px`,
          transform: `scale(${breathe(frame, 84, 0.02).toFixed(4)})`, transformOrigin: 'center bottom',
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
 * 0 before the urgent quarter, 1 inside it, with a short ramp at the boundary. A ramp rather than
 * a cut so the change is felt; short (half a second) because every blend of this blue and this
 * orange is a muddy grey, and none of them should sit on screen.
 */
function urgency(frame: number, t: TaskTimeline): number {
  const urgentAt = t.timer.start + Math.round((t.timer.end - t.timer.start) * RING.urgentFrom);
  return clamp01((frame - urgentAt) / RING.urgentRampFrames);
}

/**
 * Countdown ring. Starts as a full circle and depletes clockwise from 12 o'clock — the standard
 * affordance for time remaining, as opposed to a filling arc which reads as time elapsed.
 */
function Ring({ frame, timeline }: { frame: number; timeline: TaskTimeline }) {
  const remaining = clamp01(timerRemaining(frame, timeline));
  const c = 2 * Math.PI * RING.pathR;
  const size = RING.outerR * 2;
  const accent = mixHex(RING.accent, RING.urgent, urgency(frame, timeline));

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
          fill="none" stroke={accent} strokeWidth={RING.stroke} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 18px ${accent}73)` }}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - remaining)}
          transform={`rotate(-90 ${RING.outerR} ${RING.outerR})`}
        />
      )}
    </svg>
  );
}

/**
 * Whole seconds left. Warms with the ring, and nudges on each tick so it never sits still. Yields
 * while the hurry sticker is up — the rabbit with the stopwatch stands in the same spot and IS
 * the countdown for those two seconds.
 */
function Readout({ frame, timeline }: { frame: number; timeline: TaskTimeline }) {
  if (frame < timeline.timer.start || frame >= timeline.timer.end) return null;
  const { enter, exit } = timeline.hurry;
  const hurryIn = clamp01((frame - (enter - 6)) / 6) * (1 - clamp01((frame - exit - 4) / 6));
  const visible = 1 - hurryIn;
  const left = secondsLeft(frame, timeline);
  const u = urgency(frame, timeline);
  const colour = mixHex(READOUT.colour, RING.urgent, u);
  // Frames since the last whole second: a small pop on every tick.
  const sinceTick = (frame - timeline.timer.start) % timeline.fps;
  const tickPop = 1 + 0.08 * (1 - clamp01(sinceTick / 6)) * (0.5 + u);
  return (
    <div className="readout" style={{
      left: `${RING.cx - CARD.x}px`, top: `${READOUT.centreY - CARD.y}px`,
      fontSize: `${READOUT.fontSize}px`, color: colour, opacity: visible,
      transform: `translate(-50%, -50%) scale(${tickPop.toFixed(4)})`,
    }}>
      {left}s
    </div>
  );
}
