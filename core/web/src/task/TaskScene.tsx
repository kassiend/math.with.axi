/**
 * The task card scene. Every visual is a pure function of `frame`.
 *
 * What this page does NOT draw: the intro clip and the hurry clip. Those are video, composited by
 * Remotion on top of this capture. The page draws the background they sit on, the still the intro
 * hands off to, and the card.
 */
import { CARD, FOOTER, RING, STATEMENT, TITLE } from './layout';
import {
  BLUR_PX, TaskTimeline, clamp01, easeOutCubic, lerp, progress, timerRemaining,
} from '../../../shared/task-timeline';

export interface StillGeometry {
  frame_rect: { x: number; y: number; w: number; h: number };
}

export interface TaskSceneProps {
  frame: number;
  timeline: TaskTimeline;
  background: string;
  still: StillGeometry;
  title: string;
  statementHtml: string;
  statementFontSize: number;
}

export function TaskScene(props: TaskSceneProps) {
  const { frame, timeline } = props;

  return (
    <div className="frame">
      <Background frame={frame} timeline={timeline} src={props.background} />
      <Card {...props} />
      <MascotStill frame={frame} timeline={timeline} still={props.still} />
    </div>
  );
}

/**
 * Sharp during the intro, blurring across the hand-off, blurred from then on. The card is opaque
 * white so no scrim is needed; the blur is what stops the busy line-art competing with the ring.
 */
function Background({ frame, timeline, src }: { frame: number; timeline: TaskTimeline; src: string }) {
  const t = easeOutCubic(progress(frame, timeline.handoff));
  const blur = frame < timeline.handoff.start ? 0 : lerp(0, BLUR_PX, t);
  return (
    <img
      className="bg"
      src={`./bg/${src}`}
      alt=""
      style={{ filter: blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : 'none' }}
    />
  );
}

/**
 * The still the intro video hands off to. Hidden while the video is on screen, then animated from
 * exactly where the video left the mascot into the footer slot. Both rects come from
 * tools/extract-mascot-still.mjs, which is why the cut is invisible.
 */
function MascotStill({ frame, timeline, still }: {
  frame: number; timeline: TaskTimeline; still: StillGeometry;
}) {
  if (frame < timeline.handoff.start) return null;

  const from = still.frame_rect;
  const to = FOOTER.mascot;
  const t = easeOutCubic(progress(frame, timeline.handoff));

  // Uniform scale, so the mascot cannot squash. Height drives it; width follows the aspect.
  const h = lerp(from.h, to.h, t);
  const w = h * (from.w / from.h);
  const x = lerp(from.x, to.x + (to.w - w) / 2, t);
  const y = lerp(from.y, to.y + (to.h - h), t);

  return (
    <img
      className="mascot-still"
      src="./mascot/axi-still.png"
      alt=""
      style={{ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` }}
    />
  );
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
      <div
        className="title"
        style={{
          top: `${TITLE.top - CARD.y}px`,
          fontSize: `${TITLE.fontSize}px`,
          lineHeight: `${TITLE.lineHeight}px`,
          maxWidth: `${TITLE.maxWidth}px`,
        }}
      >
        {props.title}
      </div>

      <Ring frame={frame} timeline={timeline} />

      <div
        className="statement"
        style={{
          left: `${RING.cx - CARD.x}px`, top: `${RING.cy - CARD.y}px`,
          fontSize: `${props.statementFontSize}px`, color: STATEMENT.colour,
        }}
        dangerouslySetInnerHTML={{ __html: props.statementHtml }}
      />

      {/* No mascot image here: the animated still from the hand-off comes to rest in this slot
          and stays. Drawing a second copy inside the card would double it mid-flight. */}
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
