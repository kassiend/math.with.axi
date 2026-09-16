/**
 * Capture entry point for a lesson post.
 *
 * Contract with pipeline/stages/capture-lesson.mjs:
 *   window.__AXI_LESSON     the payload, injected before any script runs
 *   window.__axiFrameCount  total frames
 *   window.__axiSeek(n)     render frame n synchronously
 *   window.__axiReady       true once every line has been fitted and fonts are loaded
 *   window.__axiFit         the fit result — the capture stage FAILS the run if fits is false
 */
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { LessonScene } from './LessonScene';
import { fitLesson } from './fit';
import { ASK } from './layout';
import { buildLessonTimeline } from '../../../shared/lesson-timeline';
// Vendored Inter — never the system font, or the capture becomes machine-dependent.
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import './styles.css';
import { fontsLoaded } from '../fonts';

declare global {
  interface Window {
    __AXI_LESSON?: any;
    __axiFrameCount?: number;
    __axiSeek?: (frame: number) => void;
    __axiReady?: boolean;
    __axiFit?: unknown;
  }
}

const payload = window.__AXI_LESSON ?? null;
const root = createRoot(document.getElementById('root')!);

function fatal(message: string) {
  root.render(<div className="fatal">{message}</div>);
  window.__axiFrameCount = 0;
  window.__axiSeek = () => {};
  window.__axiReady = true;
}

if (!payload) {
  // No payload means no lesson. Never render a plausible-looking placeholder — that is how a
  // fabricated frame ships.
  fatal('no lesson payload injected');
} else {
  const steps = payload.steps ?? [];
  const timeline = buildLessonTimeline(
    payload.intro_seconds ?? 0,
    steps.map((s: any) => ({ stepId: s.step_id, seconds: s.seconds })),
    payload.outro_seconds ?? null,
  );

  // The hook's on-screen line is the narrator's; when it wrote none, the first instruction
  // stands in. The ask likewise falls back to the layout's default — a post must end on one.
  const hookDisplay: string = payload.hook_display || steps[0]?.instruction || '';
  const ask: string = payload.ask || ASK.fallback;

  // Fonts must be loaded before measuring, or every line is fitted against a fallback face and
  // the real face overflows the card.
  fontsLoaded().then(() => {
    const fit = fitLesson(steps, hookDisplay, ask);
    window.__axiFit = fit;

    if (!fit.fits) {
      fatal(`display text does not fit: ${JSON.stringify(fit.problems)}`);
      return;
    }

    window.__axiFrameCount = timeline.totalFrames;
    window.__axiSeek = (frame: number) => {
      flushSync(() => root.render(
        <LessonScene
          frame={frame}
          timeline={timeline}
          background={payload.background}
          title={payload.title}
          steps={steps}
          hookDisplay={hookDisplay}
          ask={ask}
          fit={fit}
        />,
      ));
    };

    window.__axiSeek(0);
    window.__axiReady = true;
  });
}
