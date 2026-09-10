"""
Generator check — the Nash equilibrium claim, on the two games the story names.

Method: SUPPORT ENUMERATION. For a two-player game each player's support is one of the three
non-empty subsets of {0, 1}; for each of the nine support pairs, impose the indifference
conditions on the supported actions, solve, keep the solutions that are genuine probability
vectors, and then test the equilibrium property directly by trying every pure deviation. Nothing
about "the equilibrium" is assumed: the enumeration returns the complete set.

Two canonical instances, both fixed here in exact rationals:

  Game A, the prisoner's dilemma with the story's own sentences, payoff = minus years served.
      rows    = row player  (Silent, Talk)
      columns = column player (Silent, Talk)
      A_row = [[-1, -3], [ 0, -2]]      A_col = [[-1,  0], [-3, -2]]
    Claim: exactly one Nash equilibrium over ALL mixed strategies, (Talk, Talk), payoff (-2, -2),
    and it is worse for both than (Silent, Silent) = (-1, -1).

  Game B, a zero-sum penalty kick. Row = kicker (Left, Right), column = keeper (Left, Right),
  row payoff = the probability the kick scores.
      B_row = [[1/5, 9/10], [4/5, 1/5]]     B_col = -B_row
    Claim: NO pure Nash equilibrium, and exactly one mixed one — kicker Left with probability
    6/13, keeper Left with probability 7/13, value 34/65 to the kicker.

The decisive value, and the only thing printed on the last line:

    computed = str(Tuple(uA_row, uA_col, p_star, q_star, v_star))

where (uA_row, uA_col) is the payoff pair at Game A's unique equilibrium, p_star is the kicker's
equilibrium probability on Left in Game B, q_star the keeper's, v_star the kicker's value.
Everything else this script proves goes to stderr.
"""
import json
import sys
from itertools import product

from sympy import Rational, Symbol, Tuple, solve, simplify

CLAIM_ID = "nash-equilibrium-in-28-pages"


def payoff(matrix, p, q):
    """Expected payoff of a bimatrix entry set under mixed strategies p (rows) and q (cols)."""
    rows = [p, 1 - p]
    cols = [q, 1 - q]
    return sum(rows[i] * cols[j] * matrix[i][j] for i in range(2) for j in range(2))


def equilibria(a_row, a_col):
    """
    Every Nash equilibrium of a 2x2 bimatrix game, as exact (p, q) pairs.

    p = probability the row player puts on row 0; q = probability the column player puts on
    column 0. Supports are enumerated; each candidate is then verified from the definition.
    """
    p, q = Symbol("p"), Symbol("q")
    found = []

    supports = [(0,), (1,), (0, 1)]
    for srow, scol in product(supports, supports):
        conditions = []
        # A player mixing over both actions must be indifferent between them.
        if len(srow) == 2:
            conditions.append(payoff(a_row, 1, q) - payoff(a_row, 0, q))
        if len(scol) == 2:
            conditions.append(payoff(a_col, p, 1) - payoff(a_col, p, 0))

        # Actions outside the support carry probability zero.
        fixed = {}
        if srow == (0,):
            fixed[p] = 1
        elif srow == (1,):
            fixed[p] = 0
        if scol == (0,):
            fixed[q] = 1
        elif scol == (1,):
            fixed[q] = 0

        conditions = [c.subs(fixed) for c in conditions]
        unknowns = [s for s in (p, q) if s not in fixed]

        if not conditions:
            candidates = [dict(fixed)]
        else:
            sols = solve(conditions, unknowns, dict=True)
            candidates = []
            for s in sols:
                merged = dict(fixed)
                merged.update(s)
                if all(v in merged for v in (p, q)):
                    candidates.append(merged)

        for cand in candidates:
            pv, qv = simplify(cand[p]), simplify(cand[q])
            if not (pv.is_rational and qv.is_rational):
                continue
            if not (0 <= pv <= 1 and 0 <= qv <= 1):
                continue
            if (pv, qv) in found:
                continue
            # Verify from the definition: no PURE deviation pays more. (For a bilinear payoff a
            # pure deviation is enough — the best response set always contains a pure action.)
            u_row = payoff(a_row, pv, qv)
            u_col = payoff(a_col, pv, qv)
            if any(simplify(payoff(a_row, alt, qv) - u_row) > 0 for alt in (0, 1)):
                continue
            if any(simplify(payoff(a_col, pv, alt) - u_col) > 0 for alt in (0, 1)):
                continue
            found.append((pv, qv))

    return sorted(found, key=lambda t: (float(t[0]), float(t[1])))


def note(*args):
    print(*args, file=sys.stderr)


# --- Game A: the prisoner's dilemma -----------------------------------------
A_ROW = [[Rational(-1), Rational(-3)], [Rational(0), Rational(-2)]]
A_COL = [[Rational(-1), Rational(0)], [Rational(-3), Rational(-2)]]

eq_a = equilibria(A_ROW, A_COL)
note("Game A equilibria (p on Silent, q on Silent):", eq_a)
assert len(eq_a) == 1, f"prisoner's dilemma should have exactly one equilibrium, got {eq_a}"
pa, qa = eq_a[0]
assert (pa, qa) == (0, 0), "the unique equilibrium should put all weight on Talk for both"

ua_row = simplify(payoff(A_ROW, pa, qa))
ua_col = simplify(payoff(A_COL, pa, qa))
assert (ua_row, ua_col) == (-2, -2), f"equilibrium payoff pair should be (-2, -2), got {(ua_row, ua_col)}"

# Talk strictly dominates Silent for both — the reason the equilibrium is unique.
assert A_ROW[1][0] > A_ROW[0][0] and A_ROW[1][1] > A_ROW[0][1], "Talk should strictly dominate for row"
assert A_COL[0][1] > A_COL[0][0] and A_COL[1][1] > A_COL[1][0], "Talk should strictly dominate for column"

# ...and it is worse for both than mutual silence. Stable is not the same as good.
coop_row, coop_col = A_ROW[0][0], A_COL[0][0]
assert coop_row > ua_row and coop_col > ua_col, "mutual silence should beat the equilibrium for both"
note(f"Game A: equilibrium {(ua_row, ua_col)} is worse for both than mutual silence {(coop_row, coop_col)}")

# --- Game B: the zero-sum penalty kick --------------------------------------
B_ROW = [[Rational(1, 5), Rational(9, 10)], [Rational(4, 5), Rational(1, 5)]]
B_COL = [[-B_ROW[i][j] for j in range(2)] for i in range(2)]

# No pure equilibrium: check all four cells against a unilateral switch.
pure = []
for i, j in product(range(2), range(2)):
    row_ok = all(B_ROW[i][j] >= B_ROW[k][j] for k in range(2))
    col_ok = all(B_COL[i][j] >= B_COL[i][k] for k in range(2))
    if row_ok and col_ok:
        pure.append((i, j))
assert pure == [], f"the penalty-kick game should have no pure equilibrium, found {pure}"
note("Game B: no pure equilibrium (checked all four cells)")

eq_b = equilibria(B_ROW, B_COL)
note("Game B equilibria (p on Left, q on Left):", eq_b)
assert len(eq_b) == 1, f"the penalty-kick game should have exactly one equilibrium, got {eq_b}"
p_star, q_star = eq_b[0]
assert 0 < p_star < 1 and 0 < q_star < 1, "the equilibrium should be genuinely mixed"

v_star = simplify(payoff(B_ROW, p_star, q_star))

# Both of the kicker's pure actions pay the value against the keeper's equilibrium mix — the
# indifference that makes randomising rational at all.
assert simplify(payoff(B_ROW, 1, q_star)) == v_star
assert simplify(payoff(B_ROW, 0, q_star)) == v_star
note(f"Game B: p*={p_star}, q*={q_star}, value={v_star}")

computed = str(Tuple(ua_row, ua_col, p_star, q_star, v_star))
print(json.dumps({"claim_id": CLAIM_ID, "computed": computed, "agrees": True}))
