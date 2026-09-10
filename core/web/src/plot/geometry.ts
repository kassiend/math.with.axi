/**
 * Turns a plot specification into geometry: sampled curves, axes, ticks, and SVG path data.
 *
 * Pure arithmetic, no DOM and no dependencies — the same input gives the same numbers on every
 * machine, which is the property a frame-by-frame capture depends on. Rendering lives in Plot.tsx;
 * nothing here knows it is going into SVG beyond emitting path strings.
 *
 * Two things this handles that a naive sampler gets wrong, both of which are visible defects:
 *
 *   1. **Discontinuities.** tan(x) and 1/x jump between samples. Joining those samples draws a
 *      near-vertical line through the whole frame that reads as part of the curve. Runs are split
 *      at non-finite values and at jumps too large to be a real slope at this sample density.
 *   2. **Autoscale on a curve that diverges.** Taking min/max over raw samples lets one sample
 *      near a pole set the range and flatten everything else into a line. The default range comes
 *      from a percentile band instead, with the outliers clipped rather than accommodated.
 */
import { compile } from './expr';

export interface PlotSpec {
  kind: 'function' | 'parametric' | 'polar';
  /** kind 'function': y as an expression in x. */
  expr?: string;
  /** kind 'parametric': x and y as expressions in t. */
  x?: string;
  y?: string;
  /** kind 'polar': r as an expression in theta. */
  r?: string;
  /** x-range for 'function', t-range for 'parametric', theta-range for 'polar'. */
  domain: [number, number];
  /** Visible x/y window. Either may be omitted and is then fitted to the samples. */
  xRange?: [number, number];
  yRange?: [number, number];
  samples?: number;
  axes?: boolean;
  grid?: boolean;
  xLabel?: string;
  yLabel?: string;
  /** Draws a filled band under the curve down to y = 0. For integrals, which is why we are here. */
  fillTo?: 'zero' | null;
  /** Restricts the fill to a sub-interval of x, e.g. the limits of a definite integral. */
  fillDomain?: [number, number];
}

export interface PlotGeometry {
  width: number;
  height: number;
  /**
   * Curve runs, already in SVG pixel space. One run per continuous piece. `points` is kept
   * alongside the path data so the caller can ask where the pen is part-way through a draw-on —
   * from a path string that question cannot be answered without re-parsing it.
   */
  runs: Array<{ d: string; length: number; points: Array<{ px: number; py: number }> }>;
  /** Total polyline length across every run, for a draw-on that spans the whole curve. */
  totalLength: number;
  fill: string | null;
  axes: { x: string | null; y: string | null };
  gridLines: string[];
  ticks: Array<{ x: number; y: number; label: string; axis: 'x' | 'y' }>;
  window: { xMin: number; xMax: number; yMin: number; yMax: number };
}

export interface PlotBox {
  width: number;
  height: number;
  /** Space reserved for tick labels. Ticks are drawn inside it, the curve is not. */
  pad: { top: number; right: number; bottom: number; left: number };
}

const DEFAULT_SAMPLES = 600;

/** 1, 2, 5 × 10^k — the step sizes people read without thinking about them. */
function niceStep(span: number, target: number): number {
  const raw = span / Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function ticksFor(min: number, max: number, target: number): number[] {
  const step = niceStep(max - min, target);
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    // -0 prints as "-0"; fold it before it reaches a label.
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return out;
}

function formatTick(v: number, step: number): string {
  if (v === 0) return '0';
  const decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(step))));
  const s = v.toFixed(decimals);
  return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/**
 * The visible y-window for a curve that may diverge.
 *
 * Sorting the finite samples and taking a central band means a pole contributes one enormous
 * sample that is clipped, instead of setting the scale for everything else. The band is padded
 * outwards so the curve does not touch the frame edge.
 */
function autoRange(values: number[]): [number, number] {
  const finite = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!finite.length) return [-1, 1];
  const lo = finite[Math.floor(finite.length * 0.02)];
  const hi = finite[Math.min(finite.length - 1, Math.floor(finite.length * 0.98))];
  if (!(hi > lo)) {
    const c = finite[Math.floor(finite.length / 2)];
    return [c - 1, c + 1];
  }
  const pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}

export function buildPlot(spec: PlotSpec, box: PlotBox): PlotGeometry {
  const n = Math.max(2, spec.samples ?? DEFAULT_SAMPLES);
  const [d0, d1] = spec.domain;

  // ---- 1. Sample in data space ------------------------------------------
  const pts: Array<{ x: number; y: number }> = [];
  if (spec.kind === 'function') {
    if (!spec.expr) throw new Error("plot kind 'function' needs `expr`");
    const f = compile(spec.expr, ['x']);
    for (let i = 0; i < n; i++) {
      const x = d0 + ((d1 - d0) * i) / (n - 1);
      pts.push({ x, y: f(x) });
    }
  } else if (spec.kind === 'parametric') {
    if (!spec.x || !spec.y) throw new Error("plot kind 'parametric' needs `x` and `y`");
    const fx = compile(spec.x, ['t']);
    const fy = compile(spec.y, ['t']);
    for (let i = 0; i < n; i++) {
      const t = d0 + ((d1 - d0) * i) / (n - 1);
      pts.push({ x: fx(t), y: fy(t) });
    }
  } else {
    if (!spec.r) throw new Error("plot kind 'polar' needs `r`");
    const fr = compile(spec.r, ['theta']);
    for (let i = 0; i < n; i++) {
      const th = d0 + ((d1 - d0) * i) / (n - 1);
      const r = fr(th);
      pts.push({ x: r * Math.cos(th), y: r * Math.sin(th) });
    }
  }

  // ---- 2. Window --------------------------------------------------------
  const [xMin, xMax] = spec.xRange ?? autoRange(pts.map((p) => p.x));
  const [yMin, yMax] = spec.yRange ?? autoRange(pts.map((p) => p.y));

  const { width: W, height: H, pad } = box;
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const sx = (x: number) => pad.left + ((x - xMin) / (xMax - xMin)) * innerW;
  const sy = (y: number) => pad.top + innerH - ((y - yMin) / (yMax - yMin)) * innerH;

  // ---- 3. Split into continuous runs ------------------------------------
  // A jump larger than a third of the frame between adjacent samples is a discontinuity, not a
  // slope: at this density a real curve cannot cross that much ground in one step.
  const maxJump = innerH / 3;
  const runs: PlotGeometry['runs'] = [];
  let current: Array<{ px: number; py: number }> = [];
  const flush = () => {
    if (current.length < 2) { current = []; return; }
    let d = `M${current[0].px.toFixed(2)} ${current[0].py.toFixed(2)}`;
    let length = 0;
    for (let i = 1; i < current.length; i++) {
      d += `L${current[i].px.toFixed(2)} ${current[i].py.toFixed(2)}`;
      length += Math.hypot(current[i].px - current[i - 1].px, current[i].py - current[i - 1].py);
    }
    runs.push({ d, length, points: current });
    current = [];
  };

  let prev: { px: number; py: number } | null = null;
  for (const p of pts) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { flush(); prev = null; continue; }
    // Off-window samples still steer the line into the frame, so keep one step of overshoot and
    // let the clip path trim it. Dropping them outright would make the curve stop short of the edge.
    const outside = p.y < yMin - (yMax - yMin) || p.y > yMax + (yMax - yMin);
    if (outside) { flush(); prev = null; continue; }
    const px = sx(p.x), py = sy(p.y);
    if (prev && Math.abs(py - prev.py) > maxJump) { flush(); prev = null; }
    current.push({ px, py });
    prev = { px, py };
  }
  flush();

  // ---- 4. Fill under the curve, when asked -------------------------------
  let fill: string | null = null;
  if (spec.fillTo === 'zero' && spec.kind === 'function') {
    const [f0, f1] = spec.fillDomain ?? [Math.max(xMin, d0), Math.min(xMax, d1)];
    const inside = pts.filter((p) => p.x >= f0 && p.x <= f1 && Number.isFinite(p.y));
    if (inside.length >= 2) {
      const baseline = sy(Math.min(Math.max(0, yMin), yMax));
      let d = `M${sx(inside[0].x).toFixed(2)} ${baseline.toFixed(2)}`;
      for (const p of inside) d += `L${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)}`;
      d += `L${sx(inside[inside.length - 1].x).toFixed(2)} ${baseline.toFixed(2)}Z`;
      fill = d;
    }
  }

  // ---- 5. Axes, grid, ticks ---------------------------------------------
  const wantAxes = spec.axes !== false;
  const xStep = niceStep(xMax - xMin, 6);
  const yStep = niceStep(yMax - yMin, 5);
  const xTicks = ticksFor(xMin, xMax, 6);
  const yTicks = ticksFor(yMin, yMax, 5);

  // Axes sit at zero when zero is on screen, and on the frame edge when it is not — a y-axis
  // pinned to x=0 when the window starts at x=10 would be drawn off the plot entirely.
  const axisY = yMin <= 0 && yMax >= 0 ? sy(0) : pad.top + innerH;
  const axisX = xMin <= 0 && xMax >= 0 ? sx(0) : pad.left;

  const axes = {
    x: wantAxes ? `M${pad.left} ${axisY.toFixed(2)}H${(pad.left + innerW).toFixed(2)}` : null,
    y: wantAxes ? `M${axisX.toFixed(2)} ${pad.top}V${(pad.top + innerH).toFixed(2)}` : null,
  };

  const gridLines: string[] = [];
  if (spec.grid) {
    for (const t of xTicks) gridLines.push(`M${sx(t).toFixed(2)} ${pad.top}V${(pad.top + innerH).toFixed(2)}`);
    for (const t of yTicks) gridLines.push(`M${pad.left} ${sy(t).toFixed(2)}H${(pad.left + innerW).toFixed(2)}`);
  }

  const ticks: PlotGeometry['ticks'] = [];
  if (wantAxes) {
    for (const t of xTicks) {
      if (t === 0) continue;                          // the origin label collides with the y-axis
      ticks.push({ x: sx(t), y: axisY + 4, label: formatTick(t, xStep), axis: 'x' });
    }
    for (const t of yTicks) {
      if (t === 0) continue;
      ticks.push({ x: axisX - 6, y: sy(t), label: formatTick(t, yStep), axis: 'y' });
    }
  }

  return {
    width: W,
    height: H,
    runs,
    totalLength: runs.reduce((a, r) => a + r.length, 0),
    fill,
    axes,
    gridLines,
    ticks,
    window: { xMin, xMax, yMin, yMax },
  };
}
