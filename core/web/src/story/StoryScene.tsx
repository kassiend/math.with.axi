/**
 * The story card scene. Every visual is a pure function of `frame`.
 *
 * What this page does NOT draw: the mascot. It is video — a keyed clip that walks in, reads, and
 * walks out — composited by Remotion on top of this capture. The page reserves its band and
 * draws everything else.
 *
 * It DOES draw the ∫ he walks out of, because that is scenery and scenery belongs in the capture.
 * It sits under the clip, in the corridor the walk crosses; see MASCOT_PORTAL in layout.
 *
 * After reviewing the first render against the short-form playbook:
 *   - the mechanism is BUILT: `formula_steps` land one line at a time in time with the voice,
 *     instead of one finished formula sitting on a white card for twenty seconds
 *   - a long beat can carry a word-weighted sequence of visuals (`steps`) so the picture advances
 *     with the sentence; plots and computed animations draw themselves in
 *   - a sourced image drifts slowly for its whole beat; nothing on the card is ever fully still
 *   - beat changes cross-fade; there is no frame with an empty slot
 *   - the story ends on an ask, under the payoff line
 *   - the card is opaque from frame 0
 */
import { ASK, CARD, DISPLAY, FORMULA, IMAGE_DRIFT, MASCOT_PORTAL, TITLE, VISUAL } from './layout';
import type { LineFit } from './fit';
import { INTEGRAL_GLYPH } from './integral-glyph';
import { Plot } from '../plot/Plot';
import type { PlotSpec } from '../plot/geometry';
import { FourierBuild, GcdSubtraction, LeastSquaresFit, NashMatrix, NashMixing } from './anim';
import {
  BEAT_FADE, BLUR_PX, Phase, StoryTimeline, beatAt, beatBuild, progress, stepAt,
} from '../../../shared/story-timeline';
import {
  backgroundDrift, breathe, cardSettle, clamp01, crossfade, easeInOutSine, easeOutBack, lerp,
  mixHex, staggerFor, tokenPose, tokenize,
} from '../../../shared/motion';

/** A computed animation the scene draws in the visual slot, chosen by `type`. */
export type AnimSpec =
  | { type: 'gcd-subtraction'; a: number; b: number }
  | { type: 'least-squares' }
  | { type: 'fourier-build' }
  | { type: 'nash-matrix' }
  | { type: 'nash-mixing' };

/** Anything that can fill the visual slot — for a whole beat or for one step inside it. */
export interface VisualNode {
  visual: 'image' | 'formula' | 'shape' | 'plot' | 'anim' | 'none';
  image?: string | null;       // path relative to the page, when visual === 'image'
  formulaHtml?: string | null; // pre-rendered KaTeX, when visual === 'formula'
  /** Pre-rendered KaTeX per derivation line; the last is the formula. Optional. */
  formulaStepsHtml?: string[] | null;
  formulaFontSize?: number;    // measured so the formula fits the slot instead of being clipped
  shapeSvg?: string | null;    // inline SVG markup, when visual === 'shape'
  plot?: PlotSpec | null;      // a curve to compute and draw, when visual === 'plot'
  anim?: AnimSpec | null;      // a computed animation, when visual === 'anim'
}

/**
 * One step of a beat's visual. `weight` is the word count of the narration this step illustrates,
 * so the picture advances with the voice — see stepAt in the timeline.
 */
export interface StepContent extends VisualNode {
  weight: number;
}

export interface StoryBeatContent extends VisualNode {
  beat: string;
  display: string;
  /**
   * A long beat can carry an ordered sequence of visuals instead of one. When present, `visual`
   * above is ignored and the scene shows the step whose word-weighted slice covers the frame.
   */
  steps?: StepContent[] | null;
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
  /** Fitted font size of each beat's formula stack (unused entries for non-formula beats). */
  formulaFits: LineFit[];
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
      {/* The mascot band itself stays empty — Remotion draws the clip over it. The ∫ beside it
          is the page's, and the clip passes in front of it on the way in and on the way out. */}
      <MascotPortal />

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
  const { frame, phase, pose, timeline } = props;
  const content = props.beats[phase.index];
  const fit = props.displayFits[phase.index];
  const style = { opacity: pose.opacity, transform: `translateY(${pose.translateY.toFixed(2)}px)` };

  // A stepped beat swaps pictures with the narration; a plain beat holds one. The step's own fade
  // rides on top of the beat's cross-fade so a swap dissolves between sentences.
  const steps = content.steps?.length ? content.steps : null;
  let node: VisualNode = content;
  let slot: Phase = phase;
  let build = beatBuild(frame, timeline);
  let stepFade = 1;
  if (steps) {
    const st = stepAt(frame, phase, steps.map((s) => s.weight));
    node = steps[st.index];
    slot = st;
    build = st.build;
    stepFade = st.fade;
  }

  return (
    <div className="layer" style={style}>
      <div className="visual" style={{
        left: `${VISUAL.x - CARD.x}px`, top: `${VISUAL.y - CARD.y}px`,
        width: `${VISUAL.w}px`, height: `${VISUAL.h}px`,
        borderRadius: `${VISUAL.radius}px`,
      }}>
        <div className="layer" style={{ opacity: stepFade }}>
          <Visual
            node={node} frame={frame} phase={slot} build={build}
            fontSize={steps ? node.formulaFontSize : (props.formulaFits[phase.index]?.fontSize ?? node.formulaFontSize)}
          />
        </div>
      </div>

      <DisplayLine frame={frame} start={phase.start} text={content.display} fit={fit} />
    </div>
  );
}

/**
 * The ∫ the mascot walks out of, sized from its ink height alone. The card is opaque from frame 0,
 * and so is this: scenery arriving on its own schedule reads as a mistake.
 */
function MascotPortal() {
  const h = MASCOT_PORTAL.height;
  const w = h * INTEGRAL_GLYPH.aspect;
  return (
    <svg
      className="mascot-portal"
      viewBox={`0 0 ${INTEGRAL_GLYPH.viewBoxWidth} ${INTEGRAL_GLYPH.viewBoxHeight}`}
      width={w}
      height={h}
      preserveAspectRatio="none"
      style={{
        left: `${MASCOT_PORTAL.cx - CARD.x - w / 2}px`,
        top: `${MASCOT_PORTAL.cy - CARD.y - h / 2}px`,
        opacity: MASCOT_PORTAL.opacity,
      }}
    >
      <path d={INTEGRAL_GLYPH.path} fill={MASCOT_PORTAL.colour} />
    </svg>
  );
}

/**
 * One visual — a whole beat or one of its steps. `phase` is the span it owns (the beat, or the
 * step's slice of it) and drives the motion that runs for the whole span: an image's push-in, a
 * formula stack landing line by line. `build` is 0..1 for anything that draws itself in — a
 * plot's stroke, an animation's state. A missing one renders as nothing rather than a
 * placeholder — a slot that looks filled when it is not is the view-layer version of a
 * fabricated field.
 */
function Visual({ node, frame, phase, build, fontSize }: {
  node: VisualNode; frame: number; phase: Phase; build: number; fontSize?: number;
}) {
  const t = progress(frame, phase);

  if (node.visual === 'image' && node.image) {
    // A slow push-in for the whole beat. Alternating direction per beat would be nicer still but
    // reads as a bug when two image beats are adjacent; one direction, always.
    const s = 1 + IMAGE_DRIFT * easeInOutSine(t);
    return <img className="visual-img" src={node.image} alt="" style={{ transform: `scale(${s.toFixed(4)})` }} />;
  }

  if (node.visual === 'formula') {
    const steps = node.formulaStepsHtml?.length ? node.formulaStepsHtml : (node.formulaHtml ? [node.formulaHtml] : []);
    if (!steps.length) return null;
    const span = phase.end - phase.start;
    const stagger = steps.length > 1
      ? Math.max(8, Math.floor((span * FORMULA.landedBy) / (steps.length - 1)))
      : 0;
    const single = steps.length === 1;
    const size = fontSize ?? (single ? FORMULA.fontSize : FORMULA.stackedFontSize);
    return (
      <div className="visual-formula" style={{ gap: `${FORMULA.lineGap}px`, fontSize: `${size}px` }}>
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

  if (node.visual === 'shape' && node.shapeSvg) {
    const s = 1 + 0.03 * easeInOutSine(t);
    return <div className="visual-shape" style={{ transform: `scale(${s.toFixed(4)})` }} dangerouslySetInnerHTML={{ __html: node.shapeSvg }} />;
  }
  if (node.visual === 'plot' && node.plot) {
    return <div className="visual-plot"><Plot spec={node.plot} progress={build} /></div>;
  }
  if (node.visual === 'anim' && node.anim) {
    return <div className="visual-plot"><Anim spec={node.anim} progress={build} /></div>;
  }
  return null;
}

/** Maps an AnimSpec to its computed component. */
function Anim({ spec, progress }: { spec: AnimSpec; progress: number }) {
  switch (spec.type) {
    case 'gcd-subtraction': return <GcdSubtraction a={spec.a} b={spec.b} progress={progress} />;
    case 'least-squares':   return <LeastSquaresFit progress={progress} />;
    case 'fourier-build':   return <FourierBuild progress={progress} />;
    case 'nash-matrix':     return <NashMatrix progress={progress} />;
    case 'nash-mixing':     return <NashMixing progress={progress} />;
  }
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
