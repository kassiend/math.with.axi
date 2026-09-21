/**
 * Layout for the story card, in 720x1280 design units.
 *
 * THIRD PASS. The first followed story_example.png (a small picture on a white card); the second
 * enlarged the picture. Both still read as a slide: white card, blue caption, formula on white.
 * A story competes with cinematic short-form, so this pass is documentary-cinematic:
 *
 *   - the image fills the card to its border; the card's radius clips it
 *   - dark scrims top and bottom carry the type; no white anywhere inside the card
 *   - one heavy display face (Outfit 800/900) with tight tracking, white on the image
 *   - one accent, the brand orange, reserved for the number that matters
 *   - a formula beat dims and blurs the image and stacks the derivation in white on top
 *
 * The card, its border and the mascot band are unchanged: the channel's identity is the card, the
 * story's identity is what fills it.
 */
export { CARD, FRAME, CARD_PAD, CONTENT_WIDTH } from '../card';
import { CARD, CARD_PAD, CONTENT_WIDTH } from '../card';

/** Inner area of the card, inside the border. The image covers exactly this. */
export const INNER = {
  x: CARD.x + CARD.border, y: CARD.y + CARD.border,
  w: CARD.w - 2 * CARD.border, h: CARD.h - 2 * CARD.border,
  radius: CARD.radius - CARD.border,
};

/** Reserved for the mascot clip; nothing is drawn here by the page. Over the top scrim. */
export const MASCOT_BAND = { x: 310, y: 150, w: 100, h: 155 };

export const PALETTE = {
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.72)',
  accent: '#F26B1D',
  scrim: '#07090F',
};

/** Top and bottom gradients that carry the type. Heights in design px. */
export const SCRIM = { top: 420, bottom: 560, topAlpha: 0.78, bottomAlpha: 0.92 };

/** The story headline: the hook as a line. Left-aligned, under the mascot band. */
export const TITLE = {
  top: 330,
  left: CARD.x + CARD_PAD,
  fontSize: 62,
  lineHeightRatio: 1.04,
  maxLines: 3,
  minFontSize: 40,
  maxWidth: CONTENT_WIDTH,
  colour: PALETTE.text,
  weight: 900,
};

/**
 * Optional per-beat number, shown huge in the accent and counted up over the first second of
 * the beat. "1 in 73,000,000" — the thing a thumb stops for.
 */
export const STAT = {
  centreY: 700,
  valueSize: 128,
  valueMin: 64,
  prefixSize: 40,
  gap: 8,
  colour: PALETTE.accent,
  countFrames: 36,
  maxWidth: CONTENT_WIDTH,
};

/** The per-beat line, on the bottom scrim, built token by token. */
export const DISPLAY = {
  top: 918,
  left: CARD.x + CARD_PAD,
  fontSize: 54,
  lineHeightRatio: 1.08,
  maxLines: 3,
  minFontSize: 34,
  maxWidth: CONTENT_WIDTH,
  colour: PALETTE.text,
  weight: 800,
};

/** The closing ask: one small line under the payoff. */
export const ASK = {
  centreY: 1120,
  left: CARD.x + CARD_PAD,
  fontSize: 28,
  minFontSize: 22,
  maxLines: 1,
  lineHeightRatio: 1.2,
  maxWidth: CONTENT_WIDTH,
  colour: PALETTE.muted,
  fallback: 'Save this one.',
};

/** Beat progress: a hairline along the bottom edge inside the card. */
export const PROGRESS = { height: 5, bottomInset: 0, colour: PALETTE.accent, track: 'rgba(255,255,255,0.18)' };

/**
 * The mechanism, built line by line over the dimmed image. `formula_steps` land one at a time
 * across the first ~80 % of the beat, earlier lines dimming as the next arrives; the last is the
 * formula and stays bright in the accent.
 */
export const FORMULA = {
  centreY: 640,
  fontSize: 56,
  stackedFontSize: 48,
  minFontSize: 26,
  padding: 24,
  lineGap: 26,
  dim: 0.42,
  landedBy: 0.8,
  colour: PALETTE.text,
  emphasis: PALETTE.accent,
  settleFrames: 36,
  /** How far the image behind the stack is pushed back. */
  imageDim: 0.28,
  imageBlur: 8,
};

/** Slow push-in on an image over its beat. */
export const IMAGE_DRIFT = 0.09;

export const FIT_STEP = 2;
