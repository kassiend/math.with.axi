/**
 * The story card scene. Every visual is a pure function of `frame`.
 *
 * What this page does NOT draw: the mascot. It is video — a keyed clip that walks in, reads, and
 * walks out — composited by Remotion on top of this capture. The page reserves its band and
 * draws everything else.
 */
import { CARD, DISPLAY, TITLE, VISUAL } from './layout';
import type { LineFit } from './fit';
import {
  BLUR_PX, StoryTimeline, beatAt, beatOpacity, easeOutCubic, lerp, progress,
} from '../../../shared/story-timeline';

export interface StoryBeatContent {
  beat: string;
  display: string;
  /** What fills the visual slot for this beat. */
  visual: 'image' | 'formula' | 'shape' | 'none';
  image?: string | null;      // path relative to the page, when visual === 'image'
  formulaHtml?: string | null; // pre-rendered KaTeX, when visual === 'formula'
  shapeSvg?: string | null;    // inline SVG markup, when visual === 'shape'
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

  return (
    <div className="card" style={{
      left: `${CARD.x}px`, top: `${CARD.y}px`, width: `${CARD.w}px`, height: `${CARD.h}px`,
      borderRadius: `${CARD.radius}px`, borderWidth: `${CARD.border}px`,
      opacity: t, transform: `scale(${scale.toFixed(4)})`,
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

      {content && (
        <div className="visual" style={{
          left: `${VISUAL.x - CARD.x}px`, top: `${VISUAL.y - CARD.y}px`,
          width: `${VISUAL.w}px`, height: `${VISUAL.h}px`,
          borderRadius: `${VISUAL.radius}px`, opacity,
        }}>
          <Visual content={content} />
        </div>
      )}

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
 * One visual per beat. A missing one renders as nothing rather than as a placeholder — a slot
 * that looks filled when it is not is the view-layer version of a fabricated field.
 */
function Visual({ content }: { content: StoryBeatContent }) {
  if (content.visual === 'image' && content.image) {
    return <img className="visual-img" src={content.image} alt="" />;
  }
  if (content.visual === 'formula' && content.formulaHtml) {
    return <div className="visual-formula" dangerouslySetInnerHTML={{ __html: content.formulaHtml }} />;
  }
  if (content.visual === 'shape' && content.shapeSvg) {
    return <div className="visual-shape" dangerouslySetInnerHTML={{ __html: content.shapeSvg }} />;
  }
  return null;
}
