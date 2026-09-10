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

/**
 * The visual slot, used only by steps that carry one.
 *
 * A diagram does not share the card with a centred text block — it needs the whole lower half, so
 * a step with a visual re-anchors its two lines to the TOP of the card instead of centring them
 * on y = 561. Both layouts exist rather than one compromise layout because a lesson mixes them:
 * the rule step is text, the worked step is a picture, and neither should be squeezed to look
 * like the other.
 *
 * Bounds: the title band ends at 279 and the footer mascot starts at 997. BODY_WITH_VISUAL is
 * capped so its worst case (2 instruction lines + 1 working line at full size) bottoms out at
 * 490, and the slot runs 502-958 — clear of the text above and the mascot below.
 */
export const VISUAL = { x: 110, y: 502, w: CONTENT_WIDTH, h: 456 };

/**
 * The compact body used when the step has a visual: top-anchored, tighter, and with the working
 * line held to a single line so the text block cannot grow into the slot.
 *
 * Smaller than the centred body on purpose. There, the two lines ARE the step; here the diagram
 * is, and an instruction set at the same weight as the title competes with it.
 */
export const BODY_WITH_VISUAL = {
  top: 326,
  gap: 20,
  maxWidth: CONTENT_WIDTH,

  instruction: { colour: '#000000', fontSize: 38, maxLines: 2, lineHeightRatio: 1.24 },
  working: { colour: '#1E76C3', fontSize: 40, maxLines: 1, lineHeightRatio: 1.24 },

  minFontSize: 28,
  fitStep: 2,
};

/** Cross-fade at step boundaries. Short enough to feel like a cut, long enough not to flicker. */
export const STEP_FADE = { in: 6, out: 4 };
