/**
 * Renders a PlotGeometry as SVG.
 *
 * `progress` is the draw-on, 0 to 1, and the caller computes it from the frame index — there is
 * no timer, no CSS transition and no requestAnimationFrame here, because a frame of this page is
 * screenshotted in isolation and has to be a pure function of its number.
 *
 * The build is worth having rather than a fade: a curve that draws itself is the difference
 * between showing a viewer a shape and showing them where the shape comes from. Give it a second
 * or two and let the finished state hold; see the math-visual skill.
 */
import { buildPlot, type PlotBox, type PlotGeometry, type PlotSpec } from './geometry';

export interface PlotPalette {
  curve: string;
  fill: string;
  axis: string;
  grid: string;
  label: string;
}

/** The card's own colours. A plot that introduces a third palette stops looking like the post. */
export const PLOT_PALETTE: PlotPalette = {
  curve: '#1E76C3',
  fill: 'rgba(30, 118, 195, 0.16)',
  axis: '#0B0D12',
  grid: '#E4E7EC',
  label: '#6B7280',
};

export const PLOT_BOX: PlotBox = {
  width: 564,
  height: 470,
  pad: { top: 26, right: 26, bottom: 40, left: 46 },
};

/** 4–8 px at 1080 wide, per the skill: thinner than this and compression eats the curve. */
const CURVE_WIDTH = 6;

export interface PlotProps {
  spec: PlotSpec;
  box?: PlotBox;
  palette?: PlotPalette;
  /** 0 draws nothing, 1 draws the whole curve. Anything outside is clamped. */
  progress?: number;
  labelSize?: number;
}

export function Plot({ spec, box = PLOT_BOX, palette = PLOT_PALETTE, progress = 1, labelSize = 18 }: PlotProps) {
  let geom: PlotGeometry;
  try {
    geom = buildPlot(spec, box);
  } catch (err) {
    // A spec that does not compile must be visible, not silently absent: a blank slot where a
    // curve should be reads as a design choice, and ships.
    return (
      <svg width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`}>
        <rect width={box.width} height={box.height} fill="#7f1d1d" />
        <text x={16} y={30} fill="#fff" fontSize={16} fontWeight={600}>plot error</text>
        <text x={16} y={54} fill="#fff" fontSize={13}>{String(err instanceof Error ? err.message : err)}</text>
      </svg>
    );
  }

  const p = Math.min(1, Math.max(0, progress));
  const drawn = geom.totalLength * p;
  const penX = penPosition(geom, drawn);
  const clipId = `plot-fill-${hashSpec(spec)}`;

  // The draw-on spans the runs in order: each takes as much of the budget as it has length, so a
  // curve broken by a pole still draws left to right instead of every piece growing at once.
  let consumed = 0;
  const dashFor = (length: number) => {
    const shown = Math.min(length, Math.max(0, drawn - consumed));
    consumed += length;
    return { dasharray: length, dashoffset: length - shown };
  };

  return (
    <svg
      width={box.width}
      height={box.height}
      viewBox={`0 0 ${box.width} ${box.height}`}
      className="plot"
      shapeRendering="geometricPrecision"
    >
      {geom.gridLines.map((d, i) => (
        <path key={`g${i}`} d={d} stroke={palette.grid} strokeWidth={1} fill="none" />
      ))}

      {geom.axes.x && <path d={geom.axes.x} stroke={palette.axis} strokeWidth={2} fill="none" />}
      {geom.axes.y && <path d={geom.axes.y} stroke={palette.axis} strokeWidth={2} fill="none" />}

      {geom.ticks.map((t, i) => (
        <text
          key={`t${i}`}
          x={t.x}
          y={t.y}
          fill={palette.label}
          fontSize={labelSize}
          textAnchor={t.axis === 'x' ? 'middle' : 'end'}
          dominantBaseline={t.axis === 'x' ? 'hanging' : 'middle'}
        >
          {t.label}
        </text>
      ))}

      {/* The fill is revealed by a window that tracks the pen, so the shaded area never runs
          ahead of the line that bounds it. Fading it in instead would show the whole region
          while the curve was still a third drawn — the area would be claiming a boundary that
          was not there yet. */}
      {geom.fill && (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect x={0} y={0} width={Math.max(0, penX)} height={box.height} />
            </clipPath>
          </defs>
          <path d={geom.fill} fill={palette.fill} clipPath={`url(#${clipId})`} />
        </>
      )}

      {geom.runs.map((run, i) => {
        const { dasharray, dashoffset } = dashFor(run.length);
        return (
          <path
            key={`r${i}`}
            d={run.d}
            fill="none"
            stroke={palette.curve}
            strokeWidth={CURVE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={dasharray}
            strokeDashoffset={dashoffset}
          />
        );
      })}

      {spec.xLabel && (
        <text x={box.width - box.pad.right} y={box.height - 6} fill={palette.label}
              fontSize={labelSize} textAnchor="end">{spec.xLabel}</text>
      )}
      {spec.yLabel && (
        <text x={box.pad.left - 6} y={box.pad.top - 8} fill={palette.label}
              fontSize={labelSize} textAnchor="end">{spec.yLabel}</text>
      )}
    </svg>
  );
}

/**
 * Where the pen has reached along the curve, in SVG x, after `drawn` units of length.
 *
 * Runs are consumed in order and each segment is walked until the budget runs out, so the answer
 * follows the same path the stroke-dashoffset does rather than approximating it.
 */
function penPosition(geom: PlotGeometry, drawn: number): number {
  let left = drawn;
  let last = 0;
  for (const run of geom.runs) {
    for (let i = 1; i < run.points.length; i++) {
      const a = run.points[i - 1], b = run.points[i];
      const seg = Math.hypot(b.px - a.px, b.py - a.py);
      if (left < seg) return a.px + (b.px - a.px) * (seg === 0 ? 0 : left / seg);
      left -= seg;
      last = b.px;
    }
  }
  return last || geom.width;
}

/**
 * A stable id for this plot's clip path. Two plots on one page must not share one, and the value
 * has to be the same on every frame or the clip would be re-created mid-capture.
 */
function hashSpec(spec: PlotSpec): string {
  const src = JSON.stringify(spec);
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) { h ^= src.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
