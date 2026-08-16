/**
 * Capture entry point. Wires the page to pipeline/stages/capture.mjs via the contract in
 * capture-contract.ts.
 *
 * flushSync is deliberate: __axiSeek must have finished rendering by the time it returns, or
 * Playwright screenshots a frame that has not been painted yet.
 */
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Lesson } from './Lesson';
import { buildTimeline, totalFrames } from './timeline';
import './styles.css';
import './capture-contract';

const lesson: any = (window as any).__AXI_LESSON ?? null;
const container = document.getElementById('root')!;
const root = createRoot(container);

if (!lesson) {
  // No payload means no lesson. The page says so rather than showing a plausible-looking demo —
  // a placeholder that renders like real content is exactly how a fabricated frame ships.
  root.render(<div className="stage"><p className="missing">no lesson payload injected</p></div>);
  window.__axiFrameCount = 0;
  window.__axiSeek = () => {};
  window.__axiReady = true;
} else {
  const segmentSeconds = lesson.__segment_seconds ?? undefined;
  const beats = buildTimeline(lesson, segmentSeconds);

  // `background` is a filename inside web/public/bg/, synced by tools/sync-backgrounds.mjs.
  // Absent means the component's default; explicit null means no background at all.
  const background = lesson.background === undefined ? undefined : lesson.background;

  window.__axiFrameCount = totalFrames(beats);
  window.__axiSeek = (frame: number) => {
    flushSync(() => root.render(<Lesson beats={beats} frame={frame} background={background} />));
  };

  window.__axiSeek(0);
  document.fonts.ready.then(() => { window.__axiReady = true; });
}
