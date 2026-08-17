/**
 * Geometry shared by every post format, in 720x1280 design units.
 *
 * Tasks and lessons draw the same card, the same footer and the same mascot slot — measured
 * pixel-wise from assets/templates/tasks/daily_task.png and confirmed against
 * assets/templates/lesson/step1.png, which matches to the pixel.
 *
 * These live in one module because "the same card" has to stay literally true. Two copies of the
 * numbers drift the moment one format is nudged, and the drift is invisible until the formats are
 * seen side by side in a feed.
 */

export const FRAME = { w: 720, h: 1280 };

export const CARD = { x: 54, y: 120, w: 612, h: 1050, radius: 40, border: 5 };

export const FOOTER = {
  mascot: { x: 174, y: 997, w: 86, h: 132 },
  wordmark: { text: 'math with Axi', x: 324, baseline: 1074, fontSize: 36 },
};

/** Horizontal padding inside the card; sets the usable text width. */
export const CARD_PAD = 56;
export const CONTENT_WIDTH = CARD.w - 2 * CARD_PAD;   // 500
