/**
 * Layout for the story card, in 720x1280 design units.
 *
 * Measured from assets/templates/stories/story_example.png (1440x2560, i.e. 2x). The card,
 * background and wordmark are shared with the other two sections — see ../card.ts.
 *
 * The mascot band is deliberately EMPTY here: the mascot is video, composited by Remotion on top
 * of this capture. The page only reserves the space.
 */
export { CARD, FOOTER, FRAME, CARD_PAD, CONTENT_WIDTH } from '../card';
import { CONTENT_WIDTH } from '../card';

/** Reserved for the mascot clip. Nothing is drawn here by the page. */
export const MASCOT_BAND = { x: 328, y: 157, w: 69, h: 107 };

/** The story headline. Constant for the whole post — it names the story, not the beat. */
export const TITLE = {
  top: 352,
  fontSize: 52,
  lineHeightRatio: 1.2,
  maxLines: 3,
  minFontSize: 34,
  maxWidth: CONTENT_WIDTH,
  colour: '#000000',
};

/** One visual at a time — a sourced image, a typeset formula, or a drawn shape. */
export const VISUAL = { x: 185, y: 520, w: 350, h: 294, radius: 28 };

/** The per-beat display line, below the visual. Minimum information, never the narration. */
export const DISPLAY = {
  top: 856,
  fontSize: 42,
  lineHeightRatio: 1.26,
  maxLines: 3,
  minFontSize: 28,
  maxWidth: CONTENT_WIDTH,
  colour: '#000000',
  accent: '#1E76C3',
};

export const FIT_STEP = 2;
