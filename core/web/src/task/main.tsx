/**
 * Capture entry point for a task post.
 *
 * Contract with pipeline/stages/capture-task.mjs:
 *   window.__AXI_TASK      the payload, injected before any script runs
 *   window.__axiFrameCount total frames
 *   window.__axiSeek(n)    render frame n synchronously
 *   window.__axiReady      true once the statement has been fitted and fonts are loaded
 *   window.__axiFit        the fit result — the capture stage FAILS the run if fits is false
 */
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TaskScene } from './TaskScene';
import { TITLE } from './layout';
import { fitStatement, statementHtml } from './fit';
import { buildTaskTimeline } from '../../../shared/task-timeline';
// Vendored Inter — never the system font, or the capture becomes machine-dependent.
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import 'katex/dist/katex.min.css';
import './styles.css';

declare global {
  interface Window {
    __AXI_TASK?: any;
    __axiFrameCount?: number;
    __axiSeek?: (frame: number) => void;
    __axiReady?: boolean;
    __axiFit?: unknown;
  }
}

const payload = window.__AXI_TASK ?? null;
const root = createRoot(document.getElementById('root')!);

function fatal(message: string) {
  root.render(<div className="fatal">{message}</div>);
  window.__axiFrameCount = 0;
  window.__axiSeek = () => {};
  window.__axiReady = true;
}

if (!payload) {
  // No payload means no post. Never render a plausible-looking placeholder — that is how a
  // fabricated frame ships.
  fatal('no task payload injected');
} else {
  const timeline = buildTaskTimeline(
    payload.duration_s,
    payload.seed ?? 0,
    payload.hurry_audio_seconds ?? 1,
  );

  const html = statementHtml(payload.statement, payload.statement_latex);
  const title = payload.description ?? TITLE.fallback;

  // Fonts must be loaded before measuring, or the fit is computed against a fallback face and
  // the real face overflows the ring.
  document.fonts.ready.then(() => {
    const fit = fitStatement(html);
    window.__axiFit = fit;

    if (!fit.fits) {
      // A hard gate from the template: rejected, not squeezed. The capture stage reads __axiFit
      // and fails the run rather than producing a frame with the statement over the ring.
      fatal(`statement does not fit: ${fit.reason}`);
      return;
    }

    window.__axiFrameCount = timeline.totalFrames;
    window.__axiSeek = (frame: number) => {
      flushSync(() => root.render(
        <TaskScene
          frame={frame}
          timeline={timeline}
          background={payload.background}
          still={payload.still}
          title={title}
          statementHtml={html}
          statementFontSize={fit.fontSize}
        />,
      ));
    };

    window.__axiSeek(0);
    window.__axiReady = true;
  });
}
