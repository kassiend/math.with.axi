/**
 * Fits the statement inside the ring.
 *
 * The template makes this a hard gate, not a nicety: if the statement does not fit at the minimum
 * font size the task is rejected. Overflowing the ring, clipping, or shrinking below the floor
 * are all worse than not shipping the post, because they are defects a viewer sees.
 *
 * Measured once, before the capture starts, so it costs nothing per frame and cannot vary
 * between frames.
 */
import katex from 'katex';
import { STATEMENT } from './layout';

export interface FitResult {
  fits: boolean;
  fontSize: number;
  width: number;
  height: number;
  /** Present only when fits is false — the caller must fail the run, not render this. */
  reason?: string;
}

/**
 * @param html   pre-rendered KaTeX markup, or plain text
 * @param boxPx  side of the square the text must fit inside (STATEMENT.safeBox)
 */
export function fitStatement(html: string, boxPx = STATEMENT.safeBox): FitResult {
  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:absolute', 'visibility:hidden', 'left:-99999px', 'top:0',
    'white-space:nowrap', 'font-weight:700', 'line-height:1.25',
  ].join(';');
  probe.className = 'statement-probe';
  document.body.appendChild(probe);

  try {
    let best: FitResult | null = null;
    for (let size = STATEMENT.maxFont; size >= STATEMENT.minFont; size -= STATEMENT.step) {
      probe.style.fontSize = `${size}px`;
      probe.innerHTML = html;
      const w = probe.offsetWidth;
      const h = probe.offsetHeight;
      if (w <= boxPx && h <= boxPx) {
        best = { fits: true, fontSize: size, width: w, height: h };
        break;
      }
      best = { fits: false, fontSize: size, width: w, height: h };
    }
    if (best?.fits) return best;
    return {
      fits: false,
      fontSize: STATEMENT.minFont,
      width: best?.width ?? 0,
      height: best?.height ?? 0,
      reason:
        `statement does not fit the ${Math.round(boxPx)}px safe box at the ${STATEMENT.minFont}px floor ` +
        `(measured ${best?.width}x${best?.height}) — shorten it or split it across two lines`,
    };
  } finally {
    probe.remove();
  }
}

/** KaTeX markup for a statement, or escaped plain text when no LaTeX form was supplied. */
export function statementHtml(plain: string, latex?: string | null): string {
  if (latex) {
    try {
      return katex.renderToString(latex, {
        displayMode: false, throwOnError: true, strict: 'error', output: 'html', trust: false,
      });
    } catch (err) {
      // A formula the typesetter rejected must never reach a frame silently.
      return `<span data-katex-error="1">⟨LaTeX error: ${String(err)}⟩</span>`;
    }
  }
  return plain.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}
