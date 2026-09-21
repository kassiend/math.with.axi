/**
 * Lesson visuals — a closed registry of computed diagrams for the lesson card.
 *
 * Every component is a pure function of `build` (0..1), which the scene derives from the frame
 * index. No timers, no requestAnimationFrame, no Date: a frame is a pure function of its number,
 * or the same lesson renders differently on two machines (see the math-visual skill).
 *
 * The registry is closed on purpose. A new kind of diagram is a new component here, not a new
 * payload field — the payload stays declarative (`{"type": "line-multiplication", "a": 21, "b": 13}`)
 * so a planner cannot ship arbitrary markup into a frame.
 *
 * Every number drawn is computed here from the operands, and the lattice cross-checks itself
 * against `a * b` before it draws. A picture that disagrees with the arithmetic renders as a
 * visible error, never as a plausible-looking diagram.
 */
import { VISUAL, VISUAL_DRAW } from './layout';

// The drawing space. The scene scales the whole SVG uniformly into the card's slot, so a diagram
// is laid out once, here, and never has to know how much room the card gave it.
const W = VISUAL_DRAW.w;   // 500
const H = VISUAL_DRAW.h;   // 458

/** Uniform scale from the drawing space to the slot; the SVG is sized to the scaled box. */
const SCALE = Math.min(VISUAL.w / W, VISUAL.h / H);
const SVG_W = Math.round(W * SCALE);
const SVG_H = Math.round(H * SCALE);

const ACCENT = '#1E76C3';
const INK = '#0B0D12';
const MUTE = '#6B7280';
const AMBER = '#E0A43B';
const GRID = '#E4E7EC';

/**
 * The two families of sticks are neutral greys, not two accents.
 *
 * Counting the crossings IS the method, so the dots have to be the only saturated marks on the
 * card. When the lines carried the accent colours too, a blue dot sat on a blue line and the
 * thing the viewer is meant to count disappeared into the thing it sits on.
 */
const STICK_A = '#3F4A5A';
const STICK_B = '#9AA7B6';

/** Colour by place value: units, tens, hundreds. Shared by both diagrams so the eye links them. */
const PLACE_COLOUR = [INK, AMBER, ACCENT];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Sub-progress of `p` inside the window [a, b]. */
const phase = (p: number, a: number, b: number) => clamp01((p - a) / Math.max(1e-6, b - a));

/** Progress of item `i` of `n` inside a window that runs them one after another. */
const stagger = (p: number, i: number, n: number) => clamp01(p * n - i);

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

/**
 * How far a line-multiplication diagram is taken.
 *
 * A lesson teaches the method across three or four steps, and the picture has to follow: a step
 * that says "draw the digits as lines" must not finish by printing the answer underneath. So the
 * planner names where this step stops, and each stage spreads its own phases across the whole
 * step rather than racing to the end and waiting.
 */
export type LineStage = 'draw' | 'count' | 'answer';

export type LessonVisualSpec =
  | { type: 'line-multiplication'; a: number; b: number; stage?: LineStage }
  | { type: 'method-compare'; a: number; b: number };

export function LessonVisual({ spec, build }: { spec: LessonVisualSpec; build: number }) {
  if (!spec || typeof spec !== 'object') return <VisualError message="no visual spec" />;
  if (spec.type === 'line-multiplication') {
    return <LineMultiplication a={spec.a} b={spec.b} stage={spec.stage ?? 'answer'} progress={build} />;
  }
  if (spec.type === 'method-compare') {
    return <MethodCompare a={spec.a} b={spec.b} progress={build} />;
  }
  return <VisualError message={`unknown visual type "${(spec as { type: string }).type}"`} />;
}

/**
 * Checked once, before a single frame is captured, so a spec the registry cannot draw closes the
 * render gate instead of painting a red card into a shipped video. Returns null when the spec is
 * drawable, or the reason it is not.
 */
export function validateVisualSpec(spec: unknown): string | null {
  if (spec == null) return null;
  if (typeof spec !== 'object') return `visual must be an object, got ${typeof spec}`;
  const { type } = spec as { type?: string };
  if (type !== 'line-multiplication' && type !== 'method-compare') {
    return `unknown visual type "${type}" — the registry has line-multiplication, method-compare`;
  }
  const { a, b, stage } = spec as { a: number; b: number; stage?: string };
  if (type === 'line-multiplication' && stage != null && !['draw', 'count', 'answer'].includes(stage)) {
    return `unknown line-multiplication stage "${stage}" — expected draw, count or answer`;
  }
  return buildLattice(a, b).error;
}

/**
 * A spec the registry cannot draw must be visible, not absent. A blank slot where a diagram
 * should be reads as a design choice and ships.
 */
function VisualError({ message }: { message: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={SVG_W} height={SVG_H}>
      <rect width={W} height={H} rx={16} fill="#7f1d1d" />
      <text x={20} y={44} fill="#fff" fontSize={22} fontWeight={700}>visual error</text>
      <text x={20} y={78} fill="#fff" fontSize={16}>{message}</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The lattice — the geometry behind stick multiplication
// ---------------------------------------------------------------------------
//
// Both families run at 45 degrees, so a line is fixed by one number:
//   family A (a's digits), direction (1,-1):   x + y = p
//   family B (b's digits), direction (1, 1):   y - x = q
//   they meet at  x = (p - q)/2,  y = (p + q)/2
//
// A's tens group takes the SMALL p values and B's tens group the LARGE q values, which puts
// a1xb1 at the far left, a0xb0 at the far right and the two tens clusters between them — the
// classic picture, where place value falls off to the right.
//
// Place value rises as (q - p) rises, i.e. as x falls, so the place-value groups are separated
// by vertical cuts. They only separate cleanly if the gap between the two digit groups exceeds
// the widest group, hence GAP below: with a gap of max(digit)+1 the bands never interleave.

interface LatticeLine { t: number; group: 0 | 1 }
interface LatticeNode { x: number; y: number; place: number }
interface LatticeBand { place: number; count: number; x0: number; x1: number; cx: number }

export interface Lattice {
  a: number;
  b: number;
  aLines: LatticeLine[];
  bLines: LatticeLine[];
  nodes: LatticeNode[];
  /** Left to right, i.e. highest place first. */
  bands: LatticeBand[];
  /** Digits of the answer after carrying, most significant first. */
  digits: number[];
  /** Carry out of each band, indexed by place. Zero everywhere when the simple rule holds. */
  carries: number[];
  product: number;
  error: string | null;
}

function family(first: number, second: number, gap: number, firstGroup: 0 | 1, secondGroup: 0 | 1) {
  const out: LatticeLine[] = [];
  for (let i = 0; i < first; i++) out.push({ t: i, group: firstGroup });
  const start = Math.max(first, 1) - 1 + gap;
  for (let j = 0; j < second; j++) out.push({ t: start + j, group: secondGroup });
  return out;
}

export function buildLattice(a: number, b: number): Lattice {
  const empty: Lattice = {
    a, b, aLines: [], bLines: [], nodes: [], bands: [], digits: [], carries: [],
    product: a * b, error: null,
  };

  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 10 || a > 99 || b < 10 || b > 99) {
    return { ...empty, error: `${a} x ${b}: both operands must be two-digit integers` };
  }
  const a1 = Math.floor(a / 10), a0 = a % 10, b1 = Math.floor(b / 10), b0 = b % 10;
  if (a0 === 0 || b0 === 0) {
    // A zero digit draws no lines at all, and "no lines" is not a picture of zero — it is an
    // absence the viewer reads as a mistake. The lesson's applicability excludes it.
    return { ...empty, error: `${a} x ${b}: a zero digit has no lines to draw` };
  }

  const gap = Math.max(a1, a0, b1, b0) + 1;
  const aLines = family(a1, a0, gap, 1, 0);
  const bLines = family(b0, b1, gap, 0, 1);

  const nodes: LatticeNode[] = [];
  for (const al of aLines) {
    for (const bl of bLines) {
      nodes.push({
        x: (al.t - bl.t) / 2,
        y: (al.t + bl.t) / 2,
        place: al.group + bl.group,
      });
    }
  }

  const bands: LatticeBand[] = [];
  for (let place = 2; place >= 0; place--) {
    const inBand = nodes.filter((n) => n.place === place);
    if (!inBand.length) continue;
    const xs = inBand.map((n) => n.x);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    bands.push({ place, count: inBand.length, x0, x1, cx: (x0 + x1) / 2 });
  }

  // Carry from the units band upwards, exactly as the method is performed by hand.
  const carries = [0, 0, 0];
  const digits: number[] = [];
  let carry = 0;
  for (let place = 0; place <= 2; place++) {
    const total = (bands.find((band) => band.place === place)?.count ?? 0) + carry;
    digits.unshift(total % 10);
    carry = Math.floor(total / 10);
    carries[place] = carry;
  }
  while (carry > 0) { digits.unshift(carry % 10); carry = Math.floor(carry / 10); }
  while (digits.length > 1 && digits[0] === 0) digits.shift();

  const assembled = Number(digits.join(''));
  const lattice: Lattice = { ...empty, aLines, bLines, nodes, bands, digits, carries };

  // The picture must agree with the arithmetic. If counting the crossings does not reproduce
  // a x b, the diagram is wrong and has to say so rather than draw a confident lie.
  if (assembled !== a * b) {
    return { ...lattice, error: `crossings give ${assembled} but ${a} x ${b} = ${a * b}` };
  }
  return lattice;
}

// --- projection ------------------------------------------------------------

interface Region { x: number; y: number; w: number; h: number; pad: number }

function project(lattice: Lattice, region: Region) {
  const xs = lattice.nodes.map((n) => n.x);
  const ys = lattice.nodes.map((n) => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 0.5);
  const spanY = Math.max(maxY - minY, 0.5);

  const scale = Math.min((region.w - 2 * region.pad) / spanX, (region.h - 2 * region.pad) / spanY);
  const ox = region.x + region.w / 2 - ((minX + maxX) / 2) * scale;
  const oy = region.y + region.h / 2 - ((minY + maxY) / 2) * scale;

  return {
    scale,
    px: (x: number) => ox + x * scale,
    py: (y: number) => oy + y * scale,
  };
}

type Projection = ReturnType<typeof project>;

/**
 * The drawn segment of one line: from its extreme intersections, extended past both so the
 * strokes read as sticks laid down rather than as a wireframe stopping at the corners.
 */
function segment(kind: 'a' | 'b', t: number, other: LatticeLine[], proj: Projection, overhang: number) {
  const ts = other.map((o) => o.t);
  const lo = Math.min(...ts), hi = Math.max(...ts);

  const at = (o: number) => (kind === 'a'
    ? { x: (t - o) / 2, y: (t + o) / 2 }
    : { x: (o - t) / 2, y: (o + t) / 2 });

  const p1 = at(kind === 'a' ? hi : lo);   // upper-left / lower-left end
  const p2 = at(kind === 'a' ? lo : hi);
  const e = overhang / Math.SQRT2;
  // A runs up-and-right, B runs down-and-right; the overhang follows each line's own direction.
  const d = kind === 'a' ? { x: 1, y: -1 } : { x: 1, y: 1 };

  return {
    x1: proj.px(p1.x) - d.x * e, y1: proj.py(p1.y) - d.y * e,
    x2: proj.px(p2.x) + d.x * e, y2: proj.py(p2.y) + d.y * e,
  };
}

function DrawnLine(
  { seg, colour, width, t }:
  { seg: { x1: number; y1: number; x2: number; y2: number }; colour: string; width: number; t: number },
) {
  const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
  if (t <= 0) return null;
  return (
    <line
      x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
      stroke={colour} strokeWidth={width} strokeLinecap="round"
      strokeDasharray={len} strokeDashoffset={len * (1 - easeOut(t))}
    />
  );
}

// ---------------------------------------------------------------------------
// line-multiplication — the whole method, drawn
// ---------------------------------------------------------------------------

/**
 * Phase windows per stage. A null window means the element never appears at this stage — which
 * is the whole point: an earlier step must not show a later step's answer.
 */
type Window = [number, number] | null;
const PLAN: Record<LineStage, { aLines: Window; bLines: Window; dots: Window; bands: Window; result: Window }> = {
  draw: { aLines: [0.00, 0.48], bLines: [0.48, 1.00], dots: null, bands: null, result: null },
  count: { aLines: [0.00, 0.16], bLines: [0.16, 0.32], dots: [0.32, 0.62], bands: [0.62, 1.00], result: null },
  answer: { aLines: [0.00, 0.13], bLines: [0.13, 0.26], dots: [0.26, 0.48], bands: [0.48, 0.76], result: [0.76, 1.00] },
};

const DIAGRAM: Region = { x: 0, y: 0, w: W, h: 320, pad: 26 };
const PILL_Y = 340;
const RESULT_Y = 430;

export function LineMultiplication(
  { a, b, stage = 'answer', progress }:
  { a: number; b: number; stage?: LineStage; progress: number },
) {
  const lattice = buildLattice(a, b);
  if (lattice.error) return <VisualError message={lattice.error} />;

  const p = clamp01(progress);
  const proj = project(lattice, DIAGRAM);
  const strokeW = Math.max(3, Math.min(6, proj.scale * 0.09));
  const dotR = Math.max(5, Math.min(11, proj.scale * 0.17));
  const overhang = Math.max(16, Math.min(40, proj.scale * 0.5));

  const plan = PLAN[stage] ?? PLAN.answer;
  const at = (w: Window) => (w ? phase(p, w[0], w[1]) : 0);
  const tA = at(plan.aLines);
  const tB = at(plan.bLines);
  const tDots = at(plan.dots);
  const tBands = at(plan.bands);
  const tResult = at(plan.result);

  // Left to right, so the crossings light up in the order they are counted.
  const dots = [...lattice.nodes].sort((m, n) => m.x - n.x);

  // Cuts sit midway between neighbouring bands, in the gap the group spacing guarantees, and
  // span only the crossings — a full-height rule reads as a border rather than as a separator.
  const ys = lattice.nodes.map((n) => proj.py(n.y));
  const cutTop = Math.min(...ys) - 22;
  const cutBottom = Math.max(...ys) + 22;
  const cuts = lattice.bands.slice(0, -1).map((band, i) =>
    proj.px((band.x1 + lattice.bands[i + 1].x0) / 2));

  const anyCarry = lattice.carries.some((c) => c > 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={SVG_W} height={SVG_H}>
      {tBands > 0 && cuts.map((x, i) => (
        <line
          key={`cut-${i}`} x1={x} y1={cutTop} x2={x} y2={cutBottom}
          stroke={GRID} strokeWidth={2} strokeDasharray="7 8"
        />
      ))}

      {lattice.aLines.map((line, i) => (
        <DrawnLine
          key={`a-${i}`}
          seg={segment('a', line.t, lattice.bLines, proj, overhang)}
          colour={STICK_A} width={strokeW}
          t={stagger(tA, i, lattice.aLines.length)}
        />
      ))}

      {lattice.bLines.map((line, i) => (
        <DrawnLine
          key={`b-${i}`}
          seg={segment('b', line.t, lattice.aLines, proj, overhang)}
          colour={STICK_B} width={strokeW}
          t={stagger(tB, i, lattice.bLines.length)}
        />
      ))}

      {dots.map((node, i) => {
        const t = easeOut(stagger(tDots, i, dots.length));
        if (t <= 0) return null;
        return (
          <circle
            key={`d-${i}`}
            cx={proj.px(node.x)} cy={proj.py(node.y)} r={dotR * t}
            fill={PLACE_COLOUR[node.place]} stroke="#FFFFFF" strokeWidth={2}
          />
        );
      })}

      {/* operand labels, so the picture says which number owns which family of sticks */}
      <text x={10} y={26} fill={STICK_A} fontSize={26} fontWeight={800}>{a}</text>
      <text x={W - 10} y={26} fill={STICK_B} fontSize={26} fontWeight={800} textAnchor="end">{b}</text>

      {lattice.bands.map((band, i) => {
        const t = easeOut(stagger(tBands, i, lattice.bands.length));
        if (t <= 0) return null;
        const cx = proj.px(band.cx);
        const carry = lattice.carries[band.place];
        return (
          <g key={`band-${i}`} opacity={t}>
            <circle cx={cx} cy={PILL_Y} r={27} fill={PLACE_COLOUR[band.place]} />
            <text
              x={cx} y={PILL_Y + 10} fill="#FFFFFF" fontSize={band.count > 9 ? 26 : 30}
              fontWeight={800} textAnchor="middle"
            >
              {band.count}
            </text>
            {/* The carry belongs to the step that teaches it. At the `count` stage the pills must
                read as the raw band counts and nothing more, or the caveat step has been spoiled
                by the step before it. */}
            {carry > 0 && tResult > 0 && (
              <text
                x={cx - 44} y={PILL_Y - 24} fill={AMBER} fontSize={21} fontWeight={800}
                textAnchor="middle" opacity={easeOut(tResult)}
              >
                +{carry}
              </text>
            )}
          </g>
        );
      })}

      {tResult > 0 && (
        <g opacity={easeOut(tResult)}>
          <text x={W / 2} y={RESULT_Y} fill={ACCENT} fontSize={42} fontWeight={800} textAnchor="middle">
            {a} × {b} = {lattice.product}
          </text>
          {anyCarry && (
            <text x={W / 2} y={RESULT_Y - 44} fill={MUTE} fontSize={20} textAnchor="middle">
              a pile of ten or more carries left
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// method-compare — the crossings and the digit products, column by column
// ---------------------------------------------------------------------------
//
// The comparison is not "here are two tricks". It is that they are the same arithmetic: the
// crossings in a band ARE the digit products that land in that column of the standard method.
// So the two are stacked in ONE set of columns rather than set side by side — a band, the
// product that fills it, and what that product is worth, read straight down.
//
// Side by side was the first attempt and it failed for a reason worth keeping: two small pictures
// in a 500 px slot are both too small to read, and putting them apart is exactly the wrong claim.

const CMP = {
  diagram: { x: 0, y: 0, w: W, h: 292, pad: 24 } as Region,
  pillY: 322,
  exprY: 368,
  valueY: 400,
  ruleY: 414,
  resultY: 448,
};

export function MethodCompare({ a, b, progress }: { a: number; b: number; progress: number }) {
  const lattice = buildLattice(a, b);
  if (lattice.error) return <VisualError message={lattice.error} />;

  const p = clamp01(progress);
  const proj = project(lattice, CMP.diagram);
  const strokeW = Math.max(2.5, Math.min(5, proj.scale * 0.085));
  const dotR = Math.max(4, Math.min(9, proj.scale * 0.16));
  const overhang = Math.max(12, Math.min(32, proj.scale * 0.5));

  const tLines = phase(p, 0.00, 0.20);
  const tDots = phase(p, 0.20, 0.34);
  const tPills = phase(p, 0.34, 0.50);
  const tExpr = phase(p, 0.50, 0.70);
  const tValue = phase(p, 0.70, 0.86);
  const tResult = phase(p, 0.86, 1.00);

  const a1 = Math.floor(a / 10), a0 = a % 10;
  const b1 = Math.floor(b / 10), b0 = b % 10;

  /**
   * What each band is, written as digit products, and what it is worth once its place is
   * restored. These are the numbers the standard method writes down — the same ones, in the
   * same columns.
   */
  const COLUMN = {
    2: { expr: `${a1}·${b1}`, value: a1 * b1 * 100 },
    1: { expr: `${a1}·${b0}+${a0}·${b1}`, value: (a1 * b0 + a0 * b1) * 10 },
    0: { expr: `${a0}·${b0}`, value: a0 * b0 },
  } as const;

  const columns = lattice.bands.map((band) => ({ band, ...COLUMN[band.place as 0 | 1 | 2] }));
  const total = columns.reduce((sum, c) => sum + c.value, 0);

  // Same rule as the lattice: the picture states an equality, so it checks it before drawing it.
  if (total !== lattice.product) {
    return <VisualError message={`columns give ${total} but ${a} x ${b} = ${lattice.product}`} />;
  }

  const dots = [...lattice.nodes].sort((m, n) => m.x - n.x);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={SVG_W} height={SVG_H}>
      {lattice.aLines.map((line, i) => (
        <DrawnLine
          key={`a-${i}`} seg={segment('a', line.t, lattice.bLines, proj, overhang)}
          colour={STICK_A} width={strokeW} t={stagger(tLines, i, lattice.aLines.length)}
        />
      ))}
      {lattice.bLines.map((line, i) => (
        <DrawnLine
          key={`b-${i}`} seg={segment('b', line.t, lattice.aLines, proj, overhang)}
          colour={STICK_B} width={strokeW} t={stagger(tLines, i, lattice.bLines.length)}
        />
      ))}
      {dots.map((node, i) => {
        const t = easeOut(stagger(tDots, i, dots.length));
        if (t <= 0) return null;
        return (
          <circle
            key={`d-${i}`} cx={proj.px(node.x)} cy={proj.py(node.y)} r={dotR * t}
            fill={PLACE_COLOUR[node.place]} stroke="#FFFFFF" strokeWidth={2}
          />
        );
      })}

      {columns.map((col, i) => {
        const cx = proj.px(col.band.cx);
        const colour = PLACE_COLOUR[col.band.place];
        const tp = easeOut(stagger(tPills, i, columns.length));
        const te = easeOut(stagger(tExpr, i, columns.length));
        const tv = easeOut(stagger(tValue, i, columns.length));
        return (
          <g key={`col-${i}`}>
            {tp > 0 && (
              <g opacity={tp}>
                <circle cx={cx} cy={CMP.pillY} r={24} fill={colour} />
                <text
                  x={cx} y={CMP.pillY + 9} fill="#FFFFFF"
                  fontSize={col.band.count > 9 ? 23 : 27} fontWeight={800} textAnchor="middle"
                >
                  {col.band.count}
                </text>
              </g>
            )}
            {te > 0 && (
              <text x={cx} y={CMP.exprY} fill={colour} fontSize={19} fontWeight={700} textAnchor="middle" opacity={te}>
                {col.expr}
              </text>
            )}
            {tv > 0 && (
              <text x={cx} y={CMP.valueY} fill={colour} fontSize={26} fontWeight={800} textAnchor="middle" opacity={tv}>
                {col.value}
              </text>
            )}
          </g>
        );
      })}

      {tResult > 0 && (
        <g opacity={easeOut(tResult)}>
          <line x1={70} y1={CMP.ruleY} x2={W - 70} y2={CMP.ruleY} stroke={GRID} strokeWidth={2} />
          <text x={W / 2} y={CMP.resultY} fontSize={34} fontWeight={800} textAnchor="middle">
            {columns.map((col, i) => (
              <tspan key={`t-${i}`} fill={PLACE_COLOUR[col.band.place]}>
                {i > 0 ? ' + ' : ''}{col.value}
              </tspan>
            ))}
            <tspan fill={ACCENT}> = {total}</tspan>
          </text>
        </g>
      )}
    </svg>
  );
}
