/**
 * Capture entry point for a story post. Contract as elsewhere:
 *   window.__AXI_STORY / __axiFrameCount / __axiSeek(n) / __axiReady / __axiFit
 */
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import katex from 'katex';
import { StoryScene, type StoryBeatContent } from './StoryScene';
import { fitStory, measureFormula } from './fit';
import { buildStoryTimeline } from '../../../shared/story-timeline';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import 'katex/dist/katex.min.css';
import './styles.css';

declare global {
  interface Window {
    __AXI_STORY?: any;
    __axiFrameCount?: number;
    __axiSeek?: (frame: number) => void;
    __axiReady?: boolean;
    __axiFit?: unknown;
  }
}

const payload = window.__AXI_STORY ?? null;
const root = createRoot(document.getElementById('root')!);

function fatal(message: string) {
  root.render(<div className="fatal">{message}</div>);
  window.__axiFrameCount = 0;
  window.__axiSeek = () => {};
  window.__axiReady = true;
}

/** A formula the typesetter rejects must never reach a frame looking fine. */
function typeset(latex: string): string {
  try {
    return katex.renderToString(latex, {
      displayMode: true, throwOnError: true, strict: 'error', output: 'html', trust: false,
    });
  } catch (err) {
    return `<span data-katex-error="1">⟨LaTeX error: ${String(err)}⟩</span>`;
  }
}

if (!payload) {
  fatal('no story payload injected');
} else {
  const timeline = buildStoryTimeline(
    (payload.beats ?? []).map((b: any) => ({ beat: b.beat, seconds: b.seconds })),
    payload.mascot,
  );

  // One step of a stepped beat. A formula step is typeset here, exactly like a whole-beat formula;
  // a plot/anim/shape step passes its spec straight through. `weight` defaults to 1 so an
  // unweighted list divides the beat evenly.
  const buildStep = (s: any) => ({
    visual: s.visual ?? 'none',
    image: s.image ?? null,
    formulaHtml: s.formula_latex ? typeset(s.formula_latex) : null,
    shapeSvg: s.shape_svg ?? null,
    plot: s.plot ?? null,
    anim: s.anim ?? null,
    weight: typeof s.weight === 'number' && s.weight > 0 ? s.weight : 1,
  });

  const beats: StoryBeatContent[] = (payload.beats ?? []).map((b: any) => ({
    beat: b.beat,
    display: b.display ?? '',
    visual: b.visual ?? 'none',
    image: b.image ?? null,
    formulaHtml: b.formula_latex ? typeset(b.formula_latex) : null,
    shapeSvg: b.shape_svg ?? null,
    plot: b.plot ?? null,
    anim: b.anim ?? null,
    steps: Array.isArray(b.steps) && b.steps.length ? b.steps.map(buildStep) : null,
  }));

  // KaTeX loads its faces lazily, on first use, so document.fonts.ready can settle before they
  // have been asked for at all. A formula beat would then be screenshotted in a fallback face —
  // intermittently, and only on whichever machine loses the race. Ask for them explicitly.
  document.fonts.ready
    .then(() => Promise.all([
      document.fonts.load('100px KaTeX_Size2'),
      document.fonts.load('100px KaTeX_Main'),
    ]))
    .then(() => {
      const formulaFits = beats.map((b) => {
        // A formula step needs the same slot-fit measurement as a whole-beat formula, or it
        // overflows and is clipped exactly the way the mechanism formula was.
        for (const s of b.steps ?? []) {
          if (s.formulaHtml) s.formulaFontSize = measureFormula(s.formulaHtml).fontSize;
        }
        if (!b.formulaHtml) return null;
        const m = measureFormula(b.formulaHtml);
        b.formulaFontSize = m.fontSize;
        return m;
      });

      const fit = fitStory(payload.title ?? '', beats.map((b) => b.display));
      // Recorded into the capture manifest: a formula silently set to a third of its size is
      // something to be able to see after the fact, not only in the finished frame.
      window.__axiFit = { ...fit, formulaFits };
      if (!fit.fits) {
        fatal(`text does not fit: ${JSON.stringify(fit.problems)}`);
        return;
      }

      window.__axiFrameCount = timeline.totalFrames;
      window.__axiSeek = (frame: number) => {
        flushSync(() => root.render(
          <StoryScene
            frame={frame}
            timeline={timeline}
            background={payload.background}
            title={payload.title}
            beats={beats}
            titleFit={fit.titleFit}
            displayFits={fit.displayFits}
          />,
        ));
      };

      window.__axiSeek(0);
      window.__axiReady = true;
    });
}
