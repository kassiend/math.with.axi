/**
 * Capture entry point for a story post. Contract as elsewhere:
 *   window.__AXI_STORY / __axiFrameCount / __axiSeek(n) / __axiReady / __axiFit
 */
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import katex from 'katex';
import { StoryScene, type StoryBeatContent } from './StoryScene';
import { fitStory } from './fit';
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

  const beats: StoryBeatContent[] = (payload.beats ?? []).map((b: any) => ({
    beat: b.beat,
    display: b.display ?? '',
    visual: b.visual ?? 'none',
    image: b.image ?? null,
    formulaHtml: b.formula_latex ? typeset(b.formula_latex) : null,
    shapeSvg: b.shape_svg ?? null,
  }));

  document.fonts.ready.then(() => {
    const fit = fitStory(payload.title ?? '', beats.map((b) => b.display));
    window.__axiFit = fit;
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
