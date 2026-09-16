/**
 * Layout for the story card, in 720x1280 design units.
 *
 * DIFFERENT FROM THE FIRST PASS, which followed story_example.png literally and read as a mostly
 * empty card: a 350x294 picture floating in a 612-wide box, with two thirds of the card white.
 * A story has to hold a scrolling thumb for fifty seconds, and white space does not.
 *
 * The visual now fills the card's usable width, the title sits tight above it, and the beat line
 * sits directly under it in the accent colour. Nothing else competes.
 */
export { CARD, FRAME, CARD_PAD, CONTENT_WIDTH } from '../card';
import { CONTENT_WIDTH } from '../card';

/**
 * Reserved for the mascot clip; nothing is drawn here by the page.
 * Larger than the mockup's 69x107 — at that size he was a detail rather than a presence.
 */
export const MASCOT_BAND = { x: 310, y: 150, w: 100, h: 155 };

/** The story headline. Constant for the whole post — it names the story, not the beat. */
export const TITLE = {
  top: 330,
  fontSize: 54,
  lineHeightRatio: 1.16,
  maxLines: 3,
  minFontSize: 34,
  maxWidth: CONTENT_WIDTH,
  colour: '#0B0D12',
};

/**
 * One visual at a time. Nearly the full card width — a picture that fills the frame is the
 * difference between a slide and something worth watching.
 */
export const VISUAL = { x: 78, y: 500, w: 564, h: 470, radius: 32 };

/** The per-beat line, directly under the visual, in the accent colour so the eye lands on it. */
export const DISPLAY = {
  top: 1002,
  fontSize: 44,
  lineHeightRatio: 1.22,
  maxLines: 2,
  minFontSize: 30,
  maxWidth: CONTENT_WIDTH,
  colour: '#1E76C3',
};

/** The closing ask: one small line under the payoff, on the payoff beat and the hold. */
export const ASK = {
  centreY: 1136,
  fontSize: 28,
  minFontSize: 22,
  maxLines: 1,
  lineHeightRatio: 1.2,
  maxWidth: CONTENT_WIDTH,
  colour: '#5B6470',
  fallback: 'Save this one.',
};

/**
 * The mechanism, built line by line. When the writer supplies `formula_steps`, each line pops in
 * across the first ~80 % of the beat in time with the narration, earlier lines dimming as the
 * next arrives; the last line is the formula itself and stays bright.
 */
export const FORMULA = {
  fontSize: 46,
  /** Font size when several lines share the slot. */
  stackedFontSize: 38,
  lineGap: 22,
  dim: 0.45,
  /** Fraction of the beat by which the last line has landed. */
  landedBy: 0.8,
  colour: '#1E76C3',
  /** The result lands in this and settles to `colour`. */
  emphasis: '#F26B1D',
  settleFrames: 36,
};

/** Slow push-in on a sourced image over its beat. */
export const IMAGE_DRIFT = 0.08;

export const FIT_STEP = 2;
