/**
 * Layout for the lesson card, in 720x1280 design units.
 *
 * Measured from assets/templates/lesson/step1.png, step2.png (which is 2x) and step3.png. The
 * card, footer and mascot slot are shared with the task format — see ../card.ts.
 */
export { CARD, FOOTER, FRAME, CARD_PAD, CONTENT_WIDTH } from '../card';
import { CONTENT_WIDTH } from '../card';

/** `Math tricks #N` — the series counter. Same on every step; it identifies the post. */
export const TITLE = {
  fontSize: 40,
  lineHeight: 47,
  /** Measured cap band 243-273, so the box top sits a little above it. */
  top: 232,
  colour: '#000000',
};

/**
 * The two body lines, centred as a group on y = 561.
 *
 * Measured bands: instruction 494-532, working 591-628, i.e. a 59 px gap. The group is centred
 * rather than pinned so it stays balanced when either line wraps — step2.png wraps the working
 * line to two and still reads level.
 */
export const BODY = {
  centreY: 561,
  gap: 59,
  maxWidth: CONTENT_WIDTH,   // 500

  instruction: {
    colour: '#000000',
    fontSize: 50,
    maxLines: 2,
    lineHeightRatio: 1.24,
  },
  working: {
    colour: '#1E76C3',
    fontSize: 52,
    maxLines: 3,
    lineHeightRatio: 1.24,
  },

  /** Auto-fit floor. Below this the step is rejected rather than shrunk further. */
  minFontSize: 34,
  fitStep: 2,
};

/** Cross-fade at step boundaries. Short enough to feel like a cut, long enough not to flicker. */
export const STEP_FADE = { in: 6, out: 4 };
