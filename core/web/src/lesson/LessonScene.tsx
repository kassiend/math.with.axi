/**
 * The lesson card scene. Every visual is a pure function of `frame`.
 *
 * What changed after reviewing the first renders against the short-form playbook:
 *
 *   - frame 0 is the hook: the card is already up and the problem is being built, large, token
 *     by token; the spoken hook's on-screen line lands once the problem has (~1.2 s)
 *   - every step is BUILT, not pasted — instruction first, then the working, one token at a time
 *     in the first part of the step's own narration
 *   - a step change is a cross-fade; there is no frame with an empty card
 *   - a progress row shows how many steps there are and which one this is
 *   - the post ends on an ask, not on a cut
 *   - the background drifts the whole time, so no frame is identical to the one before
 *
 * The mascot is not drawn here. It is the keyed walking take, composited by Remotion over the
 * band the layout reserves (MASCOT_REST). No stopwatch and no hurry overlay — those are the task
 * format's language.
 */
import { ASK, BODY, BODY_WITH_VISUAL, CARD, FOOTER, HERO, PROGRESS, STEP_FADE, TITLE, VISUAL } from './layout';
import type { GlyphBox, LessonFit, LineFit } from './fit';
import { LessonVisual, type LessonVisualSpec } from './visuals';
import { BLUR_PX, LessonTimeline, inHook, visualBuild } from '../../../shared/lesson-timeline';
import {
  backgroundDrift, cardSettle, clamp01, crossfade, lerp, matchGlyphs, mixHex, slideEase,
  staggerFor, tokenPose, tokenize,
} from '../../../shared/motion';

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
  /** On-screen line for the spoken hook. */
  hookDisplay: string;
  /** The closing ask. */
  ask: string;
  fit: LessonFit;
}

export function LessonScene(props: LessonSceneProps) {
  return (
    <div className="frame">
      <Background src={props.background} frame={props.frame} total={props.timeline.totalFrames} />
      <Card {...props} />
    </div>
  );
}

function Background({ src, frame, total }: { src: string; frame: number; total: number }) {
  return (
    <img
      className="bg" src={`./bg/${src}`} alt=""
      style={{ filter: `blur(${BLUR_PX}px)`, transform: backgroundDrift(frame, total) }}
    />
  );
}

/** One visual state of the body: the hero during the hook, then one per step. */
interface BodyState { kind: 'hero' | 'step'; index: number; start: number }

function bodyStates(t: LessonTimeline): BodyState[] {
  return [
    { kind: 'hero', index: 0, start: 0 },
    ...t.steps.map((s) => ({ kind: 'step' as const, index: s.index, start: s.start })),
  ];
}

function Card(props: LessonSceneProps) {
  const { frame, timeline, steps, fit } = props;
  const { scale } = cardSettle(frame, timeline.cardIn.end);

  const states = bodyStates(timeline);
  let current = 0;
  for (let i = 0; i < states.length; i++) if (frame >= states[i].start) current = i;
  const fade = crossfade(frame, states[current].start, STEP_FADE);
  const outgoing = current > 0 && fade.active ? states[current - 1] : null;

  const stepIndex = inHook(frame, timeline) ? -1 : (states[current].index);

  return (
    <div className="card" style={{
      left: `${CARD.x}px`, top: `${CARD.y}px`, width: `${CARD.w}px`, height: `${CARD.h}px`,
      borderRadius: `${CARD.radius}px`, borderWidth: `${CARD.border}px`,
      transform: `scale(${scale.toFixed(4)})`,
    }}>
      <div className="title" style={{
        top: `${TITLE.top - CARD.y}px`,
        fontSize: `${TITLE.fontSize}px`, lineHeight: `${TITLE.lineHeight}px`,
        maxWidth: `${BODY.maxWidth}px`, color: TITLE.colour,
      }}>
        {props.title}
      </div>

      <Progress count={steps.length} done={frame >= timeline.outro.start ? steps.length : stepIndex + 1} />

      {outgoing && (
        <BodyLayer {...props} state={outgoing} pose={fade.outgoing} outgoing />
      )}
      <BodyLayer {...props} state={states[current]}
                 pose={current > 0 ? fade.incoming : { opacity: 1, translateY: 0 }} />

      {frame >= timeline.outro.start && (
        <TokenLine
          className="ask"
          frame={frame}
          text={props.ask}
          fit={fit.ask}
          colour={ASK.colour}
          lineHeightRatio={ASK.lineHeightRatio}
          weight={600}
          centreY={ASK.centreY - CARD.y}
          start={timeline.outro.start}
          stagger={3}
        />
      )}

      <div className="wordmark centred" style={{
        top: `${FOOTER.wordmark.baseline - CARD.y - FOOTER.wordmark.fontSize}px`,
        fontSize: `${FOOTER.wordmark.fontSize}px`,
      }}>
        {FOOTER.wordmark.text}
      </div>
    </div>
  );
}

function Progress({ count, done }: { count: number; done: number }) {
  if (count <= 1) return null;
  const width = count * PROGRESS.dot + (count - 1) * PROGRESS.gap;
  return (
    <div className="progress" style={{
      top: `${PROGRESS.centreY - CARD.y - PROGRESS.dot / 2}px`,
      left: `${(CARD.w - width) / 2}px`, gap: `${PROGRESS.gap}px`,
    }}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="dot" style={{
          width: `${PROGRESS.dot}px`, height: `${PROGRESS.dot}px`,
          background: i < done ? PROGRESS.done : PROGRESS.pending,
        }} />
      ))}
    </div>
  );
}

interface Pose { opacity: number; translateY: number }

/** Everything the glyph slide needs to know about one state's working line. */
interface WorkingState {
  text: string;
  glyphs: GlyphBox[];
  fontSize: number;
  lineHeightRatio: number;
  /** Top of the line box, in card coordinates. */
  top: number;
  start: number;
}

function workingStateOf(state: BodyState, props: LessonSceneProps): WorkingState {
  const { steps, fit } = props;
  if (state.kind === 'hero') {
    const f = fit.hero.working;
    return {
      text: steps[0]?.working ?? '', glyphs: fit.hero.glyphs, fontSize: f.fontSize,
      lineHeightRatio: HERO.working.lineHeightRatio,
      top: HERO.working.centreY - CARD.y - f.height / 2,
      start: state.start - HERO.leadFrames,
    };
  }
  const f = fit.results[state.index];
  const body = steps[state.index].visual ? BODY_WITH_VISUAL : BODY;
  return {
    text: steps[state.index].working, glyphs: f.glyphs, fontSize: f.working.fontSize,
    lineHeightRatio: body.working.lineHeightRatio,
    top: bodyTop(state.index, props) + f.instruction.height + body.gap,
    start: state.start,
  };
}

/**
 * Top of a step's text block, in card coordinates. A text step centres its two lines as a group
 * on BODY.centreY; a step with a diagram pins them under the progress row and hands the middle
 * of the card to the slot.
 */
function bodyTop(index: number, { steps, fit }: LessonSceneProps): number {
  const f = fit.results[index];
  if (steps[index].visual) return BODY_WITH_VISUAL.top - CARD.y;
  const total = f.instruction.height + BODY.gap + f.working.height;
  return BODY.centreY - CARD.y - total / 2;
}

function BodyLayer(props: LessonSceneProps & { state: BodyState; pose: Pose; outgoing?: boolean }) {
  const { state, pose, frame, steps, fit, timeline } = props;
  const style = { opacity: pose.opacity, transform: `translateY(${pose.translateY.toFixed(2)}px)` };

  const states = bodyStates(timeline);
  const idx = states.findIndex((st) => st.kind === state.kind && st.index === state.index);
  const cur = workingStateOf(state, props);
  const prev = idx > 0 ? workingStateOf(states[idx - 1], props) : null;
  // For the outgoing layer the "next" state is what its glyphs are moving into.
  const next = idx < states.length - 1 ? workingStateOf(states[idx + 1], props) : null;
  const phase = state.kind === 'step' ? timeline.steps[state.index] : timeline.hook;
  const span = phase.end - phase.start;

  // The pose (cross-fade) applies to the lines that come and go — not to the working line, whose
  // surviving glyphs are mid-slide and must stay fully drawn on the incoming layer.
  if (state.kind === 'hero') {
    return (
      <div className="layer">
        <WorkingLine frame={frame} cur={cur} prev={null} next={props.outgoing ? next : null}
                     colour={HERO.working.colour} budget={HERO.claimAtFrame} fade={pose.opacity} />
        <div className="layer" style={style}>
          <TokenLine
            frame={frame} text={props.hookDisplay} fit={fit.hero.kicker} colour={HERO.kicker.colour}
            lineHeightRatio={HERO.kicker.lineHeightRatio} weight={800}
            centreY={HERO.kicker.centreY - CARD.y}
            start={state.start + HERO.claimAtFrame} stagger={3}
          />
        </div>
      </div>
    );
  }

  const content = steps[state.index];
  const f = fit.results[state.index];
  const body = content.visual ? BODY_WITH_VISUAL : BODY;
  const top = bodyTop(state.index, props);

  return (
    <div className="layer">
      <div className="layer" style={style}>
        {/* The label waits for the digits to finish moving: motion first, then the words for it. */}
        <TokenLine
          frame={frame} text={content.instruction} fit={f.instruction} colour={body.instruction.colour}
          lineHeightRatio={body.instruction.lineHeightRatio} weight={800}
          top={top} start={state.start + SLIDE_FRAMES - 4} stagger={3}
        />
      </div>
      <WorkingLine frame={frame} cur={cur} prev={prev} next={props.outgoing ? next : null}
                   colour={body.working.colour} budget={Math.min(40, Math.round(span * 0.45))}
                   fade={pose.opacity} />
      {content.visual && (
        <VisualSlot spec={content.visual} frame={frame} timeline={timeline} fade={pose.opacity} />
      )}
    </div>
  );
}

/**
 * The diagram of a step that carries one. It builds across the step's own narration
 * (visualBuild), cross-fades with the layer it belongs to, and — because the closing ask lands
 * inside the slot — fades out under the ask once the outro begins. By then it has done its work.
 */
function VisualSlot({ spec, frame, timeline, fade }: {
  spec: LessonVisualSpec; frame: number; timeline: LessonTimeline; fade: number;
}) {
  const outroFade = 1 - clamp01((frame - timeline.outro.start) / STEP_FADE);
  const opacity = Math.min(fade, outroFade);
  if (opacity <= 0) return null;
  return (
    <div className="visual" style={{
      left: `${VISUAL.x - CARD.x}px`, top: `${VISUAL.y - CARD.y}px`,
      width: `${VISUAL.w}px`, height: `${VISUAL.h}px`,
      opacity,
    }}>
      <LessonVisual spec={spec} build={visualBuild(frame, timeline)} />
    </div>
  );
}

/** Frames a surviving glyph takes to slide from its old place to its new one. */
const SLIDE_FRAMES = 14;
/** New glyphs land in this colour and settle to the working colour over SETTLE_FRAMES. */
const EMPHASIS = '#F26B1D';
const SETTLE_FRAMES = 30;

/**
 * The working line as glyphs. A glyph that also existed in the previous state SLIDES from where
 * it was to where it is now — the digits of 92 moving apart, the 11 travelling to the end; a glyph
 * that is new pops in afterwards, in the emphasis colour, and settles. On the outgoing layer the
 * glyphs that survive into the next state are hidden (the incoming layer is drawing them
 * mid-slide) and only the ones that vanish fade with the layer.
 */
function WorkingLine({ frame, cur, prev, next, colour, budget, fade }: {
  frame: number; cur: WorkingState; prev: WorkingState | null; next: WorkingState | null;
  colour: string; budget: number;
  /** Layer opacity — applied to the glyphs that vanish, never to the ones that slide. */
  fade: number;
}) {
  const chars = cur.glyphs.map((g) => g.ch);
  const fromPrev = new Map<number, number>();
  if (prev) for (const [i, j] of matchGlyphs(prev.glyphs.map((g) => g.ch), chars)) fromPrev.set(j, i);
  const survivesIntoNext = new Set<number>();
  if (next) for (const [i] of matchGlyphs(chars, next.glyphs.map((g) => g.ch))) survivesIntoNext.add(i);

  // New glyphs pop in once the slide has mostly landed, staggered to fit the budget.
  const newIdx = cur.glyphs.map((_, j) => j).filter((j) => !fromPrev.has(j));
  const newStart = prev ? cur.start + SLIDE_FRAMES - 4 : cur.start;
  const stagger = staggerFor(newIdx.length, Math.max(8, budget - (prev ? SLIDE_FRAMES : 0)), 5);
  const orderOfNew = new Map(newIdx.map((j, k) => [j, k]));

  const lineHeight = Math.round(cur.fontSize * cur.lineHeightRatio);
  const tokens = tokenize(cur.text);
  let g = 0;

  return (
    <div className="line" style={{
      top: `${cur.top}px`, width: `${BODY.maxWidth}px`,
      fontSize: `${cur.fontSize}px`, lineHeight: `${lineHeight}px`, color: colour, fontWeight: 800,
    }}>
      {tokens.map((tok, ti) => (
        <span key={ti}>
          <span className="tok">
            {Array.from(tok).map((ch) => {
              const j = g++;
              const box = cur.glyphs[j];
              let transform = '';
              let opacity = 1;
              let fill = colour;

              if (next && survivesIntoNext.has(j)) {
                // Drawn by the incoming layer mid-slide; keep the box, drop the ink.
                opacity = 0;
              } else if (next) {
                // Outgoing and not surviving: fades with the layer.
                opacity = fade;
              } else if (prev && fromPrev.has(j)) {
                const p = prev.glyphs[fromPrev.get(j)!];
                const t = slideEase((frame - cur.start) / SLIDE_FRAMES);
                const dx = (p.x + p.w / 2 - (box.x + box.w / 2)) * (1 - t);
                const dy = (prev.top + p.y + p.h / 2 - (cur.top + box.y + box.h / 2)) * (1 - t);
                const sc = lerp(prev.fontSize / cur.fontSize, 1, t);
                transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${sc.toFixed(4)})`;
              } else {
                const k = orderOfNew.get(j) ?? 0;
                const pose = tokenPose(frame, newStart, k, stagger);
                opacity = pose.opacity;
                transform = `translateY(${pose.translateY.toFixed(2)}px) scale(${pose.scale.toFixed(4)})`;
                if (prev) {
                  const landed = newStart + k * stagger + 7;
                  fill = mixHex(EMPHASIS, colour, clamp01((frame - landed) / SETTLE_FRAMES));
                }
              }

              return (
                <span key={j} className="g" style={{ opacity, transform, color: fill }}>{ch}</span>
              );
            })}
          </span>
          {ti < tokens.length - 1 ? ' ' : ''}
        </span>
      ))}
    </div>
  );
}

/**
 * A line of text whose tokens pop in one after another from `start`. Positioned either by its
 * top edge or by its vertical centre (`centreY`).
 */
function TokenLine(props: {
  text: string; fit: LineFit; colour: string; lineHeightRatio: number; weight: number;
  start: number; stagger: number; frame: number; top?: number; centreY?: number; className?: string;
}) {
  const { text, fit, start, stagger, frame } = props;
  const tokens = tokenize(text);
  const lineHeight = Math.round(fit.fontSize * props.lineHeightRatio);
  const top = props.centreY != null ? props.centreY - fit.height / 2 : (props.top ?? 0);

  return (
    <div className={`line ${props.className ?? ''}`} style={{
      top: `${top}px`, width: `${BODY.maxWidth}px`,
      fontSize: `${fit.fontSize}px`, lineHeight: `${lineHeight}px`,
      color: props.colour, fontWeight: props.weight,
    }}>
      {tokens.map((tok, i) => {
        const p = tokenPose(frame, start, i, stagger);
        // The space is a sibling text node, not part of the inline-block: inside the span it is
        // trailing whitespace and collapses, and "Multiply by 11" renders as "Multiplyby11".
        return (
          <span key={i}>
            <span className="tok" style={{
              opacity: p.opacity,
              transform: `translateY(${p.translateY.toFixed(2)}px) scale(${p.scale.toFixed(4)})`,
            }}>
              {tok}
            </span>
            {i < tokens.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </div>
  );
}
