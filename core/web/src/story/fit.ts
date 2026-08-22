/**
 * Fits the title and the per-beat display lines inside the card.
 *
 * A hard gate, as elsewhere: if a line still overflows at the minimum size the beat is rejected
 * and the text has to get shorter. Shrinking past the floor or letting it spill are both defects
 * the viewer sees.
 */
import { DISPLAY, FIT_STEP, TITLE } from './layout';

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

export function fitStory(title: string, displays: string[]) {
  const titleFit = fit(title, TITLE, 800);
  const displayFits = displays.map((d) => fit(d, DISPLAY, 800));
  const problems = [
    ...(titleFit.fits ? [] : [{ where: 'title', reason: titleFit.reason }]),
    ...displayFits.flatMap((f, i) => (f.fits ? [] : [{ where: `beat ${i}`, reason: f.reason }])),
  ];
  return { fits: problems.length === 0, titleFit, displayFits, problems };
}
