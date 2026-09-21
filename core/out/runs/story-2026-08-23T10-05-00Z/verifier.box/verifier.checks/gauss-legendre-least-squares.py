# Independent verification of claim "gauss-legendre-least-squares".
#
# Re-derived from the REVISED claim text alone.
#
# Card:  min_{a,b} sum_{i=1..n} (y_i - a - b*x_i)^2,  unique iff sum_i (x_i-xbar)^2 > 0
#
# Mechanism assertions under test:
#  (A1) H = [[2n, 2*sum x_i], [2*sum x_i, 2*sum x_i^2]], constant, symmetric
#  (A2) trace H = 2n + 2*sum x_i^2
#  (A3) the quantity equal to 2n is the top-left entry = first leading principal minor
#  (A4) the two leading principal minors are 2n (positive for any data at all)
#       and det H = 4(n*sum x_i^2 - (sum x_i)^2) = 4n*sum (x_i - xbar)^2
#  (A5) det H > 0 exactly when the x values are not all identical  [an iff]
#  (A6) both minors positive => eigenvalues of this symmetric 2x2 have positive
#       sum and positive product => both positive => H positive definite
#  (A7) under that condition the minimiser is where both partials vanish, and
#       b = sum(x-xbar)(y-ybar)/sum(x-xbar)^2, a = ybar - b*xbar
#  (A8) if every x_i is the same, det H = 0, trough not bowl, no unique answer;
#       for x=(1,1,1), y=(1,2,3) every line with a+b=2 scores the same
#  (A9) the card iff, BOTH directions, with the failure direction giving
#       non-uniqueness rather than non-existence
# (A10) +3 and -3 contribute 18, not 0
# (A11) doubling one miss quadruples its contribution
# (A12) at fixed total absolute error E, splitting evenly over k misses costs
#       E^2/k, so many small misses are cheaper than one big one

import json
import random
import sympy as sp

fail = []
notes = []


def check(cond, msg):
    if not cond:
        fail.append(msg)


n, Sx, Sy, Sxx, Sxy, Syy = sp.symbols('n Sx Sy Sxx Sxy Syy', real=True)
a, b = sp.symbols('a b', real=True)

# S in sufficient statistics, validated against explicit index sums below.
S = Syy - 2*a*Sy - 2*b*Sxy + n*a**2 + 2*a*b*Sx + b**2*Sxx


def moments(xs, ys):
    m = len(xs)
    return {n: m, Sx: sum(xs), Sy: sum(ys),
            Sxx: sum(t**2 for t in xs),
            Sxy: sum(xs[i]*ys[i] for i in range(m)),
            Syy: sum(t**2 for t in ys)}


for nn in range(1, 7):
    xs = sp.symbols('x0:%d' % nn, real=True)
    ys = sp.symbols('y0:%d' % nn, real=True)
    explicit = sum((ys[i] - a - b*xs[i])**2 for i in range(nn))
    check(sp.simplify(sp.expand(S.subs(moments(list(xs), list(ys))) - explicit)) == 0,
          "moment expansion of S wrong at n=%d" % nn)

# ---------------------------------------------------------------- A1, A2, A3
H = sp.Matrix([[sp.diff(S, a, 2), sp.diff(S, a, b)],
               [sp.diff(S, b, a), sp.diff(S, b, 2)]])
check(sp.simplify(H - sp.Matrix([[2*n, 2*Sx], [2*Sx, 2*Sxx]])) == sp.zeros(2, 2),
      "A1 Hessian entries disagree")
check(all(sp.diff(e, a) == 0 and sp.diff(e, b) == 0 for e in H),
      "A1 Hessian is not constant in a,b")
check(H.is_symmetric(), "A6 Hessian not symmetric (the eigenvalue argument needs it)")

# H = 2 * A^T A for the design matrix A = [[1, x_i]] -> H is a Gram matrix,
# hence positive SEMIdefinite for every dataset.  This is what makes
# "det nonzero" equivalent to "positive definite" later on.
for nn in range(1, 6):
    xs = sp.symbols('x0:%d' % nn, real=True)
    A = sp.Matrix([[1, xs[i]] for i in range(nn)])
    check(sp.simplify(H.subs({n: nn, Sx: sum(xs), Sxx: sum(t**2 for t in xs)})
                      - 2*(A.T*A)) == sp.zeros(2, 2),
          "A1 H is not 2*A^T*A at n=%d" % nn)

# A2: trace is 2n + 2*sum x_i^2
check(sp.simplify(H.trace() - (2*n + 2*Sxx)) == 0, "A2 trace is not 2n + 2*sum x_i^2")
check(sp.simplify(H.trace() - 2*n) == 2*Sxx, "A2 trace minus 2n is not 2*sum x_i^2")

# A3: top-left entry equals 2n and equals the first leading principal minor
check(sp.simplify(H[0, 0] - 2*n) == 0, "A3 top-left entry is not 2n")
M1 = H[:1, :1].det()
check(sp.simplify(M1 - 2*n) == 0, "A3 first leading principal minor is not 2n")
check(sp.simplify(M1 - H.trace()) != 0, "A3 first minor and trace wrongly identified")

# ---------------------------------------------------------------------- A4
M2 = sp.simplify(H.det())
check(sp.simplify(M2 - 4*(n*Sxx - Sx**2)) == 0,
      "A4 det H is not 4(n*sum x^2 - (sum x)^2)")
for nn in range(1, 9):
    xs = sp.symbols('x0:%d' % nn, real=True)
    xbar = sp.Rational(1, nn)*sum(xs)
    centred = sum((t - xbar)**2 for t in xs)
    lhs = M2.subs({n: nn, Sxx: sum(t**2 for t in xs), Sx: sum(xs)})
    check(sp.simplify(sp.expand(lhs - 4*nn*centred)) == 0,
          "A4 det != 4n*sum(x-xbar)^2 at n=%d" % nn)
# "2n positive for any data at all": holds for every n >= 1 (n = 0 is not data).
check(all(2*m > 0 for m in range(1, 200)), "A4 first minor not positive for n>=1")

# ------------------------------------------------------- A5 / A9 the iff
# Both directions at once, structurally:
#   sum(x_i - xbar)^2 == (1/n) * sum_{i<j} (x_i - x_j)^2
# a nonnegative combination that vanishes exactly when all x_i coincide.
for nn in range(1, 8):
    xs = sp.symbols('x0:%d' % nn, real=True)
    xbar = sp.Rational(1, nn)*sum(xs)
    centred = sp.expand(sum((t - xbar)**2 for t in xs))
    pairs = sp.expand(sp.Rational(1, nn)*sum((xs[i] - xs[j])**2
                                             for i in range(nn)
                                             for j in range(i + 1, nn)))
    check(sp.simplify(centred - pairs) == 0, "A5 pairwise identity fails at n=%d" % nn)
    t = sp.Symbol('t', real=True)
    check(sp.simplify(centred.subs({s: t for s in xs})) == 0,
          "A5 all-identical x does not zero the det at n=%d" % nn)
    if nn >= 2:
        val = centred.subs(dict(zip(xs, [sp.Integer(i) for i in range(nn)])))
        check(sp.simplify(val) > 0, "A5 distinct x does not give det>0 at n=%d" % nn)
notes.append("A5 iff proved structurally: sum(x-xbar)^2 = (1/n)*sum_{i<j}(x_i-x_j)^2, "
             "zero exactly when all x_i coincide")

# ---------------------------------------------------------------------- A6
# The text argues: both minors positive => eigenvalue sum > 0 and product > 0
# => both eigenvalues positive.  Three things must hold for that to be valid.
#
# (i) symmetry => real eigenvalues (checked above via H.is_symmetric).
# (ii) product of eigenvalues = det = M2 > 0 : immediate from the second minor.
# (iii) sum of eigenvalues = trace = 2n + 2*Sxx > 0 : follows from the first
#       minor 2n > 0 together with Sxx = sum x_i^2 >= 0.  Verify Sxx is a sum
#       of even powers with positive coefficients, hence nonnegative.
for nn in range(1, 7):
    xs = sp.symbols('x0:%d' % nn, real=True)
    poly = sp.Poly(sum(t**2 for t in xs), xs)
    check(all(all(e % 2 == 0 for e in mono) for mono in poly.monoms()),
          "A6 sum x^2 has an odd exponent at n=%d" % nn)
    check(all(c > 0 for c in poly.coeffs()),
          "A6 sum x^2 has a nonpositive coefficient at n=%d" % nn)

# the algebraic core of "sum>0 and product>0 => both positive" for a symmetric
# 2x2: with T=trace>0, D=det>0 and real eigenvalues (T^2-4D >= 0), the smaller
# root (T - sqrt(T^2-4D))/2 is positive because T^2 - (T^2-4D) = 4D > 0.
T, D = sp.symbols('T D', positive=True)
check(sp.simplify(T**2 - (T**2 - 4*D)) == 4*D,
      "A6 discriminant comparison T^2 - (T^2-4D) != 4D")
disc = sp.Symbol('disc', nonnegative=True)
lam_min = (T - sp.sqrt(T**2 - 4*D))/2
lam_max = (T + sp.sqrt(T**2 - 4*D))/2
check(sp.simplify(lam_min + lam_max - T) == 0, "A6 eigenvalue sum is not the trace")
check(sp.simplify(sp.expand(lam_min*lam_max) - D) == 0,
      "A6 eigenvalue product is not the det")
for Tv, Dv in [(1, sp.Rational(1, 5)), (10, 1), (34, 24), (6, 8), (100, 2499)]:
    lo = lam_min.subs({T: Tv, D: Dv})
    if sp.im(sp.nsimplify(lo)) == 0:
        check(sp.simplify(lo) > 0,
              "A6 smaller eigenvalue not positive at T=%s D=%s" % (Tv, Dv))
# and the converse guard: positive product alone is NOT enough (both could be
# negative), so the text needs both facts, as it states.
check(sp.simplify(lam_min.subs({T: -6, D: 8})) < 0,
      "A6 guard: product>0 with trace<0 should give negative eigenvalues")
notes.append("A6 argument valid: symmetry gives real eigenvalues, second minor "
             "gives positive product, first minor plus Sxx>=0 gives positive trace")

# ------------------------------------------- A7 stationary point / minimiser
grad = [sp.diff(S, a), sp.diff(S, b)]
sols = sp.solve(grad, [a, b], dict=True)
check(len(sols) == 1, "A7 stationary point not unique in the generic case")
a_star = sp.simplify(sols[0][a])
b_star = sp.simplify(sols[0][b])
b_claim = (n*Sxy - Sx*Sy)/(n*Sxx - Sx**2)
a_claim = (Sy - b_claim*Sx)/n
check(sp.simplify(b_star - b_claim) == 0, "A7 b-minimiser disagrees")
check(sp.simplify(a_star - a_claim) == 0, "A7 a-minimiser disagrees")
for nn in range(2, 7):
    xs = sp.symbols('x0:%d' % nn, real=True)
    ys = sp.symbols('y0:%d' % nn, real=True)
    xbar = sp.Rational(1, nn)*sum(xs)
    ybar = sp.Rational(1, nn)*sum(ys)
    num = sum((xs[i] - xbar)*(ys[i] - ybar) for i in range(nn))
    den = sum((t - xbar)**2 for t in xs)
    d = moments(list(xs), list(ys))
    check(sp.simplify(b_claim.subs(d) - num/den) == 0,
          "A7 covariance-over-variance form of b fails at n=%d" % nn)
    check(sp.simplify(a_claim.subs(d) - (ybar - (num/den)*xbar)) == 0,
          "A7 a = ybar - b*xbar fails at n=%d" % nn)

# strict convexity => that stationary point is the unique GLOBAL minimum
random.seed(20260823)
u, v = sp.symbols('u v', real=True)
done = 0
for _ in range(40):
    nn = random.randint(2, 6)
    xs = [sp.Integer(random.randint(-9, 9)) for _ in range(nn)]
    ys = [sp.Integer(random.randint(-9, 9)) for _ in range(nn)]
    if len(set(xs)) == 1:
        continue
    done += 1
    d = moments(xs, ys)
    Hn = H.subs(d)
    check(all(sp.simplify(e) > 0 for e in Hn.eigenvals()),
          "A6 Hessian not positive definite on non-degenerate data")
    check(sp.simplify(Hn[0, 0]) > 0 and sp.simplify(Hn.det()) > 0,
          "A4 minors not both positive on non-degenerate data")
    check(sp.simplify(Hn.trace()) > 0, "A6 trace not positive on non-degenerate data")
    Sn = S.subs(d)
    astar = sp.simplify(a_star.subs(d))
    bstar = sp.simplify(b_star.subs(d))
    Smin = sp.simplify(Sn.subs({a: astar, b: bstar}))
    gap = sp.expand(Sn.subs({a: astar + u, b: bstar + v}) - Smin)
    quad = sp.Rational(1, 2)*(Hn[0, 0]*u**2 + 2*Hn[0, 1]*u*v + Hn[1, 1]*v**2)
    check(sp.simplify(gap - quad) == 0, "A7 S is not its Hessian quadratic about (a*,b*)")
    for du in [-3, -1, sp.Rational(1, 2), 2]:
        for dv in [-3, -1, sp.Rational(1, 2), 2]:
            check(sp.simplify(gap.subs({u: du, v: dv})) > 0,
                  "A7 found a direction with no strict increase")
    best = min(sp.simplify(Sn.subs({a: sp.Rational(p, 2), b: sp.Rational(q2, 2)}))
               for p in range(-10, 11) for q2 in range(-10, 11))
    check(sp.simplify(best - Smin) >= 0, "A7 grid search beat the closed form")
check(done >= 20, "A7 too few non-degenerate trials")

# ------------------------------------- A8 / A9 failure direction of the iff
# All x_i equal to x0: with c = a + b*x0,
#   S = n*(c - ybar)^2 + sum (y_i - ybar)^2
# so the minimum EXISTS (it is attained, value = sum (y_i-ybar)^2) and is
# attained on the whole LINE a + b*x0 = ybar.  Non-uniqueness, not
# non-existence.  This is the direction the card iff needs.
x0 = sp.Symbol('x0', real=True)
c = sp.Symbol('c', real=True)
for nn in range(1, 6):
    ys = sp.symbols('y0:%d' % nn, real=True)
    xs = [x0]*nn
    ybar = sp.Rational(1, nn)*sum(ys)
    Sdeg = sp.expand(S.subs(moments(xs, list(ys))))
    target = sp.expand(nn*(c - ybar)**2 + sum((t - ybar)**2 for t in ys))
    check(sp.simplify(sp.expand(Sdeg.subs(a, c - b*x0)) - target) == 0,
          "A9 degenerate S does not reduce to n(c-ybar)^2 + SSy at n=%d" % nn)
    check(sp.simplify(M2.subs({n: nn, Sx: nn*x0, Sxx: nn*x0**2})) == 0,
          "A9 det H is not 0 in the all-identical case at n=%d" % nn)
    p1 = {a: ybar, b: sp.Integer(0)}
    p2 = {a: ybar - x0, b: sp.Integer(1)}
    p3 = {a: ybar - 5*x0, b: sp.Integer(5)}
    vals = [sp.simplify(Sdeg.subs(p)) for p in (p1, p2, p3)]
    check(sp.simplify(vals[0] - vals[1]) == 0 and sp.simplify(vals[0] - vals[2]) == 0,
          "A9 distinct points on the line do not score equally at n=%d" % nn)
    check(sp.simplify(vals[0] - sum((t - ybar)**2 for t in ys)) == 0,
          "A9 line value is not the residual sum of squares at n=%d" % nn)
    # existence: the value on the line is the global infimum, and it is attained
    check(sp.simplify(sp.expand(target - sum((t - ybar)**2 for t in ys))
                      - nn*(c - ybar)**2) == 0,
          "A9 excess above the line value is not n(c-ybar)^2 at n=%d" % nn)
notes.append("A9 failure direction verified as non-uniqueness with the minimum "
             "attained on the line a + b*x0 = ybar, not non-existence")

# the concrete example in the text: x=(1,1,1), y=(1,2,3), every a+b=2 scores 2
xs_d = [sp.Integer(1)]*3
ys_d = [sp.Integer(1), sp.Integer(2), sp.Integer(3)]
Sd = sp.expand(S.subs(moments(xs_d, ys_d)))
Sc = sp.expand(Sd.subs(a, c - b))
check(sp.simplify(Sc - (3*(c - 2)**2 + 2)) == 0,
      "A8 example does not reduce to 3(a+b-2)^2 + 2")
check(len(set(sp.simplify(Sd.subs({a: 2 - t0, b: t0}))
              for t0 in [-7, 0, sp.Rational(5, 3), 11])) == 1,
      "A8 lines with a+b=2 do not all score the same")
check(sp.simplify(Sd.subs({a: 2, b: 0})) == 2, "A8 minimum value is not 2")
check(all(sp.simplify(Sd.subs({a: 2 - t0 + e, b: t0})) > 2
          for t0 in [-1, 0, 3] for e in [sp.Rational(-1, 2), sp.Rational(1, 4)]),
      "A8 points off the line a+b=2 do not score strictly worse")
check(sp.simplify(M2.subs(moments(xs_d, ys_d))) == 0, "A8 det is not 0 for the example")

# card iff on random small integer data, both directions, including n=1 and n=2.
# For this quadratic, H is PSD always (Gram), so: unique minimiser <=> det H != 0.
bad_iff = []
for nn in [1, 2, 3, 4, 5]:
    for _ in range(80):
        xs = [sp.Integer(random.randint(-4, 4)) for _ in range(nn)]
        ys = [sp.Integer(random.randint(-4, 4)) for _ in range(nn)]
        d = moments(xs, ys)
        xbar = sp.Rational(sum(xs), nn)
        centred = sum((t - xbar)**2 for t in xs)
        Hn = H.subs(d)
        unique = sp.simplify(Hn.det()) != 0
        if bool(centred > 0) != bool(unique):
            bad_iff.append((nn, [int(t) for t in xs], [int(t) for t in ys]))
check(not bad_iff, "A9 card iff violated: %s" % bad_iff[:3])

# ------------------------------------------------------------ A10, A11, A12
check(3 + (-3) == 0 and 3**2 + (-3)**2 == 18, "A10 +3/-3 do not contribute 18")
r = sp.Symbol('r', positive=True)
check(sp.simplify((2*r)**2 / r**2) == 4, "A11 doubling a miss does not quadruple cost")
E, kk = sp.symbols('E k', positive=True)
check(sp.simplify(kk*(E/kk)**2 - E**2/kk) == 0, "A12 even split cost is not E^2/k")
check(sp.simplify(sp.diff(E**2/kk, kk) + E**2/kk**2) == 0,
      "A12 E^2/k is not decreasing in k")
check(sp.simplify(E**2/1 - E**2/5) > 0, "A12 one big miss is not costlier than five")
# even splitting really is the cheapest way to spend a fixed total absolute error,
# so "prefers many small misses to one big one" is true under the stated restriction
for k_ in [2, 3, 4]:
    rs = sp.symbols('r0:%d' % k_, positive=True)
    lam = sp.Symbol('lam')
    obj = sum(t**2 for t in rs)
    con = sum(rs) - E
    crit = sp.solve([sp.diff(obj - lam*con, t) for t in rs] + [con],
                    list(rs) + [lam], dict=True)
    check(len(crit) == 1 and all(sp.simplify(crit[0][t] - E/k_) == 0 for t in rs),
          "A12 even split is not the constrained optimum at k=%d" % k_)
    check(sp.simplify(obj.subs(crit[0]) - E**2/k_) == 0,
          "A12 optimal cost at k=%d is not E^2/k" % k_)
notes.append("A12 is quantified at fixed total absolute error E, which is exactly "
             "the restriction that makes the preference claim true")

# --- diagnostics to stderr; canonical scalar to the final stdout line --------
import sys

diag_computed = ("H=[[2n,2Sx],[2Sx,2Sxx]] constant symmetric =2*A^T*A (PSD always); "
                 "trace=2n+2Sxx; first leading principal minor=2n>0; "
                 "det H=4(n*Sxx-Sx^2)=4n*sum(x-xbar)^2 >0 iff x not all identical; "
                 "minors positive + symmetric => both eigenvalues positive => H PD => "
                 "unique global min b=sum(x-xbar)(y-ybar)/sum(x-xbar)^2, a=ybar-b*xbar; "
                 "all x equal => det=0, min attained on line a+b*x0=ybar (non-unique)")
print(json.dumps({"claim_id": "gauss-legendre-least-squares",
                  "computed": diag_computed,
                  "agrees": (len(fail) == 0),
                  "failures": fail,
                  "notes": notes}), file=sys.stderr)

# Canonical instance fixed by the contract: fit x=(1,2,3), y=(2,3,5).
cx = [sp.Integer(1), sp.Integer(2), sp.Integer(3)]
cy = [sp.Integer(2), sp.Integer(3), sp.Integer(5)]
cd = moments(cx, cy)
cb = sp.nsimplify(sp.simplify(b_star.subs(cd)))   # slope, from our own closed form
ca = sp.nsimplify(sp.simplify(a_star.subs(cd)))   # intercept, from our own closed form
assert cb == sp.Rational(3, 2), "canonical slope wrong: %s" % cb
assert ca == sp.Rational(1, 3), "canonical intercept wrong: %s" % ca

canon_ok = (len(fail) == 0 and ca == sp.Rational(1, 3) and cb == sp.Rational(3, 2))
print(json.dumps({"claim_id": "gauss-legendre-least-squares",
                  "computed": str((ca, cb)),   # (intercept, slope) -> "(1/3, 3/2)"
                  "agrees": canon_ok}))
