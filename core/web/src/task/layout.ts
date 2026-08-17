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
  fallback: 'Answer in the comments',
};

export const RING = {
  cx: 360,
  cy: 675,
  outerR: 264,
  stroke: 66,
  get innerR() { return this.outerR - this.stroke; },   // 198
  /** Centreline the SVG stroke is drawn on. */
  get pathR() { return this.outerR - this.stroke / 2; }, // 231
  track: '#D1C5C0',
  accent: '#1E76C3',
};

/**
 * The statement must sit inside the ring with clearance. 22 px of padding inside the 198 px inner
 * radius leaves a 176 px safe circle, whose inscribed square is what the text has to fit.
 */
export const STATEMENT = {
  padding: 22,
  get safeR() { return RING.innerR - this.padding; },              // 176
  get safeBox() { return (2 * this.safeR) / Math.SQRT2; },         // 248.9
  maxFont: 56,
  minFont: 28,
  step: 2,
  colour: RING.accent,
};

export const HURRY = { x: 224, y: 752, w: 270, h: 270, enterFrames: 11, exitFrames: 11 };
