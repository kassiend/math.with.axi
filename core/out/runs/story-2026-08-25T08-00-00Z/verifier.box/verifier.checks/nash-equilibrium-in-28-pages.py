"""
Verifier check — written against the payload's stated instances, not against the other script.

Different method on purpose. Where a support enumeration guesses which actions are played and
then solves indifference equations, this script builds each player's BEST-RESPONSE
CORRESPONDENCE as an explicit piecewise object and intersects the two graphs:

  D_row(q) = U_row(1, q) - U_row(0, q)   is affine in q.
      D_row > 0  ->  best response p = 1
      D_row < 0  ->  best response p = 0
      D_row = 0  ->  every p in [0, 1] is a best response
  D_col(p) = U_col(p, 1) - U_col(p, 0)   is affine in p, symmetrically.

The intersection of the two graphs IS the equilibrium set. Its candidates are the four corners,
the two "one player pure, the other indifferent" edges, and the single interior point where both
indifference lines meet. Every candidate is then re-tested from the bare definition, against a
FULLY MIXED deviation r in [0, 1] rather than only the two pure ones, so nothing rests on the
claim that a pure best response always exists.

A second, wholly numeric pass repeats the search by brute force over a fine grid, as a guard
against a symbolic slip: the exact answer must be the grid's argmin of regret.

Instances, exactly as the payload states them:
    Game A (prisoner's dilemma, payoff = minus years):
        row (Silent, Talk) x column (Silent, Talk)
        A_row = [[-1, -3], [0, -2]],  A_col = [[-1, 0], [-3, -2]]
    Game B (zero-sum penalty kick, row payoff = probability of scoring):
        row kicker (Left, Right) x column keeper (Left, Right)
        B_row = [[1/5, 9/10], [4/5, 1/5]],  B_col = -B_row

Reported value: str(Tuple(u_row, u_col, p*, q*, v*)) — Game A's equilibrium payoff pair, then
Game B's kicker mix on Left, keeper mix on Left, and the kicker's equilibrium value.
"""
import json
import sys

import sympy as sp

CLAIM = "nash-equilibrium-in-28-pages"
p, q, r = sp.symbols("p q r", real=True)


def U(mat, pp, qq):
    """Expected payoff under row mix (pp, 1-pp) and column mix (qq, 1-qq)."""
    return (pp * qq * mat[0][0] + pp * (1 - qq) * mat[0][1]
            + (1 - pp) * qq * mat[1][0] + (1 - pp) * (1 - qq) * mat[1][1])


def indifference_point(diff, var):
    """The unique root of an affine expression in `var`, if it lies in [0, 1]."""
    poly = sp.Poly(sp.expand(diff), var)
    if poly.degree() != 1:
        return None
    root = sp.nsimplify(sp.solve(sp.Eq(diff, 0), var)[0])
    return root if 0 <= root <= 1 else None


def is_equilibrium(a_row, a_col, pv, qv):
    """The definition itself: no mixed deviation by either player pays strictly more."""
    gain_row = sp.simplify(U(a_row, r, qv) - U(a_row, pv, qv))
    gain_col = sp.simplify(U(a_col, pv, r) - U(a_col, pv, qv))
    for gain in (gain_row, gain_col):
        best = sp.maximum(gain, r, sp.Interval(0, 1))
        if sp.simplify(best) > 0:
            return False
    return True


def solve_game(a_row, a_col):
    """Every equilibrium, found by intersecting the two best-response graphs."""
    d_row = sp.expand(U(a_row, 1, q) - U(a_row, 0, q))     # sign decides the row player's p
    d_col = sp.expand(U(a_col, p, 1) - U(a_col, p, 0))     # sign decides the column player's q

    q_hat = indifference_point(d_row, q)   # the q at which the row player stops caring
    p_hat = indifference_point(d_col, p)   # the p at which the column player stops caring

    candidates = [(sp.Integer(a), sp.Integer(b)) for a in (0, 1) for b in (0, 1)]
    if q_hat is not None:
        candidates += [(sp.Integer(a), q_hat) for a in (0, 1)]
    if p_hat is not None:
        candidates += [(p_hat, sp.Integer(b)) for b in (0, 1)]
    if p_hat is not None and q_hat is not None:
        candidates.append((p_hat, q_hat))

    out = []
    for pv, qv in candidates:
        if (pv, qv) in out:
            continue
        if is_equilibrium(a_row, a_col, pv, qv):
            out.append((pv, qv))
    return sorted(out, key=lambda t: (float(t[0]), float(t[1]))), p_hat, q_hat


def grid_check(a_row, a_col, steps=260):
    """Numeric guard: the point of least total regret on a fine grid."""
    fr = [[float(x) for x in row] for row in a_row]
    fc = [[float(x) for x in row] for row in a_col]

    def u(mat, pp, qq):
        return (pp * qq * mat[0][0] + pp * (1 - qq) * mat[0][1]
                + (1 - pp) * qq * mat[1][0] + (1 - pp) * (1 - qq) * mat[1][1])

    best, arg = None, None
    for i in range(steps + 1):
        pp = i / steps
        for j in range(steps + 1):
            qq = j / steps
            regret = (max(u(fr, 1, qq), u(fr, 0, qq)) - u(fr, pp, qq)
                      + max(u(fc, pp, 1), u(fc, pp, 0)) - u(fc, pp, qq))
            if best is None or regret < best:
                best, arg = regret, (pp, qq)
    return arg, best


def note(*a):
    print(*a, file=sys.stderr)


# ---------------------------------------------------------------- Game A
A_ROW = sp.Matrix([[-1, -3], [0, -2]]).tolist()
A_COL = sp.Matrix([[-1, 0], [-3, -2]]).tolist()

eq_a, p_hat_a, q_hat_a = solve_game(A_ROW, A_COL)
note("Game A: indifference points (p_hat, q_hat) =", (p_hat_a, q_hat_a), "-> none expected")
note("Game A equilibria (p on Silent, q on Silent):", eq_a)
assert eq_a == [(0, 0)], f"expected the unique equilibrium (Talk, Talk), got {eq_a}"

u_row = sp.simplify(U(A_ROW, *eq_a[0]))
u_col = sp.simplify(U(A_COL, *eq_a[0]))
assert (u_row, u_col) == (-2, -2)

# The equilibrium is stable and jointly worse: mutual silence pays each of them strictly more.
assert A_ROW[0][0] > u_row and A_COL[0][0] > u_col
# Nothing else in the game is even a candidate for beating it in the stability sense: Talk gives
# a strictly higher payoff than Silent against BOTH of the opponent's pure actions.
for j in (0, 1):
    assert A_ROW[1][j] > A_ROW[0][j]
for i in (0, 1):
    assert A_COL[i][1] > A_COL[i][0]
note(f"Game A: equilibrium payoffs {(u_row, u_col)} vs mutual silence {(A_ROW[0][0], A_COL[0][0])}")

arg_a, regret_a = grid_check(A_ROW, A_COL)
assert regret_a < 1e-9 and abs(arg_a[0]) < 1e-9 and abs(arg_a[1]) < 1e-9, (arg_a, regret_a)

# ---------------------------------------------------------------- Game B
B_ROW = [[sp.Rational(1, 5), sp.Rational(9, 10)], [sp.Rational(4, 5), sp.Rational(1, 5)]]
B_COL = [[-B_ROW[0][0], -B_ROW[0][1]], [-B_ROW[1][0], -B_ROW[1][1]]]

# Pure profiles first: each of the four is broken by a unilateral switch.
broken = 0
for i in (0, 1):
    for j in (0, 1):
        pv, qv = sp.Integer(1 - i), sp.Integer(1 - j)   # p is weight on row 0
        if not is_equilibrium(B_ROW, B_COL, pv, qv):
            broken += 1
assert broken == 4, "every pure profile in the penalty-kick game should fail the definition"
note("Game B: all four pure profiles fail the definition")

eq_b, p_hat_b, q_hat_b = solve_game(B_ROW, B_COL)
note("Game B: indifference points (p_hat, q_hat) =", (p_hat_b, q_hat_b))
note("Game B equilibria (p on Left, q on Left):", eq_b)
assert len(eq_b) == 1, f"expected exactly one equilibrium, got {eq_b}"
p_star, q_star = eq_b[0]
assert sp.Integer(0) < p_star < sp.Integer(1) and sp.Integer(0) < q_star < sp.Integer(1)

v_star = sp.simplify(U(B_ROW, p_star, q_star))
# The kicker is indifferent between Left and Right against the keeper's mix, and the keeper
# between Left and Right against the kicker's — that is what "mixed equilibrium" means here.
assert sp.simplify(U(B_ROW, 1, q_star) - v_star) == 0
assert sp.simplify(U(B_ROW, 0, q_star) - v_star) == 0
assert sp.simplify(U(B_COL, p_star, 1) - U(B_COL, p_star, 0)) == 0
note(f"Game B: p*={p_star}, q*={q_star}, v*={v_star}")

arg_b, regret_b = grid_check(B_ROW, B_COL)
assert abs(arg_b[0] - float(p_star)) < 0.01 and abs(arg_b[1] - float(q_star)) < 0.01, arg_b
note(f"Game B: grid argmin {arg_b} agrees with ({float(p_star):.4f}, {float(q_star):.4f})")

computed = str(sp.Tuple(u_row, u_col, p_star, q_star, v_star))
print(json.dumps({"claim_id": CLAIM, "computed": computed, "agrees": True}))
