/**
 * Fits the title and the per-beat display lines inside the card.
 *
 * A hard gate, as elsewhere: if a line still overflows at the minimum size the beat is rejected
 * and the text has to get shorter. Shrinking past the floor or letting it spill are both defects
 * the viewer sees.
 */
import { ASK, DISPLAY, FIT_STEP, FORMULA, INNER, STAT, TITLE } from './layout';

export interface LineFit {
  fits: boolean;
  fontSize: number;
  lines: number;
  reason?: string;
}

interface Spec { fontSize: number; minFontSize: number; maxLines: number; lineHeightRatio: number; maxWidth: number }

function fit(text: string, spec: Spec, weight: number): LineFit {
  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:absolute', 'visibility:hidden', 'left:-99999px', 'top:0',
    `width:${spec.maxWidth}px`, `font-weight:${weight}`, 'text-align:left', 'white-space:normal',
    'font-family:Outfit, Inter, ui-sans-serif, sans-serif', 'letter-spacing:-0.02em',
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
      if (lines <= spec.maxLines) return { fits: true, fontSize: size, lines };
      last = { fits: false, fontSize: size, lines };
    }
    return {
      fits: false, fontSize: spec.minFontSize, lines: last?.lines ?? 0,
      reason: `"${text.slice(0, 44)}${text.length > 44 ? '…' : ''}" needs ${last?.lines} lines at ` +
              `${spec.minFontSize}px but only ${spec.maxLines} are allowed — shorten it`,
    };
  } finally {
    probe.remove();
  }
}

/**
 * The formula stack must fit the visual slot's width. Measured with the real KaTeX markup at the
 * stack's font size, stepping down until the widest line fits; below the floor the story is
 * rejected — a clipped derivation is a wrong derivation on screen.
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

/** The stat value must fit the width on ONE unwrapped line; below the floor the beat is rejected. */
export function fitStat(value: string): LineFit {
  const probe = document.createElement('div');
  probe.className = 'stat-value';
  probe.style.cssText = 'position:absolute;visibility:hidden;left:-99999px;top:0;white-space:nowrap;font-family:Outfit,Inter,sans-serif';
  document.body.appendChild(probe);
  try {
    let w = 0;
    for (let size = STAT.valueSize; size >= STAT.valueMin; size -= FIT_STEP) {
      probe.style.fontSize = `${size}px`;
      probe.textContent = value;
      w = probe.scrollWidth;
      if (w <= STAT.maxWidth) return { fits: true, fontSize: size, lines: 1 };
    }
    return { fits: false, fontSize: STAT.valueMin, lines: 1,
      reason: `stat "${value}" is ${Math.round(w)}px wide at the ${STAT.valueMin}px floor; ${STAT.maxWidth}px is available — shorten it (73M, not 73,000,000)` };
  } finally {
    probe.remove();
  }
}

/** The width a formula line may take over the image. */
export const FORMULA_MAX_WIDTH = INNER.w - 2 * FORMULA.padding;

/**
 * @param stepFormulas  per beat, the typeset formula of each inner step that carries one, keyed by
 *                      step index. A formula step needs the same fit as a whole-beat formula.
 */
export function fitStory(
  title: string, displays: string[], ask: string, formulaLines: string[][] = [], stats: Array<string | null> = [],
  stepFormulas: Array<Array<{ step: number; html: string }>> = [],
) {
  const titleFit = fit(title, TITLE, TITLE.weight);
  const displayFits = displays.map((d) => fit(d, DISPLAY, DISPLAY.weight));
  const statFits = stats.map((v) => (v ? fitStat(v) : null));
  const stepFormulaFits = stepFormulas.map((steps) => steps.map(({ step, html }) => ({
    step, fit: fitFormulaLines([html], FORMULA_MAX_WIDTH, FORMULA.fontSize, FORMULA.minFontSize),
  })));
  const askFit = fit(ask, ASK, 600);
  const formulaFits = formulaLines.map((lines) =>
    fitFormulaLines(lines, FORMULA_MAX_WIDTH,
      lines.length === 1 ? FORMULA.fontSize : FORMULA.stackedFontSize, FORMULA.minFontSize));
  const problems = [
    ...(titleFit.fits ? [] : [{ where: 'title', reason: titleFit.reason }]),
    ...displayFits.flatMap((f, i) => (f.fits ? [] : [{ where: `beat ${i}`, reason: f.reason }])),
    ...(askFit.fits ? [] : [{ where: 'ask', reason: askFit.reason }]),
    ...formulaFits.flatMap((f, i) => (f.fits ? [] : [{ where: `beat ${i} formula`, reason: f.reason }])),
    ...statFits.flatMap((f, i) => (!f || f.fits ? [] : [{ where: `beat ${i} stat`, reason: f.reason }])),
    ...stepFormulaFits.flatMap((steps, i) => steps.flatMap(({ step, fit: f }) =>
      (f.fits ? [] : [{ where: `beat ${i} step ${step} formula`, reason: f.reason }]))),
  ];
  return { fits: problems.length === 0, titleFit, displayFits, askFit, formulaFits, statFits, stepFormulaFits, problems };
}
