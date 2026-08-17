/**
 * Fits a lesson body line inside the card.
 *
 * Unlike the task statement, these lines wrap: the working line in step2.png runs to two. So the
 * measurement is done at a fixed width with wrapping allowed, and the constraint is the number of
 * lines rather than a raw box.
 *
 * The floor is a hard gate. If a line still overflows at the minimum size, the step is rejected
 * and the display text has to get shorter. Shrinking further or letting it spill are both defects
 * the viewer sees, and either is worse than not shipping the post.
 */
import { BODY } from './layout';

export interface LineFit {
  fits: boolean;
  fontSize: number;
  lines: number;
  height: number;
  reason?: string;
}

interface Spec { fontSize: number; maxLines: number; lineHeightRatio: number }

export function fitLine(text: string, spec: Spec, maxWidth = BODY.maxWidth): LineFit {
  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:absolute', 'visibility:hidden', 'left:-99999px', 'top:0',
    `width:${maxWidth}px`, 'font-weight:800', 'text-align:center',
    'white-space:normal', 'word-break:normal',
  ].join(';');
  document.body.appendChild(probe);

  try {
    let last: LineFit | null = null;
    for (let size = spec.fontSize; size >= BODY.minFontSize; size -= BODY.fitStep) {
      const lineHeight = Math.round(size * spec.lineHeightRatio);
      probe.style.fontSize = `${size}px`;
      probe.style.lineHeight = `${lineHeight}px`;
      probe.textContent = text;

      const height = probe.offsetHeight;
      const lines = Math.max(1, Math.round(height / lineHeight));

      if (lines <= spec.maxLines) return { fits: true, fontSize: size, lines, height };
      last = { fits: false, fontSize: size, lines, height };
    }
    return {
      fits: false,
      fontSize: BODY.minFontSize,
      lines: last?.lines ?? 0,
      height: last?.height ?? 0,
      reason:
        `"${text.slice(0, 48)}${text.length > 48 ? '…' : ''}" needs ${last?.lines} lines at the ` +
        `${BODY.minFontSize}px floor but only ${spec.maxLines} are allowed — shorten the display text`,
    };
  } finally {
    probe.remove();
  }
}

/**
 * Fit every step up front, before the capture starts. One pass, so the sizes cannot vary between
 * frames, and a failure is known before a single frame is written.
 */
export function fitSteps(steps: Array<{ instruction: string; working: string }>) {
  const results = steps.map((s, i) => ({
    index: i,
    instruction: fitLine(s.instruction, BODY.instruction),
    working: fitLine(s.working, BODY.working),
  }));
  const bad = results.filter((r) => !r.instruction.fits || !r.working.fits);
  return {
    fits: bad.length === 0,
    results,
    problems: bad.map((r) => ({
      step: r.index,
      instruction: r.instruction.reason ?? null,
      working: r.working.reason ?? null,
    })),
  };
}
