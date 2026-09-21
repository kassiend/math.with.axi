"""
Least-squares check, revision 2 (story: Gauss vs Legendre, the priority dispute).

Displayed formula:
    min over a, b of  sum_i (y_i - a - b*x_i)**2,
    unique iff  sum_i (x_i - xbar)**2 > 0.

Revision 1 of this file named its first test "trace_positive" while actually
testing the top-left ENTRY, and the prose built on that name claimed the
Hessian's trace is 2n. It is not: the trace is 2n + 2*sum x_i**2. Test 2 below
now pins the trace explicitly, and test 3 pins the leading principal minors
separately, so the two quantities can never be conflated again.

Claims tested
  1. H is constant and equals [[2n, 2*Sx], [2*Sx, 2*Sxx]].
  2. trace H = 2n + 2*Sxx, and trace H = 2n only when every x_i = 0.
  3. leading principal minors: M1 = 2n > 0 always; M2 = det H = 4n*sum (x_i - xbar)**2,
     which is > 0 exactly when the x values are not all identical.
  4. M1 > 0 and M2 > 0 force both eigenvalues of a symmetric 2x2 to be positive,
     so H is positive definite and S is strictly convex there.
  5. The unique stationary point is b = sum (x_i - xbar)(y_i - ybar) / sum (x_i - xbar)**2,
     a = ybar - b*xbar, and on concrete data nothing beats it.
  6. Degenerate case: all x_i equal => det H = 0 and the minimiser is NOT unique.
  7. The two things squaring is claimed to do, stated in checkable form.
"""
import json
import sympy as sp

a, b = sp.symbols("a b", real=True)
results = {}

# --- 1, 2, 3: the Hessian, its trace, its leading principal minors -------
for n in range(2, 7):
    xs = sp.symbols(f"x0:{n}", real=True)
    ys = sp.symbols(f"y0:{n}", real=True)
    S = sum((ys[i] - a - b * xs[i]) ** 2 for i in range(n))
    H = sp.hessian(S, (a, b))

    Sx = sum(xs)
    Sxx = sum(x**2 for x in xs)
    xbar = Sx / n

    assert sp.expand(H[0, 0] - 2 * n) == 0
    assert sp.expand(H[0, 1] - 2 * Sx) == 0 and sp.expand(H[1, 0] - 2 * Sx) == 0
    assert sp.expand(H[1, 1] - 2 * Sxx) == 0
    # H does not depend on a or b: one bowl shape everywhere
    assert not (set(H.free_symbols) & {a, b})

    # trace: the quantity revision 1 got wrong
    assert sp.expand(H.trace() - (2 * n + 2 * Sxx)) == 0
    # and it is NOT 2n unless every x_i vanishes
    assert sp.expand(H.trace() - 2 * n) == sp.expand(2 * Sxx)

    # leading principal minors
    M1 = H[0, 0]
    M2 = sp.expand(H.det())
    assert sp.expand(M1 - 2 * n) == 0
    assert sp.expand(M2 - 4 * n * sum((x - xbar) ** 2 for x in xs)) == 0
    assert sp.expand(M2 - 4 * (n * Sxx - Sx**2)) == 0

results["hessian_entries_trace_and_minors"] = "ok for n = 2..6"

# trace exceeds 2n on the verifier's witness, and the numbers match exactly
xw, yw = (1, 2, 3), (2, 3, 5)
Sw = sum((yw[i] - a - b * xw[i]) ** 2 for i in range(3))
Hw = sp.hessian(Sw, (a, b))
assert list(Hw) == [6, 12, 12, 28]
assert Hw.trace() == 34 and Hw.trace() != 2 * 3
assert Hw.det() == 24 == 4 * 3 * sp.Rational(2)      # 4n * sum (x-xbar)^2, sum = 2
results["witness_x123"] = "H=[[6,12],[12,28]], trace=34 (not 6), det=24"

# --- 4: two positive leading minors => positive definite (symmetric 2x2) --
p, q, r = sp.symbols("p q r", real=True)
lam_lo = ((p + r) - sp.sqrt((p - r) ** 2 + 4 * q**2)) / 2
lam_hi = ((p + r) + sp.sqrt((p - r) ** 2 + 4 * q**2)) / 2
# eigenvalues really are these
assert sp.simplify(sp.expand(lam_lo + lam_hi - (p + r))) == 0
assert sp.simplify(sp.expand(lam_lo * lam_hi - (p * r - q**2))) == 0
# the sign argument: with p > 0 and det = pr - q^2 > 0, r > 0 too, so the sum of
# eigenvalues is positive and their product is positive => both positive.
assert sp.expand((p + r) ** 2 - ((p - r) ** 2 + 4 * q**2) - 4 * (p * r - q**2)) == 0
# concrete instance of the general Hessian shape
Hc = sp.Matrix([[6, 12], [12, 28]])
assert all(e > 0 for e in Hc.eigenvals())
results["positive_definite_from_minors"] = "sum and product of eigenvalues both positive"

# --- 5: the closed form, and that it is the minimiser --------------------
n = 4
xs = sp.symbols("x0:4", real=True)
ys = sp.symbols("y0:4", real=True)
S = sum((ys[i] - a - b * xs[i]) ** 2 for i in range(n))
sol = sp.solve([sp.diff(S, a), sp.diff(S, b)], [a, b], dict=True)
assert len(sol) == 1
xbar, ybar = sum(xs) / n, sum(ys) / n
b_expected = sum((xs[i] - xbar) * (ys[i] - ybar) for i in range(n)) / sum(
    (x - xbar) ** 2 for x in xs
)
a_expected = ybar - b_expected * xbar
assert sp.simplify(sp.together(sol[0][b] - b_expected)) == 0
assert sp.simplify(sp.together(sol[0][a] - a_expected)) == 0

data = [(0, 1), (1, 3), (2, 2), (3, 6), (4, 7)]
Sc = sum((y - a - b * x) ** 2 for x, y in data)
solc = sp.solve([sp.diff(Sc, a), sp.diff(Sc, b)], [a, b], dict=True)[0]
S_min = sp.nsimplify(Sc.subs(solc))
for da in [sp.Rational(-1, 2), sp.Rational(1, 3), 1, -2]:
    for db in [sp.Rational(-1, 4), sp.Rational(1, 5), 1, -1]:
        assert sp.simplify(Sc.subs({a: solc[a] + da, b: solc[b] + db}) - S_min) > 0
results["closed_form"] = f"b = {solc[b]}, a = {solc[a]}, S_min = {S_min}"

# --- 6: all x equal => no unique answer ----------------------------------
xd, yd = (1, 1, 1), (1, 2, 3)
Sd = sum((yd[i] - a - b * xd[i]) ** 2 for i in range(3))
Hd = sp.hessian(Sd, (a, b))
assert Hd.det() == 0
# every (a, b) on the line a + b = 2 attains the same value, and it is minimal
vals = {sp.simplify(Sd.subs({a: t, b: 2 - t})) for t in [-3, 0, sp.Rational(1, 2), 5]}
assert vals == {2}
assert sp.simplify(Sd.subs({a: 0, b: 0})) > 2
results["degenerate_all_x_equal"] = "det H = 0; whole line a + b = 2 attains S = 2"

# --- 7: what squaring actually buys, stated checkably --------------------
rres = sp.symbols("r", positive=True)
assert sp.expand((2 * rres) ** 2 - 4 * rres**2) == 0          # double a miss, quadruple its cost
E, k = sp.symbols("E k", positive=True)
# a total absolute error E split evenly into k misses costs E**2/k, so at fixed
# total absolute error the cost falls as the misses are spread out
assert sp.simplify(k * (E / k) ** 2 - E**2 / k) == 0
assert sp.simplify((E**2 / 1) - (E**2 / 2)) > 0
# and signs cannot cancel: +3 and -3 contribute 18 squared, 0 unsquared
assert (3) ** 2 + (-3) ** 2 == 18 and 3 + (-3) == 0
results["squaring"] = "(2r)^2 = 4r^2; even split of total error E over k misses costs E^2/k"

# --- canonical instance for the cross-check contract (story.md §6) --------
# Fit the least-squares line to x = (1, 2, 3), y = (2, 3, 5) via THIS script's
# own closed form, and emit (intercept, slope) as a SymPy Rational tuple string
# that the independent verifier must match character-for-character.
cx = [sp.Integer(v) for v in (1, 2, 3)]
cy = [sp.Integer(v) for v in (2, 3, 5)]
cn = len(cx)
cxbar = sum(cx) / cn
cybar = sum(cy) / cn
b_can = sum((cx[i] - cxbar) * (cy[i] - cybar) for i in range(cn)) / sum(
    (cx[i] - cxbar) ** 2 for i in range(cn)
)
a_can = cybar - b_can * cxbar
b_can = sp.nsimplify(b_can)
a_can = sp.nsimplify(a_can)
assert a_can == sp.Rational(1, 3), a_can
assert b_can == sp.Rational(3, 2), b_can
computed = str((a_can, b_can))            # renders "(1/3, 3/2)"
assert computed == "(1/3, 3/2)", computed
results["canonical_x123_y235"] = computed

import sys
# Human-readable detail goes to stderr; the orchestrator reads only the last stdout line.
print(json.dumps({"results": results}, indent=2), file=sys.stderr)
# The one machine-read line: single-line JSON, canonical scalar, last on stdout.
print(json.dumps({"claim_id": "gauss-legendre-least-squares", "computed": computed, "agrees": True}))
