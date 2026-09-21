"""Planner-side check for lesson `estimate-square-root-nearest-square` (Math tricks #6).

Confirms, independently of the displayed steps:
  1. the worked example  sqrt(2232) ~= 47.24  from the stated rule, against exact sqrt;
  2. the universality claim  a + d/(2a) >= sqrt(n)  symbolically (AM-GM instance);
  3. the accuracy claim  0 <= a + d/(2a) - sqrt(n) < 1/(8a)  exhaustively over a stated
     finite domain, together with |d| <= a for a = round(sqrt(n));
  4. the carry_case: anchoring on a = 40 instead of the nearest a = 47 breaks the
     two-decimal accuracy.
Exit code is non-zero if any assertion fails.
"""

import math
import sympy as sp

FAIL = []


def check(label, ok, detail=""):
    print(("PASS  " if ok else "FAIL  ") + label + ("   " + detail if detail else ""))
    if not ok:
        FAIL.append(label)


# ---------------------------------------------------------------- 1. worked example
N = 2232
# the anchor is recomputed as the nearest integer to sqrt(N); the plan's 47 is not trusted
a = sp.Integer(min(range(1, 1000), key=lambda k: abs(k * k - N)))
check("anchor a = 47 is the nearest whole square root", a == 47, f"a={a}, a^2={a*a}")

d = sp.Integer(N) - a ** 2
check("gap d = 23", d == 23, f"d={d}")

est = sp.Rational(a) + sp.Rational(d, 2 * a)
exact = sp.sqrt(N)
err = sp.N(est - exact, 30)

check("estimate rounds to 47.24", round(float(est), 2) == 47.24, f"est={sp.N(est,12)}")
check("exact sqrt(2232) = 47.244047...", str(sp.N(exact, 10)).startswith("47.24404"),
      f"exact={sp.N(exact,12)}")
check("estimate is high, by < 0.001", 0 < err < sp.Rational(1, 1000), f"error={err}")
check("error < 1/(8a) as claimed", err < sp.Rational(1, 8 * int(a)),
      f"1/(8a)={sp.N(sp.Rational(1,8*int(a)),6)}")

# ---------------------------------------------------------------- 2. universality, symbolic
A, D = sp.symbols("A D", positive=True), sp.Symbol("D", real=True)
A = sp.Symbol("A", positive=True)
n_sym = A ** 2 + D
est_sym = A + D / (2 * A)
# (a + d/2a)^2 - n = (d/2a)^2 >= 0, so est >= sqrt(n) whenever est >= 0.
gap_sq = sp.simplify(sp.expand(est_sym ** 2 - n_sym))
check("identity  est^2 - n = (d/2a)^2", sp.simplify(gap_sq - (D / (2 * A)) ** 2) == 0,
      f"est^2-n = {gap_sq}")
check("that quantity is a square, hence >= 0", sp.ask(sp.Q.nonnegative(gap_sq)) is not False,
      f"{gap_sq} = (d/2a)^2")
# same statement as the AM-GM instance actually cited in the plan
am = (A + n_sym / A) / 2
check("est equals the arithmetic mean of a and n/a (am-gm instance)",
      sp.simplify(am - est_sym) == 0)

# ---------------------------------------------------------------- 3. exhaustive finite check
DOMAIN_HI = 1_000_000
worst_ratio, worst_at = 0.0, None
neg, dviol = 0, 0
for m in range(2, DOMAIN_HI + 1):
    ai = round(math.sqrt(m))
    di = m - ai * ai
    if abs(di) > ai:
        dviol += 1
    e = ai + di / (2 * ai) - math.sqrt(m)
    if e < -1e-12:
        neg += 1
    r = e * 8 * ai
    if r > worst_ratio:
        worst_ratio, worst_at = r, (m, ai, di)

check(f"no under-estimate for n = 2..{DOMAIN_HI}", neg == 0, f"violations={neg}")
check(f"|d| <= a for n = 2..{DOMAIN_HI}", dviol == 0, f"violations={dviol}")
check(f"error < 1/(8a) for n = 2..{DOMAIN_HI}", worst_ratio < 1.0,
      f"max error*8a = {worst_ratio:.6f} at n,a,d = {worst_at}")

# ---------------------------------------------------------------- 4. carry case
a_bad = 40
est_bad = a_bad + (N - a_bad ** 2) / (2 * a_bad)
err_bad = est_bad - math.sqrt(N)
check("carry case: a = 40 gives 47.90", round(est_bad, 2) == 47.90, f"est={est_bad}")
check("carry case is still an over-estimate", err_bad > 0, f"error=+{err_bad:.4f}")
check("carry case loses two-decimal accuracy", err_bad > 0.1,
      f"error=+{err_bad:.4f} vs +{float(err):.5f} from the nearest square")
check("carry case has |d| > a", abs(N - a_bad ** 2) > a_bad, f"d={N - a_bad**2}, a={a_bad}")

# ---------------------------------------------------------------- 5. seeded draw sanity
check("worked-example operand is inside the declared draw range 1100..2999",
      1100 <= N <= 2999)

print()
print("RESULT:", "ALL CHECKS PASSED" if not FAIL else f"{len(FAIL)} FAILED: {FAIL}")
raise SystemExit(1 if FAIL else 0)
