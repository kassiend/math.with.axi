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

/**
 * The integral the mascot steps out of.
 *
 * The clip already walks him on from the left, holds him in MASCOT_BAND for the story, then walks
 * him back out the same way. Nothing is timed to make him emerge from a symbol — the symbol is
 * simply put where he already appears, and the walk does the rest.
 *
 * Where that is, measured off the keyed clip through the transform in tools/story-mascot.mjs:
 *
 *   src frame   0   he appears at x 188..197 — a sliver at the clip's left edge
 *   src frame  24   x 204..333, crossing
 *   src frame  48   x 310..413, at rest in MASCOT_BAND, and there for the whole story
 *   src frame 216   x 221..341, leaving
 *   src frame 240   x 188..207, gone
 *
 * So cx sits at 205: the glyph spans roughly x 171..239 and he materialises INSIDE it, walks out
 * rightward, and comes to rest clear of it. On the way back he walks into it and vanishes. cy is
 * the band's centre, which is his own eye level.
 *
 * The page draws this and Remotion composites the clip on top, so he passes IN FRONT of the
 * glyph. That z-order is the whole effect — behind him it would read as a backdrop.
 */
export const MASCOT_PORTAL = {
  /** Centre of the ink, in design units. */
  cx: 205,
  cy: MASCOT_BAND.y + MASCOT_BAND.h / 2,
  /**
   * Ink height. Taller than the mascot's 155 so it frames him rather than decorating him, and
   * short enough that the bottom (312) clears TITLE.top (330) and the top (142) clears the card.
   */
  height: 170,
  /** The card's accent, held back so it reads as scenery rather than as another line to read. */
  colour: '#1E76C3',
  opacity: 0.38,
};

/**
 * The story headline. Constant for the whole post — it names the story, not the beat.
 *
 * `maxHeight` is the band between the title's top and the visual below it, and it is a separate
 * constraint from `maxLines` because the two disagree: three lines at 54 px stand 189 px tall and
 * the band is 170 px, so a title that satisfies the line count still runs under the picture. A
 * line count alone is a proxy for fitting, and this is the case where the proxy is wrong.
 */
export const TITLE = {
  top: 330,
  fontSize: 54,
  lineHeightRatio: 1.16,
  maxLines: 3,
  /** 500 (VISUAL.y) − 330, less 16 px so a full-height title does not touch the visual. */
  maxHeight: 154,
  minFontSize: 34,
  maxWidth: CONTENT_WIDTH,
  colour: '#0B0D12',
};

/**
 * One visual at a time. Nearly the full card width — a picture that fills the frame is the
 * difference between a slide and something worth watching.
 */
export const VISUAL = { x: 78, y: 500, w: 564, h: 470, radius: 32 };

/**
 * The formula slot, as a measured fit rather than a fixed size.
 *
 * `.visual` clips what overflows it, so a formula wider than the slot does not spill — it is
 * silently amputated at both ends, and a half-formula on screen still looks like a formula. The
 * base size is what a short identity gets; anything longer is scaled down until it fits.
 *
 * There is no floor and no rejection here, unlike the text fits. A formula is one object and
 * cannot be broken across lines or shortened by the writer without becoming a different formula,
 * so the only honest response to a long one is to set it smaller.
 */
export const FORMULA = {
  fontSize: 46,
  /** Usable box inside the slot: the full width and height less a 24 px margin each side. */
  maxWidth: 564 - 48,
  maxHeight: 470 - 48,
};

/** The per-beat line, directly under the visual, in the accent colour so the eye lands on it. */
export const DISPLAY = {
  top: 1002,
  fontSize: 44,
  lineHeightRatio: 1.22,
  maxLines: 2,
  /** 1170 (card bottom) − 1002, less 20 px so the line does not sit on the card border. */
  maxHeight: 148,
  minFontSize: 30,
  maxWidth: CONTENT_WIDTH,
  colour: '#1E76C3',
};

export const FIT_STEP = 2;
