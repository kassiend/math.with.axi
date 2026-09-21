/**
 * Fits every line of a lesson inside the card.
 *
 * Unlike the task statement, these lines wrap: the working line in step2.png runs to two. So the
 * measurement is done at a fixed width with wrapping allowed, and the constraint is the number of
 * lines rather than a raw box.
 *
 * The floor is a hard gate. If a line still overflows at the minimum size, the step is rejected
 * and the display text has to get shorter. Shrinking further or letting it spill are both defects
 * the viewer sees, and either is worse than not shipping the post.
 */
import { ASK, BODY, BODY_WITH_VISUAL, HERO } from './layout';

export interface LineFit {
  fits: boolean;
  fontSize: number;
  lines: number;
  height: number;
  reason?: string;
}

interface Spec {
  fontSize: number;
  maxLines: number;
  lineHeightRatio: number;
  minFontSize?: number;
  maxWidth?: number;
}

/**
 * The DOM a line is rendered with: a token span per word, and — for working lines — a glyph span
 * per character inside it. Measurement and rendering must share this, because inline-block glyph
 * spans lose kerning and a line measured as plain text can wrap one line later on the card.
 */
export function buildLineDom(text: string, glyphs: boolean): { nodes: Node[]; glyphSpans: HTMLElement[] } {
  const tokens = text.split(/\s+/).filter(Boolean);
  const nodes: Node[] = [];
  const glyphSpans: HTMLElement[] = [];
  tokens.forEach((tok, i) => {
    const t = document.createElement('span');
    t.className = 'tok';
    if (glyphs) {
      for (const ch of Array.from(tok)) {
        const g = document.createElement('span');
        g.className = 'g';
        g.textContent = ch;
        t.appendChild(g);
        glyphSpans.push(g);
      }
    } else {
      t.textContent = tok;
    }
    nodes.push(t);
    if (i < tokens.length - 1) nodes.push(document.createTextNode(' '));
  });
  return { nodes, glyphSpans };
}

export function fitLine(
  text: string, spec: Spec, maxWidth = spec.maxWidth ?? BODY.maxWidth, glyphs = false,
): LineFit {
  const floor = spec.minFontSize ?? BODY.minFontSize;
  const probe = document.createElement('div');
  probe.className = 'line';
  probe.style.cssText = [
    'position:absolute', 'visibility:hidden', 'left:-99999px', 'top:0', 'margin-left:0',
    `width:${maxWidth}px`, 'font-weight:800', 'text-align:center',
    'white-space:normal', 'word-break:normal',
  ].join(';');
  document.body.appendChild(probe);

  try {
    let last: LineFit | null = null;
    for (let size = spec.fontSize; size >= floor; size -= BODY.fitStep) {
      const lineHeight = Math.round(size * spec.lineHeightRatio);
      probe.style.fontSize = `${size}px`;
      probe.style.lineHeight = `${lineHeight}px`;
      probe.replaceChildren(...buildLineDom(text, glyphs).nodes);

      const height = probe.offsetHeight;
      const lines = Math.max(1, Math.round(height / lineHeight));

      if (lines <= spec.maxLines) return { fits: true, fontSize: size, lines, height };
      last = { fits: false, fontSize: size, lines, height };
    }
    return {
      fits: false,
      fontSize: floor,
      lines: last?.lines ?? 0,
      height: last?.height ?? 0,
      reason:
        `"${text.slice(0, 48)}${text.length > 48 ? '…' : ''}" needs ${last?.lines} lines at the ` +
        `${floor}px floor but only ${spec.maxLines} are allowed — shorten the display text`,
    };
  } finally {
    probe.remove();
  }
}

/** One glyph of a working line: its character and box relative to the line's content box. */
export interface GlyphBox { ch: string; x: number; y: number; w: number; h: number }

export interface LessonFit {
  fits: boolean;
  results: Array<{ index: number; instruction: LineFit; working: LineFit; glyphs: GlyphBox[] }>;
  hero: { working: LineFit; kicker: LineFit; glyphs: GlyphBox[] };
  ask: LineFit;
  problems: Array<{ where: string; reason: string | null }>;
}

/**
 * Where each glyph of a working line sits once laid out — measured with the exact DOM the scene
 * renders (a token span per word, a glyph span per character), at the fitted size. The scene
 * uses these to slide a glyph from where it was in the previous step to where it is in this one.
 */
export function measureGlyphs(text: string, fontSize: number, lineHeightRatio: number, maxWidth = BODY.maxWidth): GlyphBox[] {
  const line = document.createElement('div');
  line.className = 'line';
  line.style.cssText = [
    'position:absolute', 'visibility:hidden', 'left:-99999px', 'top:0', 'margin-left:0',
    `width:${maxWidth}px`, 'font-weight:800', 'text-align:center', 'white-space:normal',
    `font-size:${fontSize}px`, `line-height:${Math.round(fontSize * lineHeightRatio)}px`,
  ].join(';');
  const { nodes, glyphSpans } = buildLineDom(text, true);
  line.append(...nodes);
  document.body.appendChild(line);
  try {
    return glyphSpans.map((g) => ({
      ch: g.textContent ?? '', x: g.offsetLeft, y: g.offsetTop, w: g.offsetWidth, h: g.offsetHeight,
    }));
  } finally {
    line.remove();
  }
}

/**
 * Fit every line up front, before the capture starts. One pass, so the sizes cannot vary between
 * frames, and a failure is known before a single frame is written.
 *
 * A step with a diagram is fitted against the compact top-anchored body, which is tighter and
 * holds the working line to one line — otherwise the text grows down into the slot the diagram
 * needs.
 *
 * @param hookDisplay  the on-screen line for the spoken hook (falls back to step 1's instruction)
 * @param ask          the closing ask line
 */
export function fitLesson(
  steps: Array<{ instruction: string; working: string; visual?: unknown }>,
  hookDisplay: string,
  ask: string,
): LessonFit {
  const results = steps.map((s, i) => {
    const body = s.visual ? BODY_WITH_VISUAL : BODY;
    const working = fitLine(s.working, body.working, undefined, true);
    return {
      index: i,
      instruction: fitLine(s.instruction, body.instruction),
      working,
      glyphs: measureGlyphs(s.working, working.fontSize, body.working.lineHeightRatio),
    };
  });
  const heroWorking = fitLine(steps[0]?.working ?? '', HERO.working, undefined, true);
  const hero = {
    working: heroWorking,
    kicker: fitLine(hookDisplay, HERO.kicker),
    glyphs: measureGlyphs(steps[0]?.working ?? '', heroWorking.fontSize, HERO.working.lineHeightRatio),
  };
  const askFit = fitLine(ask, ASK);

  const problems: LessonFit['problems'] = [];
  results.forEach((r) => {
    if (!r.instruction.fits) problems.push({ where: `step ${r.index} instruction`, reason: r.instruction.reason ?? null });
    if (!r.working.fits) problems.push({ where: `step ${r.index} working`, reason: r.working.reason ?? null });
  });
  if (!hero.working.fits) problems.push({ where: 'hero working', reason: hero.working.reason ?? null });
  if (!hero.kicker.fits) problems.push({ where: 'hook display', reason: hero.kicker.reason ?? null });
  if (!askFit.fits) problems.push({ where: 'ask', reason: askFit.reason ?? null });

  return { fits: problems.length === 0, results, hero, ask: askFit, problems };
}
