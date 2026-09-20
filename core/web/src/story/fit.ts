/**
 * Fits the title and the per-beat display lines inside the card.
 *
 * A hard gate, as elsewhere: if a line still overflows at the minimum size the beat is rejected
 * and the text has to get shorter. Shrinking past the floor or letting it spill are both defects
 * the viewer sees.
 */
import { ASK, DISPLAY, FIT_STEP, FORMULA, TITLE, VISUAL } from './layout';

export interface LineFit {
  fits: boolean;
  fontSize: number;
  lines: number;
  reason?: string;
}

interface Spec {
  fontSize: number;
  minFontSize: number;
  maxLines: number;
  /** Vertical room the block has before it runs into whatever is under it. */
  maxHeight: number;
  lineHeightRatio: number;
  maxWidth: number;
}

function fit(text: string, spec: Spec, weight: number): LineFit {
  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:absolute', 'visibility:hidden', 'left:-99999px', 'top:0',
    `width:${spec.maxWidth}px`, `font-weight:${weight}`, 'text-align:center', 'white-space:normal',
  ].join(';');
  document.body.appendChild(probe);
  try {
    let last: LineFit | null = null;
    for (let size = spec.fontSize; size >= spec.minFontSize; size -= FIT_STEP) {
      const lh = Math.round(size * spec.lineHeightRatio);
      probe.style.fontSize = `${size}px`;
      probe.style.lineHeight = `${lh}px`;
      probe.textContent = text;
      const lines = Math.max(1, Math.round(probe.offsetHeight / lh));
      // Both constraints, not either: the line count keeps the shape of the block, the height
      // keeps it out of the element below. A title can pass one and fail the other.
      if (lines <= spec.maxLines && lines * lh <= spec.maxHeight) {
        return { fits: true, fontSize: size, lines };
      }
      last = { fits: false, fontSize: size, lines };
    }
    return {
      fits: false, fontSize: spec.minFontSize, lines: last?.lines ?? 0,
      reason: `"${text.slice(0, 44)}${text.length > 44 ? '…' : ''}" needs ${last?.lines} lines at ` +
              `${spec.minFontSize}px — at most ${spec.maxLines} are allowed and they must fit ` +
              `${spec.maxHeight}px — shorten it`,
    };
  } finally {
    probe.remove();
  }
}

/**
 * The formula stack must fit the visual slot's width. Measured with the real KaTeX markup at the
 * stack's font size, stepping down until the widest line fits; below the floor the story is
 * rejected — a clipped derivation is a wrong derivation on screen.
 *
 * Measured through the card's own `.visual-formula` rules on purpose: KaTeX's CSS sets
 * `.katex { font-size: 1.21em }` and the card overrides that to 1em, so a bare probe would measure
 * a formula 21% larger than the one that ships.
 */
export function fitFormulaLines(htmls: string[], maxWidth: number, startSize: number, floor: number): LineFit {
  if (!htmls.length) return { fits: true, fontSize: startSize, lines: 0 };
  const probe = document.createElement('div');
  probe.className = 'visual-formula';
  probe.style.cssText = 'position:absolute;visibility:hidden;left:-99999px;top:0;width:auto;height:auto;display:block;white-space:nowrap';
  document.body.appendChild(probe);
  try {
    let widest = 0;
    for (let size = startSize; size >= floor; size -= FIT_STEP) {
      probe.style.fontSize = `${size}px`;
      widest = 0;
      for (const html of htmls) {
        probe.innerHTML = `<div class="formula-line">${html}</div>`;
        widest = Math.max(widest, probe.scrollWidth);
      }
      if (widest <= maxWidth) return { fits: true, fontSize: size, lines: htmls.length };
    }
    return {
      fits: false, fontSize: floor, lines: htmls.length,
      reason: `a formula line is ${Math.round(widest)}px wide at the ${floor}px floor; the slot is ${maxWidth}px — shorten the derivation line`,
    };
  } finally {
    probe.remove();
  }
}

/** The width a formula line may take inside the slot. */
export const FORMULA_MAX_WIDTH = VISUAL.w - 2 * FORMULA.padding;

/**
 * @param formulaLines  per beat, the typeset derivation lines (one entry — the formula itself —
 *                      when the writer supplied no steps; empty for a non-formula beat)
 * @param stepFormulas  per beat, the typeset formula of each inner step that carries one, keyed by
 *                      step index. A formula step needs the same slot fit as a whole-beat formula,
 *                      or it overflows and is clipped exactly the way the mechanism formula was.
 */
export function fitStory(
  title: string, displays: string[], ask: string, formulaLines: string[][] = [],
  stepFormulas: Array<Array<{ step: number; html: string }>> = [],
) {
  const titleFit = fit(title, TITLE, 800);
  const displayFits = displays.map((d) => fit(d, DISPLAY, 800));
  const askFit = fit(ask, ASK, 600);
  const formulaFits = formulaLines.map((lines) =>
    fitFormulaLines(lines, FORMULA_MAX_WIDTH,
      lines.length === 1 ? FORMULA.fontSize : FORMULA.stackedFontSize, FORMULA.minFontSize));
  const stepFormulaFits = stepFormulas.map((steps) => steps.map(({ step, html }) => ({
    step, fit: fitFormulaLines([html], FORMULA_MAX_WIDTH, FORMULA.fontSize, FORMULA.minFontSize),
  })));
  const problems = [
    ...(titleFit.fits ? [] : [{ where: 'title', reason: titleFit.reason }]),
    ...displayFits.flatMap((f, i) => (f.fits ? [] : [{ where: `beat ${i}`, reason: f.reason }])),
    ...(askFit.fits ? [] : [{ where: 'ask', reason: askFit.reason }]),
    ...formulaFits.flatMap((f, i) => (f.fits ? [] : [{ where: `beat ${i} formula`, reason: f.reason }])),
    ...stepFormulaFits.flatMap((steps, i) => steps.flatMap(({ step, fit: f }) =>
      (f.fits ? [] : [{ where: `beat ${i} step ${step} formula`, reason: f.reason }]))),
  ];
  return { fits: problems.length === 0, titleFit, displayFits, askFit, formulaFits, stepFormulaFits, problems };
}
