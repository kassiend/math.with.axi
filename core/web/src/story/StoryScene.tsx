/**
 * The story card scene. Every visual is a pure function of `frame`.
 *
 * What this page does NOT draw: the mascot. It is video — a keyed clip that walks in, reads, and
 * walks out — composited by Remotion on top of this capture. The page reserves its band and
 * draws everything else.
 *
 * It DOES draw the ∫ he walks out of, because that is scenery and scenery belongs in the capture.
 * It sits under the clip, in the corridor the walk crosses; see MASCOT_PORTAL in layout.
 */
import { CARD, DISPLAY, MASCOT_PORTAL, TITLE, VISUAL } from './layout';
import type { LineFit } from './fit';
import { INTEGRAL_GLYPH } from './integral-glyph';
import { Plot } from '../plot/Plot';
import type { PlotSpec } from '../plot/geometry';
import { FourierBuild, GcdSubtraction, LeastSquaresFit, NashMatrix, NashMixing } from './anim';
import {
  BLUR_PX, StoryTimeline, beatAt, beatBuild, beatOpacity, easeOutCubic, lerp, progress, stepAt,
} from '../../../shared/story-timeline';

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
  titleFit: LineFit;
  displayFits: LineFit[];
}

export function StoryScene(props: StorySceneProps) {
  return (
    <div className="frame">
      <Background src={props.background} />
      <Card {...props} />
    </div>
  );
}

function Background({ src }: { src: string }) {
  return <img className="bg" src={`./bg/${src}`} alt="" style={{ filter: `blur(${BLUR_PX}px)` }} />;
}

function Card(props: StorySceneProps) {
  const { frame, timeline } = props;
  if (frame < timeline.cardIn.start) return null;

  const t = easeOutCubic(progress(frame, timeline.cardIn));
  const scale = lerp(0.85, 1, t);

  const beat = beatAt(frame, timeline);
  const content = beat ? props.beats[beat.index] : null;
  const fit = beat ? props.displayFits[beat.index] : null;
  const opacity = beatOpacity(frame, timeline);
  const build = beatBuild(frame, timeline);

  return (
    <div className="card" style={{
      left: `${CARD.x}px`, top: `${CARD.y}px`, width: `${CARD.w}px`, height: `${CARD.h}px`,
      borderRadius: `${CARD.radius}px`, borderWidth: `${CARD.border}px`,
      opacity: t, transform: `scale(${scale.toFixed(4)})`,
    }}>
      {/* The mascot band itself stays empty — Remotion draws the clip over it. The ∫ beside it
          is the page's, and the clip passes in front of it on the way in and on the way out. */}
      <MascotPortal cardIn={t} />

      <div className="story-title" style={{
        top: `${TITLE.top - CARD.y}px`,
        fontSize: `${props.titleFit.fontSize}px`,
        lineHeight: `${Math.round(props.titleFit.fontSize * TITLE.lineHeightRatio)}px`,
        width: `${TITLE.maxWidth}px`, color: TITLE.colour,
      }}>
        {props.title}
      </div>

      {content && (() => {
        // A stepped beat swaps pictures with the narration; a plain beat holds one. The step's
        // own fade rides on top of the beat fade so a swap dissolves between sentences.
        const steps = content.steps?.length ? content.steps : null;
        let node: VisualNode = content;
        let vBuild = build;
        let vOpacity = opacity;
        if (steps && beat) {
          const st = stepAt(frame, beat, steps.map((s) => s.weight));
          node = steps[st.index];
          vBuild = st.build;
          vOpacity = opacity * st.fade;
        }
        return (
          <div className="visual" style={{
            left: `${VISUAL.x - CARD.x}px`, top: `${VISUAL.y - CARD.y}px`,
            width: `${VISUAL.w}px`, height: `${VISUAL.h}px`,
            borderRadius: `${VISUAL.radius}px`, opacity: vOpacity,
          }}>
            <Visual node={node} build={vBuild} />
          </div>
        );
      })()}

      {content && fit && (
        <div className="display" style={{
          top: `${DISPLAY.top - CARD.y}px`,
          width: `${DISPLAY.maxWidth}px`,
          fontSize: `${fit.fontSize}px`,
          lineHeight: `${Math.round(fit.fontSize * DISPLAY.lineHeightRatio)}px`,
          color: DISPLAY.colour, opacity,
        }}>
          {content.display}
        </div>
      )}

    </div>
  );
}

/**
 * The ∫ the mascot walks out of, sized from its ink height alone.
 *
 * It fades in with the card rather than on its own schedule: two things arriving at slightly
 * different times where one is scenery for the other reads as a mistake.
 */
function MascotPortal({ cardIn }: { cardIn: number }) {
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
        opacity: MASCOT_PORTAL.opacity * cardIn,
      }}
    >
      <path d={INTEGRAL_GLYPH.path} fill={MASCOT_PORTAL.colour} />
    </svg>
  );
}

/**
 * One visual — a whole beat or one of its steps. `build` is 0..1 progress for anything that draws
 * itself in (a plot's stroke, an animation's state). A missing one renders as nothing rather than
 * a placeholder — a slot that looks filled when it is not is the view-layer version of a
 * fabricated field.
 */
function Visual({ node, build }: { node: VisualNode; build: number }) {
  if (node.visual === 'image' && node.image) {
    return <img className="visual-img" src={node.image} alt="" />;
  }
  if (node.visual === 'formula' && node.formulaHtml) {
    return (
      <div
        className="visual-formula"
        style={node.formulaFontSize ? { fontSize: `${node.formulaFontSize}px` } : undefined}
        dangerouslySetInnerHTML={{ __html: node.formulaHtml }}
      />
    );
  }
  if (node.visual === 'shape' && node.shapeSvg) {
    return <div className="visual-shape" dangerouslySetInnerHTML={{ __html: node.shapeSvg }} />;
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
