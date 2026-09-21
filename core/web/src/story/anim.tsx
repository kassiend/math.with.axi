/**
 * Computed mechanism animations — one per story that needs its long formula beat to move.
 *
 * Every component is a pure function of `progress` (0..1), which the scene derives from the frame
 * index. No timers, no requestAnimationFrame, no Date: a frame is a pure function of its number,
 * or the same post renders differently on two machines (see the math-visual skill).
 *
 * Each draws into the visual slot's own 564x470 box. Numbers shown are computed here from the same
 * values the story's SymPy check already verified, so the picture cannot drift from the claim.
 */
import { VISUAL } from './layout';

const W = VISUAL.w;   // 564
const H = VISUAL.h;   // 470
const ACCENT = '#1E76C3';
const INK = '#0B0D12';
const MUTE = '#6B7280';
const GRID = '#E4E7EC';
const FILL = 'rgba(30, 118, 195, 0.16)';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// Euclid — the subtraction loop, run on the story's own example.
// ---------------------------------------------------------------------------

/** Larger-first states of "subtract the smaller from the larger until equal". */
function gcdStates(a: number, b: number): Array<[number, number]> {
  let x = Math.max(a, b), y = Math.min(a, b);
  const out: Array<[number, number]> = [[x, y]];
  let guard = 0;
  while (x !== y && guard++ < 1000) {
    const big = Math.max(x, y), small = Math.min(x, y);
    const nb = big - small;
    x = Math.max(nb, small); y = Math.min(nb, small);
    out.push([x, y]);
  }
  return out;
}

export function GcdSubtraction({ a, b, progress }: { a: number; b: number; progress: number }) {
  const states = gcdStates(a, b);
  const nSub = states.length - 1;
  const g = states[nSub][0];

  const pos = clamp01(progress) * nSub;
  const idx = Math.min(Math.floor(pos + 1e-9), nSub);
  const frac = easeOut(clamp01(pos - idx));
  const done = idx >= nSub;

  const [big, small] = states[idx];
  // Leave room past the longest bar for its value label — a full-width bar plus "1920" would
  // otherwise push the last digit past the 564 viewBox and render as "192".
  const scale = 366 / Math.max(a, b);
  const x0 = 40;
  const barH = 46;
  const topY = 150;
  const botY = 232;

  // The trailing `small`-wide slice of the big bar is the piece about to be removed; it fills in
  // over the step, then the bars snap to the next state.
  const cutW = small * scale;
  const bigW = big * scale;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <text x={W / 2} y={54} fill={INK} fontSize={30} fontWeight={800} textAnchor="middle">
        gcd({a}, {b})
      </text>
      <text x={W / 2} y={92} fill={MUTE} fontSize={20} textAnchor="middle">
        {done ? 'both equal — that is the gcd' : 'subtract the smaller from the larger'}
      </text>

      {/* top (larger) bar */}
      <rect x={x0} y={topY} width={bigW} height={barH} rx={8} fill={done ? ACCENT : '#CFE0F0'} />
      {!done && (
        <rect x={x0 + bigW - cutW} y={topY} width={cutW * frac} height={barH} rx={8} fill={ACCENT} opacity={0.9} />
      )}
      <text x={x0 + bigW + 12} y={topY + barH / 2 + 7} fill={INK} fontSize={24} fontWeight={700}>{big}</text>

      {/* bottom (smaller) bar */}
      <rect x={x0} y={botY} width={small * scale} height={barH} rx={8} fill="#CFE0F0" />
      <text x={x0 + small * scale + 12} y={botY + barH / 2 + 7} fill={INK} fontSize={24} fontWeight={700}>{small}</text>

      {/* the subtraction being performed */}
      {!done ? (
        <text x={W / 2} y={360} fill={ACCENT} fontSize={30} fontWeight={800} textAnchor="middle">
          {big} − {small} = {big - small}
        </text>
      ) : (
        <text x={W / 2} y={360} fill={ACCENT} fontSize={38} fontWeight={800} textAnchor="middle">
          gcd = {g}
        </text>
      )}

      <text x={W / 2} y={418} fill={MUTE} fontSize={20} textAnchor="middle">
        {done ? `${nSub} subtractions` : `subtraction ${idx + 1} of ${nSub}`}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Gauss — least squares: points, a line, the squared misses, the fit.
// ---------------------------------------------------------------------------

/** A fixed, tidy illustrative dataset and its exact least-squares fit. */
const LSQ_PTS: Array<[number, number]> = [[1, 1.6], [2, 2.1], [3, 3.4], [4, 3.7], [5, 5.2], [6, 5.6]];
function lsqFit(pts: Array<[number, number]>) {
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0);
  const xb = sx / n, yb = sy / n;
  const sxx = pts.reduce((a, p) => a + (p[0] - xb) ** 2, 0);
  const sxy = pts.reduce((a, p) => a + (p[0] - xb) * (p[1] - yb), 0);
  const b = sxy / sxx;
  const a = yb - b * xb;
  return { a, b };
}

export function LeastSquaresFit({ progress }: { progress: number }) {
  const p = clamp01(progress);
  // Phases: 0.00–0.30 points appear; 0.30–0.55 a wrong line + residual segments;
  //         0.55–0.80 the residuals become squares; 0.80–1.00 the line settles onto the fit.
  const fit = lsqFit(LSQ_PTS);
  const wrong = { a: 0.2, b: 1.25 };            // a deliberately-off candidate line

  const padL = 64, padB = 70, padT = 40, padR = 30;
  const iw = W - padL - padR, ih = H - padT - padB;
  const xMin = 0, xMax = 7, yMin = 0, yMax = 7;
  const sx = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * iw;
  const sy = (y: number) => padT + ih - ((y - yMin) / (yMax - yMin)) * ih;

  const lineT = clamp01((p - 0.80) / 0.20);
  const a = lerp(wrong.a, fit.a, easeOut(lineT));
  const b = lerp(wrong.b, fit.b, easeOut(lineT));
  const lineOn = p >= 0.30;
  const residOn = p >= 0.30;
  const squaresT = clamp01((p - 0.55) / 0.25);

  const yAt = (x: number) => a + b * x;
  const ptsShown = Math.round(clamp01(p / 0.30) * LSQ_PTS.length);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <text x={W / 2} y={30} fill={INK} fontSize={24} fontWeight={800} textAnchor="middle">
        {p < 0.55 ? 'score every miss' : p < 0.80 ? 'square the misses' : 'one line, smallest total'}
      </text>

      {/* axes */}
      <path d={`M${sx(xMin)} ${sy(0)}H${sx(xMax)}`} stroke={INK} strokeWidth={2} fill="none" />
      <path d={`M${sx(0)} ${sy(yMin)}V${sy(yMax)}`} stroke={INK} strokeWidth={2} fill="none" />

      {/* candidate line */}
      {lineOn && (
        <path d={`M${sx(xMin)} ${sy(yAt(xMin))}L${sx(xMax)} ${sy(yAt(xMax))}`}
              stroke={ACCENT} strokeWidth={5} strokeLinecap="round" fill="none" />
      )}

      {/* residual squares (side = |residual|, drawn to the right of each point) */}
      {residOn && squaresT > 0 && LSQ_PTS.slice(0, ptsShown).map(([x, y], i) => {
        const r = y - yAt(x);
        const side = Math.abs(sy(y) - sy(yAt(x)));
        const s = side * squaresT;
        const px = sx(x), py = sy(y), ly = sy(yAt(x));
        return (
          <g key={`sq${i}`}>
            <line x1={px} y1={py} x2={px} y2={ly} stroke={ACCENT} strokeWidth={2} opacity={0.7} />
            <rect x={px} y={Math.min(py, ly)} width={s} height={side}
                  fill={FILL} stroke={ACCENT} strokeWidth={1.5} opacity={0.9} />
            <text x={px - 8} y={(py + ly) / 2 + 5} fill={MUTE} fontSize={14} textAnchor="end">
              {r >= 0 ? '+' : ''}{r.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* data points */}
      {LSQ_PTS.slice(0, ptsShown).map(([x, y], i) => (
        <circle key={`pt${i}`} cx={sx(x)} cy={sy(y)} r={7} fill={INK} />
      ))}

      {p >= 0.80 && lineT > 0.6 && (
        <text x={W / 2} y={H - 24} fill={ACCENT} fontSize={22} fontWeight={800} textAnchor="middle">
          minimum total squared error
        </text>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Hilbert — sines alone miss the flat function; the constant closes the gap.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
function polyline(fn: (x: number) => number, x0: number, x1: number,
                  sx: (x: number) => number, sy: (y: number) => number, n = 240) {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    d += `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(fn(x)).toFixed(1)}`;
  }
  return d;
}

export function FourierBuild({ progress }: { progress: number }) {
  const p = clamp01(progress);
  const padL = 40, padR = 30, padT = 56, padB = 46;
  const iw = W - padL - padR, ih = H - padT - padB;
  const xMin = -Math.PI, xMax = Math.PI, yMin = -1.6, yMax = 1.6;
  const sx = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * iw;
  const sy = (y: number) => padT + ih - ((y - yMin) / (yMax - yMin)) * ih;

  // Phases: 0.00–0.37 three perpendicular sine waves;
  //         0.37–0.68 target the flat function f=1, sine reconstruction stays flat at 0 (fails);
  //         0.68–1.00 add the constant, reconstruction jumps to 1 (matches).
  const phase = p < 0.37 ? 'sines' : p < 0.68 ? 'fail' : 'fix';

  const sineColors = ['#1E76C3', '#2E9E8F', '#E0A43B'];
  const sineT = clamp01(p / 0.37);
  const constT = easeOut(clamp01((p - 0.68) / 0.32));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <text x={W / 2} y={32} fill={INK} fontSize={23} fontWeight={800} textAnchor="middle">
        {phase === 'sines' ? 'perpendicular sine waves'
          : phase === 'fail' ? 'sines miss the flat function'
          : 'add the constant — now it fits'}
      </text>

      <path d={`M${sx(xMin)} ${sy(0)}H${sx(xMax)}`} stroke={GRID} strokeWidth={1.5} fill="none" />

      {phase === 'sines' && [1, 2, 3].map((k, i) => (
        <path key={k}
          d={polyline((x) => Math.sin(k * x), xMin, xMax, sx, sy)}
          stroke={sineColors[i]} strokeWidth={4} fill="none" strokeLinecap="round"
          opacity={clamp01(sineT * 3 - i)} />
      ))}

      {phase !== 'sines' && (
        <>
          {/* target: the flat function f = 1 */}
          <path d={`M${sx(xMin)} ${sy(1)}H${sx(xMax)}`} stroke={INK} strokeWidth={4}
                strokeDasharray="2 8" strokeLinecap="round" fill="none" />
          <text x={sx(xMax) - 6} y={sy(1) - 10} fill={INK} fontSize={18} textAnchor="end">f = 1</text>

          {/* reconstruction: sines give 0; adding the constant raises it to 1 */}
          <path d={`M${sx(xMin)} ${sy(constT)}H${sx(xMax)}`}
                stroke={ACCENT} strokeWidth={5} strokeLinecap="round" fill="none" />
          <text x={sx(xMin) + 6} y={sy(constT) + (constT > 0.5 ? -12 : 26)} fill={ACCENT}
                fontSize={18} fontWeight={700}>
            {phase === 'fail' ? 'sine sum = 0' : 'constant + cosines'}
          </text>
        </>
      )}

      <text x={W / 2} y={H - 14} fill={MUTE} fontSize={18} textAnchor="middle">
        {phase === 'sines' ? '⟨eₘ, eₙ⟩ = 0 for m ≠ n'
          : phase === 'fail' ? 'every sine coordinate of 1 is zero'
          : 'a complete basis reaches every function'}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Nash — a 2x2 game, its best responses, and the cell where both point.
// ---------------------------------------------------------------------------

const AMBER = '#E0A43B';

/** The story's own prisoner's dilemma, in YEARS SERVED — the numbers the narration says. */
const PD_YEARS: Array<Array<[number, number]>> = [
  [[1, 1], [3, 0]],   // row Silent : col Silent | col Talk
  [[0, 3], [2, 2]],   // row Talk   : col Silent | col Talk
];
const PD_LABELS = ['Silent', 'Talk'];

/** Fewest years is best, so a best response is an argmin — computed, never hard-coded. */
function pdBestRows(): boolean[][] {
  return [0, 1].map((i) => [0, 1].map((j) => {
    const mine = PD_YEARS[i][j][0];
    return mine === Math.min(PD_YEARS[0][j][0], PD_YEARS[1][j][0]);
  }));
}
function pdBestCols(): boolean[][] {
  return [0, 1].map((i) => [0, 1].map((j) => {
    const mine = PD_YEARS[i][j][1];
    return mine === Math.min(PD_YEARS[i][0][1], PD_YEARS[i][1][1]);
  }));
}

export function NashMatrix({ progress }: { progress: number }) {
  const p = clamp01(progress);
  // Phases: 0.00–0.28 the grid fills; 0.28–0.52 the row player's best replies;
  //         0.52–0.76 the column player's; 0.76–1.00 the cell both point at.
  const cellsIn = Math.round(clamp01(p / 0.28) * 4);
  const rowMarks = clamp01((p - 0.28) / 0.24);
  const colMarks = clamp01((p - 0.52) / 0.24);
  const lockT = easeOut(clamp01((p - 0.76) / 0.24));

  const best = { row: pdBestRows(), col: pdBestCols() };
  const cw = 168, ch = 112, x0 = 152, y0 = 148;

  const caption = p < 0.28 ? 'years served — you, them'
    : p < 0.52 ? 'your best reply to each of their moves'
    : p < 0.76 ? 'their best reply to each of yours'
    : 'both point at the same cell';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <text x={W / 2} y={40} fill={INK} fontSize={26} fontWeight={800} textAnchor="middle">
        two prisoners, separate rooms
      </text>
      <text x={W / 2} y={72} fill={MUTE} fontSize={19} textAnchor="middle">{caption}</text>

      {/* column headers */}
      {PD_LABELS.map((lab, j) => (
        <text key={`ch${j}`} x={x0 + cw * j + cw / 2} y={y0 - 16} fill={MUTE}
              fontSize={19} fontWeight={700} textAnchor="middle">{lab}</text>
      ))}
      {/* row headers */}
      {PD_LABELS.map((lab, i) => (
        <text key={`rh${i}`} x={x0 - 14} y={y0 + ch * i + ch / 2 + 7} fill={MUTE}
              fontSize={19} fontWeight={700} textAnchor="end">{lab}</text>
      ))}

      {[0, 1].map((i) => [0, 1].map((j) => {
        const idx = i * 2 + j;
        if (idx >= cellsIn) return null;
        const cx = x0 + cw * j, cy = y0 + ch * i;
        const isEq = best.row[i][j] && best.col[i][j];
        const lit = isEq && lockT > 0;
        const [mine, theirs] = PD_YEARS[i][j];
        return (
          <g key={`c${idx}`}>
            <rect x={cx} y={cy} width={cw} height={ch} rx={10}
                  fill={lit ? FILL : '#FFFFFF'} stroke={lit ? ACCENT : GRID}
                  strokeWidth={lit ? 3 + 2 * lockT : 2} />
            <text x={cx + cw / 2 - 30} y={cy + ch / 2 + 12} fill={ACCENT}
                  fontSize={34} fontWeight={800} textAnchor="middle">{mine}</text>
            <text x={cx + cw / 2} y={cy + ch / 2 + 10} fill={lit ? MUTE : GRID}
                  fontSize={28} fontWeight={700} textAnchor="middle">/</text>
            <text x={cx + cw / 2 + 30} y={cy + ch / 2 + 12} fill={AMBER}
                  fontSize={34} fontWeight={800} textAnchor="middle">{theirs}</text>
            {/* a best reply is marked under the number it belongs to */}
            {best.row[i][j] && rowMarks > 0 && (
              <rect x={cx + cw / 2 - 48} y={cy + ch / 2 + 22} width={36 * rowMarks} height={5}
                    rx={2.5} fill={ACCENT} />
            )}
            {best.col[i][j] && colMarks > 0 && (
              <rect x={cx + cw / 2 + 12} y={cy + ch / 2 + 22} width={36 * colMarks} height={5}
                    rx={2.5} fill={AMBER} />
            )}
          </g>
        );
      }))}

      {lockT > 0.4 && (
        <>
          <text x={W / 2} y={H - 46} fill={ACCENT} fontSize={23} fontWeight={800} textAnchor="middle">
            nobody gains by moving alone
          </text>
          <text x={W / 2} y={H - 18} fill={MUTE} fontSize={19} textAnchor="middle">
            and 1 / 1 was better for both
          </text>
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Nash — a game with no stable cell, and the mix that answers it.
// ---------------------------------------------------------------------------

/** Scoring probability for the kicker, exactly the matrix the SymPy check settles. */
const KICK = [[1 / 5, 9 / 10], [4 / 5, 1 / 5]];   // rows: kick Left/Right; cols: dive Left/Right

/** Keeper dives Left / dives Right, as functions of p = the kicker's weight on Left. */
const diveLeft = (t: number) => t * KICK[0][0] + (1 - t) * KICK[1][0];
const diveRight = (t: number) => t * KICK[0][1] + (1 - t) * KICK[1][1];

export function NashMixing({ progress }: { progress: number }) {
  const pr = clamp01(progress);
  // Phases: 0.00–0.38 the four cells and the chase that never settles;
  //         0.38–1.00 the kicker's guarantee as a function of the mix, and its peak.
  const chase = pr < 0.38;
  const t = clamp01((pr - 0.38) / 0.62);

  const padL = 62, padR = 34, padT = 96, padB = 64;
  const iw = W - padL - padR, ih = H - padT - padB;
  const sx = (x: number) => padL + x * iw;
  const sy = (y: number) => padT + ih - y * ih;

  // The crossing: 6/13 on the story's numbers, found here rather than written in.
  const pStar = (KICK[1][1] - KICK[1][0])
    / ((KICK[0][0] - KICK[1][0]) - (KICK[0][1] - KICK[1][1]));
  const vStar = diveLeft(pStar);

  const draw = easeOut(clamp01(t / 0.55));
  const markT = easeOut(clamp01((t - 0.55) / 0.45));

  if (chase) {
    const cw = 176, chh = 104, x0 = 128, y0 = 150;
    const step = Math.min(3, Math.floor(clamp01(pr / 0.38) * 4));
    const cycle: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const [ci, cj] = cycle[step];
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        <text x={W / 2} y={44} fill={INK} fontSize={26} fontWeight={800} textAnchor="middle">
          a penalty kick
        </text>
        <text x={W / 2} y={76} fill={MUTE} fontSize={19} textAnchor="middle">
          example odds of scoring — higher when the two guess apart
        </text>
        {['dive L', 'dive R'].map((lab, j) => (
          <text key={j} x={x0 + cw * j + cw / 2} y={y0 - 14} fill={MUTE} fontSize={18}
                fontWeight={700} textAnchor="middle">{lab}</text>
        ))}
        {['kick L', 'kick R'].map((lab, i) => (
          <text key={i} x={x0 - 12} y={y0 + chh * i + chh / 2 + 6} fill={MUTE} fontSize={18}
                fontWeight={700} textAnchor="end">{lab}</text>
        ))}
        {[0, 1].map((i) => [0, 1].map((j) => {
          const here = i === ci && j === cj;
          return (
            <g key={`k${i}${j}`}>
              <rect x={x0 + cw * j} y={y0 + chh * i} width={cw} height={chh} rx={10}
                    fill={here ? FILL : '#FFFFFF'} stroke={here ? ACCENT : GRID}
                    strokeWidth={here ? 4 : 2} />
              <text x={x0 + cw * j + cw / 2} y={y0 + chh * i + chh / 2 + 12} fill={INK}
                    fontSize={31} fontWeight={800} textAnchor="middle">
                {Math.round(KICK[i][j] * 100)}%
              </text>
            </g>
          );
        }))}
        <text x={W / 2} y={H - 46} fill={ACCENT} fontSize={23} fontWeight={800} textAnchor="middle">
          whoever moves last wins
        </text>
        <text x={W / 2} y={H - 18} fill={MUTE} fontSize={19} textAnchor="middle">
          so no single pair of moves is stable
        </text>
      </svg>
    );
  }

  const line = (fn: (x: number) => number, upto: number) =>
    `M${sx(0).toFixed(1)} ${sy(fn(0)).toFixed(1)}L${sx(upto).toFixed(1)} ${sy(fn(upto)).toFixed(1)}`;

  // The kicker only ever gets the lower of the two — the keeper picks. Its peak is the crossing.
  const envelope = () => {
    const pts: string[] = [];
    for (let i = 0; i <= 80; i++) {
      const x = (i / 80) * draw;
      pts.push(`${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(Math.min(diveLeft(x), diveRight(x))).toFixed(1)}`);
    }
    return pts.join('');
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <text x={W / 2} y={40} fill={INK} fontSize={26} fontWeight={800} textAnchor="middle">
        so mix — and pick the odds
      </text>
      <text x={W / 2} y={70} fill={MUTE} fontSize={19} textAnchor="middle">
        example odds — what the keeper leaves you
      </text>

      <path d={`M${sx(0)} ${sy(0)}H${sx(1)}`} stroke={INK} strokeWidth={2} fill="none" />
      <path d={`M${sx(0)} ${sy(0)}V${sy(1)}`} stroke={INK} strokeWidth={2} fill="none" />

      <path d={line(diveLeft, draw)} stroke={GRID} strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d={line(diveRight, draw)} stroke={GRID} strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d={envelope()} stroke={ACCENT} strokeWidth={6} fill="none" strokeLinecap="round" />

      {draw > 0.9 && (
        <>
          <text x={sx(0.06)} y={sy(diveLeft(0.06)) - 14} fill={MUTE} fontSize={17}>keeper dives left</text>
          <text x={sx(0.94)} y={sy(diveRight(0.94)) - 14} fill={MUTE} fontSize={17} textAnchor="end">
            keeper dives right
          </text>
        </>
      )}

      {markT > 0 && (
        <g opacity={markT}>
          <path d={`M${sx(pStar)} ${sy(0)}V${sy(vStar)}`} stroke={AMBER} strokeWidth={3}
                strokeDasharray="6 6" fill="none" />
          <circle cx={sx(pStar)} cy={sy(vStar)} r={9} fill={AMBER} />
          <text x={sx(pStar)} y={sy(vStar) - 20} fill={AMBER} fontSize={24} fontWeight={800}
                textAnchor="middle">6/13</text>
        </g>
      )}

      <text x={sx(0.08)} y={H - 42} fill={MUTE} fontSize={17} textAnchor="middle">always right</text>
      <text x={sx(0.92)} y={H - 42} fill={MUTE} fontSize={17} textAnchor="middle">always left</text>
      {markT > 0.5 && (
        <text x={W / 2} y={H - 8} fill={ACCENT} fontSize={21} fontWeight={800} textAnchor="middle">
          one mix beats every other — and it always exists
        </text>
      )}
    </svg>
  );
}
