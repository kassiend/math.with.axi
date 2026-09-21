/**
 * The story card scene. Every visual is a pure function of `frame`.
 *
 * Documentary-cinematic: the image fills the card to its border, dark scrims top and bottom
 * carry the type, one display face, one accent. See layout.ts for why this is the third pass.
 *
 * What this page does NOT draw: the mascot. It is video — a keyed clip that walks in, reads, and
 * walks out — composited by Remotion over the top scrim. The page reserves its band.
 *
 *   - every beat has an image behind it; a formula beat keeps the previous image, dimmed and
 *     blurred, and stacks the derivation on top, one line at a time in time with the voice
 *   - a beat may carry a stat: a huge accent number counted up over the first second
 *   - beat changes cross-fade; the image drifts for its whole beat; nothing is ever still
 *   - the story ends on an ask under the payoff line; a hairline shows how far along it is
 */
import {
  ASK, CARD, DISPLAY, FORMULA, IMAGE_DRIFT, INNER, PALETTE, PROGRESS, SCRIM, STAT, TITLE,
} from './layout';
import type { LineFit } from './fit';
import {
  BEAT_FADE, BLUR_PX, StoryTimeline, beatAt, progress,
} from '../../../shared/story-timeline';
import {
  backgroundDrift, breathe, cardSettle, clamp01, crossfade, easeInOutSine, easeOutBack,
  easeOutCubic, lerp, staggerFor, tokenPose, tokenize,
} from '../../../shared/motion';

export interface StoryStat { prefix?: string | null; value: string; suffix?: string | null; count?: boolean | null }

/** A bare four-digit 1000–2199 is a year; a year is a name, not a quantity, and never counts up. */
const looksLikeYear = (v: string) => /^\d{4}$/.test(v.trim()) && Number(v) >= 1000 && Number(v) < 2200;

export interface StoryBeatContent {
  beat: string;
  display: string;
  /** What fills the visual slot for this beat. */
  visual: 'image' | 'formula' | 'shape' | 'none';
  image?: string | null;       // path relative to the page; the image behind this beat
  formulaHtml?: string | null; // pre-rendered KaTeX, when visual === 'formula'
  /** Pre-rendered KaTeX per derivation line; the last is the formula. Optional. */
  formulaStepsHtml?: string[] | null;
  shapeSvg?: string | null;    // inline SVG markup, when visual === 'shape'
  stat?: StoryStat | null;
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
  statFits: Array<LineFit | null>;
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

/** The image a beat shows: its own, or the nearest earlier one (a formula beat inherits). */
function imageFor(beats: StoryBeatContent[], index: number): string | null {
  for (let i = index; i >= 0; i--) if (beats[i].image) return beats[i].image!;
  for (let i = index + 1; i < beats.length; i++) if (beats[i].image) return beats[i].image!;
  return null;
}

function Card(props: StorySceneProps) {
  const { frame, timeline } = props;
  const { scale } = cardSettle(frame, timeline.cardIn.end);

  const beat = beatAt(frame, timeline);
  const fade = beat ? crossfade(frame, beat.start, BEAT_FADE) : null;
  const previous = beat && beat.index > 0 && fade?.active ? timeline.beats[beat.index - 1] : null;

  const last = timeline.beats[timeline.beats.length - 1];
  const showAsk = last != null && frame >= last.start;
  const done = clamp01(frame / Math.max(1, timeline.hold.start));

  return (
    <div className="card" style={{
      left: `${CARD.x}px`, top: `${CARD.y}px`, width: `${CARD.w}px`, height: `${CARD.h}px`,
      borderRadius: `${CARD.radius}px`, borderWidth: `${CARD.border}px`,
      transform: `scale(${scale.toFixed(4)})`,
    }}>
      {/* Full-bleed image layers: the outgoing one under the incoming one during a cross-fade. */}
      {previous && fade && <ImageLayer {...props} phase={previous} opacity={1} />}
      {beat && fade && <ImageLayer {...props} phase={beat} opacity={beat.index > 0 ? fade.incoming.opacity : 1} />}

      <div className="scrim top" style={{
        height: `${SCRIM.top}px`,
        background: `linear-gradient(180deg, rgba(7,9,15,${SCRIM.topAlpha}) 0%, rgba(7,9,15,0.55) 45%, rgba(7,9,15,0) 100%)`,
      }} />
      <div className="scrim bottom" style={{
        height: `${SCRIM.bottom}px`,
        background: `linear-gradient(0deg, rgba(7,9,15,${SCRIM.bottomAlpha}) 0%, rgba(7,9,15,0.7) 40%, rgba(7,9,15,0) 100%)`,
      }} />

      {/* The mascot band stays empty — Remotion draws the clip over it. */}

      <div className="story-title" style={{
        top: `${TITLE.top - CARD.y}px`, left: `${TITLE.left - CARD.x}px`,
        fontSize: `${props.titleFit.fontSize}px`,
        lineHeight: `${Math.round(props.titleFit.fontSize * TITLE.lineHeightRatio)}px`,
        width: `${TITLE.maxWidth}px`, color: TITLE.colour, fontWeight: TITLE.weight,
      }}>
        {props.title}
      </div>

      {previous && fade && <TextLayer {...props} phase={previous} pose={fade.outgoing} />}
      {beat && fade && <TextLayer {...props} phase={beat} pose={beat.index > 0 ? fade.incoming : { opacity: 1, translateY: 0 }} />}

      {showAsk && (
        <AskLine frame={frame} start={last.start + 24} text={props.ask} fit={props.askFit} />
      )}

      <div className="progress-track" style={{ height: `${PROGRESS.height}px`, background: PROGRESS.track }}>
        <div className="progress-fill" style={{ width: `${(done * 100).toFixed(2)}%`, background: PROGRESS.colour }} />
      </div>
    </div>
  );
}

interface Pose { opacity: number; translateY: number }
type Phase = StoryTimeline['beats'][number];

/** The image behind a beat: full-bleed, drifting; pushed back and blurred under a formula. */
function ImageLayer(props: StorySceneProps & { phase: Phase; opacity: number }) {
  const { frame, phase, beats, opacity } = props;
  const content = beats[phase.index];
  const src = imageFor(beats, phase.index);
  const t = progress(frame, phase);
  const isFormula = content.visual === 'formula';
  // A formula beat pushes the image back over its first half-second; the stack lands on top.
  const dim = isFormula ? easeOutCubic(clamp01((frame - phase.start) / 15)) : 0;
  const scale = 1 + IMAGE_DRIFT * easeInOutSine(t) + (isFormula ? 0.04 * dim : 0);

  return (
    <div className="image-layer" style={{
      borderRadius: `${INNER.radius}px`, opacity, background: PALETTE.scrim,
    }}>
      {src && (
        <img className="image" src={src} alt="" style={{
          transform: `scale(${scale.toFixed(4)})`,
          filter: dim > 0 ? `brightness(${lerp(1, FORMULA.imageDim, dim).toFixed(3)}) blur(${(FORMULA.imageBlur * dim).toFixed(1)}px)` : undefined,
        }} />
      )}
      {content.visual === 'shape' && content.shapeSvg && (
        <div className="visual-shape" style={{ transform: `scale(${(1 + 0.03 * easeInOutSine(t)).toFixed(4)})` }}
             dangerouslySetInnerHTML={{ __html: content.shapeSvg }} />
      )}
    </div>
  );
}

/** Everything typographic for a beat: the stat, the formula stack, the display line. */
function TextLayer(props: StorySceneProps & { phase: Phase; pose: Pose }) {
  const { frame, phase, pose, beats } = props;
  const content = beats[phase.index];
  const fit = props.displayFits[phase.index];
  const style = { opacity: pose.opacity, transform: `translateY(${pose.translateY.toFixed(2)}px)` };

  return (
    <div className="layer" style={style}>
      {content.stat && props.statFits[phase.index] && (
        <Stat frame={frame} phase={phase} stat={content.stat} fontSize={props.statFits[phase.index]!.fontSize} />
      )}
      {content.visual === 'formula' && (
        <FormulaStack frame={frame} phase={phase} content={content} fontSize={props.formulaFits[phase.index]?.fontSize} />
      )}
      <DisplayLine frame={frame} start={phase.start} text={content.display} fit={fit} />
    </div>
  );
}

/** Digits count up from zero over the first second; non-digit characters stay put. */
function countUp(value: string, t: number): string {
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return value;
  const target = Number(digits);
  const shown = Math.round(target * easeOutCubic(t));
  const s = String(shown).padStart(digits.length, '0');
  let k = 0;
  return value.replace(/[0-9]/g, () => s[k++] ?? '0');
}

function Stat({ frame, phase, stat, fontSize }: { frame: number; phase: Phase; stat: StoryStat; fontSize: number }) {
  const counts = stat.count ?? !looksLikeYear(stat.value);
  const t = counts ? clamp01((frame - phase.start) / STAT.countFrames) : 1;
  const pop = easeOutBack(clamp01((frame - phase.start) / 10));
  const settled = t >= 1 ? breathe(frame, 90, 0.01) : 1;
  return (
    <div className="stat" style={{
      top: `${STAT.centreY - CARD.y}px`, left: `${TITLE.left - CARD.x}px`, width: `${STAT.maxWidth}px`,
      opacity: clamp01(pop * 1.4), transform: `translateY(-50%) scale(${(lerp(0.9, 1, pop) * settled).toFixed(4)})`,
    }}>
      {stat.prefix && <div className="stat-prefix" style={{ fontSize: `${STAT.prefixSize}px` }}>{stat.prefix}</div>}
      <div className="stat-value" style={{ fontSize: `${fontSize}px`, color: STAT.colour }}>
        {countUp(stat.value, t)}
      </div>
      {stat.suffix && <div className="stat-prefix" style={{ fontSize: `${STAT.prefixSize}px` }}>{stat.suffix}</div>}
    </div>
  );
}

function FormulaStack({ frame, phase, content, fontSize }: {
  frame: number; phase: Phase; content: StoryBeatContent; fontSize?: number;
}) {
  const steps = content.formulaStepsHtml?.length ? content.formulaStepsHtml : (content.formulaHtml ? [content.formulaHtml] : []);
  if (!steps.length) return null;
  const span = phase.end - phase.start;
  const stagger = steps.length > 1 ? Math.max(8, Math.floor((span * FORMULA.landedBy) / (steps.length - 1))) : 0;
  const size = fontSize ?? (steps.length === 1 ? FORMULA.fontSize : FORMULA.stackedFontSize);
  return (
    <div className="formula-stack" style={{
      top: `${FORMULA.centreY - CARD.y}px`, gap: `${FORMULA.lineGap}px`, fontSize: `${size}px`,
      left: `${FORMULA.padding}px`, width: `${INNER.w - 2 * FORMULA.padding}px`,
    }}>
      {steps.map((html, i) => {
        const local = clamp01((frame - phase.start - i * stagger) / 10);
        const e = easeOutBack(local);
        const isLast = i === steps.length - 1;
        const nextLanded = !isLast && frame >= phase.start + (i + 1) * stagger;
        const opacity = clamp01(local * 1.5) * (nextLanded ? FORMULA.dim : 1);
        const s = lerp(0.9, 1, e) * (isLast && local >= 1 ? breathe(frame) : 1);
        return (
          <div key={i} className={`formula-line${isLast ? ' final' : ''}`} style={{
            opacity, color: isLast ? FORMULA.emphasis : FORMULA.colour,
            transform: `translateY(${lerp(16, 0, e).toFixed(2)}px) scale(${s.toFixed(4)})`,
          }} dangerouslySetInnerHTML={{ __html: html }} />
        );
      })}
    </div>
  );
}

/** The beat's line, built token by token as the beat opens. */
function DisplayLine({ frame, start, text, fit }: { frame: number; start: number; text: string; fit: LineFit }) {
  const tokens = tokenize(text);
  const stagger = staggerFor(tokens.length, 30, 5);
  return (
    <div className="display" style={{
      top: `${DISPLAY.top - CARD.y}px`, left: `${DISPLAY.left - CARD.x}px`, width: `${DISPLAY.maxWidth}px`,
      fontSize: `${fit.fontSize}px`,
      lineHeight: `${Math.round(fit.fontSize * DISPLAY.lineHeightRatio)}px`,
      color: DISPLAY.colour, fontWeight: DISPLAY.weight,
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
      left: `${ASK.left - CARD.x}px`, width: `${ASK.maxWidth}px`, fontSize: `${fit.fontSize}px`,
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
