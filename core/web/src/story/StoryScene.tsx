/**
 * The story card scene. Every visual is a pure function of `frame`.
 *
 * What this page does NOT draw: the mascot. It is video — a keyed clip that walks in, reads, and
 * walks out — composited by Remotion on top of this capture. The page reserves its band and
 * draws everything else.
 *
 * After reviewing the first render against the short-form playbook:
 *   - the mechanism is BUILT: `formula_steps` land one line at a time in time with the voice,
 *     instead of one finished formula sitting on a white card for twenty seconds
 *   - a sourced image drifts slowly for its whole beat; nothing on the card is ever fully still
 *   - beat changes cross-fade; there is no frame with an empty slot
 *   - the story ends on an ask, under the payoff line
 *   - the card is opaque from frame 0
 */
import { ASK, CARD, DISPLAY, FORMULA, IMAGE_DRIFT, TITLE, VISUAL } from './layout';
import type { LineFit } from './fit';
import {
  BEAT_FADE, BLUR_PX, StoryTimeline, beatAt, progress,
} from '../../../shared/story-timeline';
import {
  backgroundDrift, breathe, cardSettle, clamp01, crossfade, easeInOutSine, easeOutBack, lerp,
  mixHex, staggerFor, tokenPose, tokenize,
} from '../../../shared/motion';

export interface StoryBeatContent {
  beat: string;
  display: string;
  /** What fills the visual slot for this beat. */
  visual: 'image' | 'formula' | 'shape' | 'none';
  image?: string | null;      // path relative to the page, when visual === 'image'
  formulaHtml?: string | null; // pre-rendered KaTeX, when visual === 'formula'
  /** Pre-rendered KaTeX per derivation line; the last is the formula. Optional. */
  formulaStepsHtml?: string[] | null;
  shapeSvg?: string | null;    // inline SVG markup, when visual === 'shape'
}

export interface StorySceneProps {
  frame: number;
  timeline: StoryTimeline;
  background: string;
  title: string;
  beats: StoryBeatContent[];
  ask: string;
  titleFit: LineFit;
  displayFits: LineFit[];
  askFit: LineFit;
}

export function StoryScene(props: StorySceneProps) {
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

function Card(props: StorySceneProps) {
  const { frame, timeline } = props;
  const { scale } = cardSettle(frame, timeline.cardIn.end);

  const beat = beatAt(frame, timeline);
  const fade = beat ? crossfade(frame, beat.start, BEAT_FADE) : null;
  const previous = beat && beat.index > 0 && fade?.active ? timeline.beats[beat.index - 1] : null;

  const last = timeline.beats[timeline.beats.length - 1];
  const showAsk = last != null && frame >= last.start;

  return (
    <div className="card" style={{
      left: `${CARD.x}px`, top: `${CARD.y}px`, width: `${CARD.w}px`, height: `${CARD.h}px`,
      borderRadius: `${CARD.radius}px`, borderWidth: `${CARD.border}px`,
      transform: `scale(${scale.toFixed(4)})`,
    }}>
      {/* The mascot band stays empty — Remotion draws the clip over it. */}

      <div className="story-title" style={{
        top: `${TITLE.top - CARD.y}px`,
        fontSize: `${props.titleFit.fontSize}px`,
        lineHeight: `${Math.round(props.titleFit.fontSize * TITLE.lineHeightRatio)}px`,
        width: `${TITLE.maxWidth}px`, color: TITLE.colour,
      }}>
        {props.title}
      </div>

      {previous && fade && (
        <BeatLayer {...props} phase={previous} pose={fade.outgoing} />
      )}
      {beat && fade && (
        <BeatLayer {...props} phase={beat} pose={beat.index > 0 ? fade.incoming : { opacity: 1, translateY: 0 }} />
      )}

      {showAsk && (
        <AskLine frame={frame} start={last.start + 24} text={props.ask} fit={props.askFit} />
      )}
    </div>
  );
}

interface Pose { opacity: number; translateY: number }

function BeatLayer(props: StorySceneProps & { phase: StoryTimeline['beats'][number]; pose: Pose }) {
  const { frame, phase, pose } = props;
  const content = props.beats[phase.index];
  const fit = props.displayFits[phase.index];
  const style = { opacity: pose.opacity, transform: `translateY(${pose.translateY.toFixed(2)}px)` };

  return (
    <div className="layer" style={style}>
      <div className="visual" style={{
        left: `${VISUAL.x - CARD.x}px`, top: `${VISUAL.y - CARD.y}px`,
        width: `${VISUAL.w}px`, height: `${VISUAL.h}px`,
        borderRadius: `${VISUAL.radius}px`,
      }}>
        <Visual content={content} frame={frame} phase={phase} />
      </div>

      <DisplayLine frame={frame} start={phase.start} text={content.display} fit={fit} />
    </div>
  );
}

/**
 * One visual per beat. A missing one renders as nothing rather than as a placeholder — a slot
 * that looks filled when it is not is the view-layer version of a fabricated field.
 */
function Visual({ content, frame, phase }: {
  content: StoryBeatContent; frame: number; phase: StoryTimeline['beats'][number];
}) {
  const t = progress(frame, phase);

  if (content.visual === 'image' && content.image) {
    // A slow push-in for the whole beat. Alternating direction per beat would be nicer still but
    // reads as a bug when two image beats are adjacent; one direction, always.
    const s = 1 + IMAGE_DRIFT * easeInOutSine(t);
    return <img className="visual-img" src={content.image} alt="" style={{ transform: `scale(${s.toFixed(4)})` }} />;
  }

  if (content.visual === 'formula') {
    const steps = content.formulaStepsHtml?.length ? content.formulaStepsHtml : (content.formulaHtml ? [content.formulaHtml] : []);
    if (!steps.length) return null;
    const span = phase.end - phase.start;
    const stagger = steps.length > 1
      ? Math.max(8, Math.floor((span * FORMULA.landedBy) / (steps.length - 1)))
      : 0;
    const single = steps.length === 1;
    return (
      <div className="visual-formula" style={{ gap: `${FORMULA.lineGap}px`,
                                              fontSize: `${single ? FORMULA.fontSize : FORMULA.stackedFontSize}px` }}>
        {steps.map((html, i) => {
          const local = clamp01((frame - phase.start - i * stagger) / 10);
          const e = easeOutBack(local);
          const isLast = i === steps.length - 1;
          const nextLanded = !isLast && frame >= phase.start + (i + 1) * stagger;
          const opacity = clamp01(local * 1.5) * (nextLanded ? FORMULA.dim : 1);
          const s = lerp(0.9, 1, e) * (isLast && local >= 1 ? breathe(frame) : 1);
          // The result lands warm and settles to the working blue — the eye goes to it.
          const landedAt = phase.start + i * stagger + 10;
          const colour = isLast ? mixHex(FORMULA.emphasis, FORMULA.colour, clamp01((frame - landedAt) / FORMULA.settleFrames)) : FORMULA.colour;
          return (
            <div key={i} className={`formula-line${isLast ? ' final' : ''}`} style={{
              opacity, color: colour,
              transform: `translateY(${lerp(16, 0, e).toFixed(2)}px) scale(${s.toFixed(4)})`,
            }} dangerouslySetInnerHTML={{ __html: html }} />
          );
        })}
      </div>
    );
  }

  if (content.visual === 'shape' && content.shapeSvg) {
    const s = 1 + 0.03 * easeInOutSine(t);
    return <div className="visual-shape" style={{ transform: `scale(${s.toFixed(4)})` }} dangerouslySetInnerHTML={{ __html: content.shapeSvg }} />;
  }
  return null;
}

/** The beat's line, built token by token as the beat opens. */
function DisplayLine({ frame, start, text, fit }: { frame: number; start: number; text: string; fit: LineFit }) {
  const tokens = tokenize(text);
  const stagger = staggerFor(tokens.length, 30, 5);
  return (
    <div className="display" style={{
      top: `${DISPLAY.top - CARD.y}px`, width: `${DISPLAY.maxWidth}px`,
      fontSize: `${fit.fontSize}px`,
      lineHeight: `${Math.round(fit.fontSize * DISPLAY.lineHeightRatio)}px`,
      color: DISPLAY.colour,
    }}>
      {tokens.map((tok, i) => {
        const p = tokenPose(frame, start, i, stagger);
        return (
          <span key={i}>
            <span className="tok" style={{
              opacity: p.opacity,
              transform: `translateY(${p.translateY.toFixed(2)}px) scale(${p.scale.toFixed(4)})`,
            }}>{tok}</span>
            {i < tokens.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </div>
  );
}

function AskLine({ frame, start, text, fit }: { frame: number; start: number; text: string; fit: LineFit }) {
  const tokens = tokenize(text);
  return (
    <div className="ask" style={{
      top: `${ASK.centreY - CARD.y - Math.round(fit.fontSize * ASK.lineHeightRatio) / 2}px`,
      width: `${ASK.maxWidth}px`, fontSize: `${fit.fontSize}px`,
      lineHeight: `${Math.round(fit.fontSize * ASK.lineHeightRatio)}px`, color: ASK.colour,
    }}>
      {tokens.map((tok, i) => {
        const p = tokenPose(frame, start, i, 3);
        return (
          <span key={i}>
            <span className="tok" style={{
              opacity: p.opacity,
              transform: `translateY(${p.translateY.toFixed(2)}px) scale(${p.scale.toFixed(4)})`,
            }}>{tok}</span>
            {i < tokens.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </div>
  );
}
