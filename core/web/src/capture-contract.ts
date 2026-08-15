/**
 * The contract between this page and pipeline/stages/capture.mjs.
 *
 * Playwright drives the page frame by frame. Nothing in the lesson may be time-based — no
 * setTimeout, no CSS transitions, no requestAnimationFrame loops. Every visual state is a pure
 * function of the frame number, because a capture loop that runs at an unpredictable speed will
 * otherwise produce a different video every time.
 *
 *   window.__axiLesson      the payload, injected before any script runs
 *   window.__axiFrameCount  total frames; set once, before __axiReady
 *   window.__axiSeek(n)     render frame n SYNCHRONOUSLY and return
 *   window.__axiReady       true once the first paint is complete and fonts are loaded
 */
export interface CaptureContract {
  __AXI_LESSON?: unknown;
  __axiFrameCount?: number;
  __axiSeek?: (frame: number) => void;
  __axiReady?: boolean;
}

declare global {
  interface Window extends CaptureContract {}
}

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const seconds = (s: number) => Math.round(s * FPS);
