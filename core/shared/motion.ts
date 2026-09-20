/**
 * Motion primitives shared by every post format. Pure functions of a frame number — nothing here
 * reads a clock, so a frame captured twice is the same frame.
 *
 * Why these exist at all: the first renders held an unchanged card for 13–21 s while the voice
 * carried on, and a frozen frame is where a thumb leaves. Three rules came out of reviewing them
 * against the short-form playbook (going-viral, reel-builder):
 *
 *   1. nothing on screen is ever fully still — a low-amplitude drift runs the whole time
 *   2. text is BUILT in front of the viewer, token by token, in time with the voice
 *   3. a swap is a cross-fade, never a blank card between two states
 */

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
/** Overshoots slightly then settles — reads as a "pop" rather than a slide. */
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/**
 * A slow push-in on the background across the whole post. 6 % over the full length is enough to
 * register as alive and too little to notice as a zoom. Returns a CSS transform.
 */
export function backgroundDrift(frame: number, totalFrames: number, amount = 0.06): string {
  const t = clamp01(frame / Math.max(1, totalFrames));
  const scale = 1 + amount * easeInOutSine(t);
  // A hint of lateral drift so the motion is not a pure zoom, which the eye reads as a bug.
  const dx = -6 * t;
  return `translate(${dx.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
}

/**
 * Card entrance. The card is fully opaque from frame 0 — frame 0 IS the hook, and a card fading in
 * from nothing means the hook lands on an empty frame. Only a small settle from 0.96 remains.
 */
export function cardSettle(frame: number, frames = 8): { scale: number } {
  const t = easeOutCubic(clamp01(frame / Math.max(1, frames)));
  return { scale: lerp(0.96, 1, t) };
}

export interface TokenPose { opacity: number; translateY: number; scale: number }

/**
 * Staggered build-up for a run of tokens. Token `i` begins at `start + i * stagger` and takes
 * `perToken` frames to land. Everything is landed by `start + (n-1)*stagger + perToken`.
 *
 * @param stagger   frames between successive tokens
 * @param perToken  frames a single token takes to land
 */
export function tokenPose(
  frame: number, start: number, i: number, stagger: number, perToken = 7,
): TokenPose {
  const t = clamp01((frame - start - i * stagger) / Math.max(1, perToken));
  const e = easeOutBack(t);
  return { opacity: clamp01(t * 1.6), translateY: lerp(18, 0, e), scale: lerp(0.86, 1, e) };
}

/** Frames between tokens so that `count` tokens land within `budget` frames, capped at `max`. */
export function staggerFor(count: number, budget: number, max = 7, perToken = 7): number {
  if (count <= 1) return 0;
  return Math.max(1, Math.min(max, Math.floor((budget - perToken) / (count - 1))));
}

/** Frame at which the last of `count` tokens has fully landed. */
export function tokensLandedAt(start: number, count: number, stagger: number, perToken = 7): number {
  return start + Math.max(0, count - 1) * stagger + perToken;
}

/**
 * Cross-fade between two states. During the first `frames` of the new state the outgoing one is
 * still drawn, fading and drifting up, while the incoming one rises into place. There is never a
 * frame with neither.
 */
export function crossfade(frame: number, boundary: number, frames = 8) {
  const t = easeOutCubic(clamp01((frame - boundary) / Math.max(1, frames)));
  return {
    outgoing: { opacity: 1 - t, translateY: lerp(0, -14, t) },
    incoming: { opacity: t, translateY: lerp(14, 0, t) },
    active: frame >= boundary && frame < boundary + frames,
  };
}

/** A gentle breathing scale, period in frames. Amplitude is tiny on purpose. */
export function breathe(frame: number, period = 96, amplitude = 0.012): number {
  return 1 + amplitude * Math.sin((2 * Math.PI * frame) / period);
}

/** Mix two hex colours. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, clamp01(t)));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

/** Split display text into tokens that pop in one at a time. Whitespace is preserved between. */
export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

// --- glyph continuity ---------------------------------------------------------
// The mechanism of a lesson is what the digits DO: 92 splits into 9 _ 2, the 11 slides to the
// end, a carry appears. Building each step as fresh text shows the result of the step; moving the
// glyphs that survive from one step to the next shows the step itself.

/** Longest common subsequence over glyphs; returns index pairs [i in a, j in b]. */
export function matchGlyphs(a: string[], b: string[]): Array<[number, number]> {
  const n = a.length; const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0; let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

/** Slide progress with a soft start and stop; the same curve for every glyph. */
export const slideEase = (t: number) => easeInOutSine(clamp01(t));
