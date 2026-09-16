/**
 * Layout for the lesson card, in 720x1280 design units.
 *
 * The card, footer and wordmark are shared with the task format — see ../card.ts. The body
 * numbers were measured from assets/templates/lesson/step1-3.png; the hero, progress, ask and
 * mascot band were added after reviewing the first renders, which held one static card for
 * thirteen seconds over a ~60 % empty white rectangle.
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
 * Step progress — one dot per step, filled as the lesson advances. A visible finish line: the
 * viewer can see there are four beats and they are on the second, which is the cheapest reason
 * to stay that exists.
 */
export const PROGRESS = {
  centreY: 310,
  dot: 12,
  gap: 14,
  done: '#1E76C3',
  pending: '#D9DEE5',
};

/**
 * The hook layout, shown while the spoken hook plays. The problem is the biggest thing on the
 * card and is built token by token; the hook's own on-screen line lands under it once the
 * problem is complete — motion, then lock, then claim.
 */
export const HERO = {
  working: {
    centreY: 540,
    colour: '#1E76C3',
    fontSize: 96,
    minFontSize: 56,
    maxLines: 2,
    lineHeightRatio: 1.12,
    maxWidth: CONTENT_WIDTH,
  },
  kicker: {
    centreY: 690,
    colour: '#000000',
    fontSize: 42,
    minFontSize: 30,
    maxLines: 2,
    lineHeightRatio: 1.2,
    maxWidth: CONTENT_WIDTH,
  },
  /** The problem has fully landed by this frame; the kicker begins here (~1.2 s). */
  claimAtFrame: 36,
  /**
   * The first token is already most of the way in on frame 0. Frame 0 is the thumbnail and the
   * first thing a thumb sees; an empty card there is a fade-from-black by another name.
   */
  leadFrames: 5,
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
    fontSize: 60,
    maxLines: 3,
    lineHeightRatio: 1.24,
  },

  /** Auto-fit floor. Below this the step is rejected rather than shrunk further. */
  minFontSize: 34,
  fitStep: 2,
};

/** The closing ask, under the last step. One line, one action. */
export const ASK = {
  centreY: 745,
  colour: '#5B6470',
  fontSize: 34,
  minFontSize: 26,
  maxLines: 1,
  lineHeightRatio: 1.2,
  maxWidth: CONTENT_WIDTH,
  fallback: 'Save this. Try it on your own number.',
};

/**
 * Where the animated mascot stands once he has walked in — the same keyed take the story format
 * uses, composited by Remotion. The page draws nothing here; it only keeps the band clear. The
 * old 86x132 still in the footer is gone: a still is not a character.
 */
export { MASCOT_REST } from '../../../shared/lesson-timeline';

/** Cross-fade at step boundaries: outgoing drifts up and out while incoming rises in. */
export const STEP_FADE = 8;
