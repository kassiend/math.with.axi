/**
 * Layout constants specific to the task card, in 720x1280 design units.
 *
 * Every number here was measured pixel-wise from assets/templates/tasks/daily_task.png rather
 * than estimated. If the render stops matching the mockup, re-measure — do not nudge these by eye.
 *
 * The card, footer and mascot slot are shared with the lesson format and live in ../card.ts.
 */
export { CARD, FOOTER, FRAME, CARD_PAD, CONTENT_WIDTH } from '../card';

export const TITLE = {
  top: 245,
  lineHeight: 47,
  fontSize: 40,
  maxWidth: 500,
  maxLines: 3,
  /**
   * When the task supplies no description, the headline is the challenge, not the CTA. The first
   * renders opened on "Answer in the comments" as the biggest text on the card — an ask before
   * the viewer knew what they were being asked. The ask now lives under the ring (see CTA).
   */
  fallback: (durationS: number) => `Can you solve it in ${durationS} seconds?`,
};

/**
 * Countdown ring. Thinner and wider than the first renders (stroke 66 → 26, outer 264 → 270):
 * the ring is the clock, not the subject, and at 66 px it left a 249 px box for the puzzle —
 * which made the puzzle the smallest thing on screen.
 */
export const RING = {
  cx: 360,
  cy: 660,
  outerR: 270,
  stroke: 26,
  get innerR() { return this.outerR - this.stroke; },   // 244
  /** Centreline the SVG stroke is drawn on. */
  get pathR() { return this.outerR - this.stroke / 2; }, // 257
  track: '#D1C5C0',
  accent: '#1E76C3',
  /** The accent warms to this over the last quarter — a re-hook without a word. */
  urgent: '#F26B1D',
  urgentFrom: 0.75,
  urgentRampFrames: 15,
};

/**
 * The statement is the hero: it fills the ring's inner circle, minus clearance and minus a band at
 * the bottom for the seconds readout. 16 px of padding inside the 244 px inner radius leaves a
 * 228 px safe circle; its inscribed square is the width the text may take, and the height is that
 * square less the readout band.
 */
export const STATEMENT = {
  padding: 16,
  get safeR() { return RING.innerR - this.padding; },              // 228
  get safeBox() { return (2 * this.safeR) / Math.SQRT2; },         // 322.4
  get safeHeight() { return this.safeBox - READOUT.reserve; },     // 262.4
  maxFont: 96,
  minFont: 40,
  step: 2,
  colour: RING.accent,
  /** Frames over which the statement pops in at the start. */
  popFrames: 10,
};

/** Whole seconds left, inside the ring under the statement. A number is a finish line. */
export const READOUT = {
  get centreY() { return RING.cy + RING.innerR - 44; },            // 860
  fontSize: 30,
  colour: '#8A94A6',
  /** Vertical room kept clear of the statement. */
  reserve: 60,
};

/** The ask, one line under the ring, above the footer. */
export const CTA = {
  centreY: 962,
  fontSize: 26,
  colour: '#5B6470',
  text: 'Answer in the comments',
  /** After the timer: the ask grows into the payoff. */
  endText: 'Time! Answer in the comments ↓',
  endFontSize: 32,
  endFrames: 12,
};

/** Centred in the ring, just below the statement's centre. */
export const HURRY = { x: 225, y: 640, w: 270, h: 270, enterFrames: 11, exitFrames: 11 };
