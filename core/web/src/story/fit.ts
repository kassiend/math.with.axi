/**
 * Fits the title and the per-beat display lines inside the card.
 *
 * A hard gate, as elsewhere: if a line still overflows at the minimum size the beat is rejected
 * and the text has to get shorter. Shrinking past the floor or letting it spill are both defects
 * the viewer sees.
 */
import { DISPLAY, FIT_STEP, FORMULA, TITLE } from './layout';

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
 * The font-size at which a typeset formula fits the visual slot, with the numbers behind it —
 * recorded into the capture manifest so a formula that got shrunk is auditable afterwards.
 *
 * One measurement, not a search: KaTeX scales linearly with font-size, so the ratio between the
 * natural size and the box is the answer. Measured at the base size and scaled down only —
 * a short formula is not blown up to fill the slot, because a huge `E = mc^2` reads as a mistake.
 */
export function measureFormula(html: string) {
  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:absolute', 'visibility:hidden', 'left:-99999px', 'top:0',
    'white-space:nowrap', `font-size:${FORMULA.fontSize}px`,
  ].join(';');
  // The inner .visual-formula is what makes this measurement match what ships. KaTeX's own CSS
  // sets .katex { font-size: 1.21em }, and the card overrides that to 1em — so a bare probe
  // measures a formula 21% larger than the one that will be drawn, and the fit shrinks it to
  // compensate for a size it was never going to be. Measure through the card's own rules.
  probe.innerHTML =
    `<div class="visual-formula" style="width:auto;height:auto;display:block;background:none">${html}</div>`;
  document.body.appendChild(probe);
  try {
    // .katex-html is the span wrapping the typeset content. .katex-display above it is a block
    // and reports its container's width, not the formula's — measuring that scales by the wrong
    // ratio and shrinks a formula that already fitted.
    const el = (probe.querySelector('.katex-html') ?? probe.querySelector('.katex') ?? probe) as HTMLElement;
    const r = el.getBoundingClientRect();
    const measured = { width: Math.round(r.width), height: Math.round(r.height) };
    if (!(r.width > 0) || !(r.height > 0)) return { fontSize: FORMULA.fontSize, measured, scale: 1 };
    const scale = Math.min(1, FORMULA.maxWidth / r.width, FORMULA.maxHeight / r.height);
    return { fontSize: Math.max(12, Math.floor(FORMULA.fontSize * scale)), measured, scale: +scale.toFixed(3) };
  } finally {
    probe.remove();
  }
}

export function fitStory(title: string, displays: string[]) {
  const titleFit = fit(title, TITLE, 800);
  const displayFits = displays.map((d) => fit(d, DISPLAY, 800));
  const problems = [
    ...(titleFit.fits ? [] : [{ where: 'title', reason: titleFit.reason }]),
    ...displayFits.flatMap((f, i) => (f.fits ? [] : [{ where: `beat ${i}`, reason: f.reason }])),
  ];
  return { fits: problems.length === 0, titleFit, displayFits, problems };
}
