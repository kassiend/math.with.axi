"""
Generator-side check for lesson #6 - "The Rule of 72" (area: estimation-and-bounding).

Confirms, independently of the cards:
  A. the worked example        72 / 8 = 9, against the true doubling time ln2/ln(1.08), which is
                               obtained by SOLVING 1.08**t = 2 rather than by assuming the formula
  B. the on-card evidence      1.08 ** 9 = 1.999005 (so 9 years really does about double it)
  C. the applicability claim   |72/r - t(r)| / t(r) <= 2%  EXHAUSTIVELY over the stated finite
                               domain r = 4.0, 4.1, ..., 12.0   (§3.2 - a universality-style
                               claim needs an exhaustive check over a stated finite domain,
                               not an assertion)
  D. the endpoint numbers quoted in `applicability` (+1.85% at r=4, -1.90% at r=12) are the
                               extremes of that domain, i.e. the 2% band is tight
  E. the carry case            r = 50 genuinely BREAKS the stated bound, and the drift grows
  F. why the numerator is 72 and not 100*ln2 = 69.31
  G. the operand draw          r = 8 replays from seed 411890531 and the declared spec

Exact rationals are used for the arithmetic that is exact (72/r, 1.08**9); the transcendental
doubling time is evaluated at 40 digits, ~30 more than any claim in the plan depends on.
"""

from fractions import Fraction

import sympy as sp
from mpmath import mp, log, mpf

mp.dps = 40

FAILS = []


def check(label, ok, detail=""):
    print(("  PASS  " if ok else "  FAIL  ") + label + (("   " + detail) if detail else ""))
    if not ok:
        FAILS.append(label)


def true_doubling_time(r):
    """Exact solution of (1 + r/100)**t = 2, evaluated numerically."""
    return log(2) / log(1 + mpf(r) / 100)


print("=" * 78)
print("A. worked example: r = 8 (drawn), rule says 72 / r")
print("=" * 78)

r = 8
estimate = Fraction(72, r)
check("72 / 8 is exactly 9", estimate == 9, f"72/8 = {estimate}")

# Solve the DEFINING equation 1.08**t = 2 symbolically, rather than trusting the closed form.
t = sp.symbols("t")
sol = sp.solveset(sp.Eq(sp.Rational(108, 100) ** t, 2), t, domain=sp.S.Reals)
sym_val = sp.N(list(sol)[0], 30)
# and again by a blind numeric root-find on the same equation
root = sp.nsolve(sp.Rational(108, 100) ** t - 2, t, 5)
num_val = true_doubling_time(8)

check("solveset(1.08**t = 2) gives exactly one real root", len(list(sol)) == 1,
      f"root = {list(sol)[0]}")
check("that root equals ln2 / ln(1.08) to 25 digits",
      abs(sym_val - sp.Float(str(num_val), 30)) < sp.Float("1e-25"),
      f"solveset -> {sp.N(sym_val, 12)}")
check("an independent numeric root-find agrees",
      abs(sp.Float(root) - sp.Float(str(num_val), 30)) < sp.Float("1e-12"),
      f"nsolve -> {sp.N(root, 12)}")
check("true doubling time at 8% is 9.0064683...", abs(num_val - mpf("9.00646831")) < mpf("1e-7"),
      f"t(8) = {mp.nstr(num_val, 10)}")

err8 = (mpf(72) / 8 - num_val) / num_val * 100
check("estimate 9 is within 2% of the truth (plan quotes -0.07%)",
      abs(err8) <= 2 and abs(err8 - mpf("-0.07182")) < mpf("1e-4"),
      f"signed error {mp.nstr(err8, 4)}%")

print()
print("=" * 78)
print("B. the on-card evidence line: 1.08 ** 9")
print("=" * 78)

growth = Fraction(108, 100) ** 9
check("1.08**9 rounds to 1.999 as shown on step s4", round(float(growth), 3) == 1.999,
      f"1.08**9 = {float(growth):.9f}")
check("1.08**9 is just UNDER 2, so 9 years slightly under-doubles", growth < 2,
      f"shortfall {float(2 - growth):.6f}")
check("1.08**10 overshoots 2, so the truth is between 9 and 10 years",
      Fraction(108, 100) ** 10 > 2, f"1.08**10 = {float(Fraction(108, 100) ** 10):.6f}")

print()
print("=" * 78)
print("C. applicability, EXHAUSTIVE over the stated finite domain r = 4.0 .. 12.0 step 0.1")
print("=" * 78)

BOUND = mpf(2)  # percent
domain = [Fraction(n, 10) for n in range(40, 121)]
check("domain has the 81 grid points claimed", len(domain) == 81, f"n = {len(domain)}")

worst = None
broken = []
sign_changes = 0
prev_sign = None
for rq in domain:
    rr_ = mpf(rq.numerator) / mpf(rq.denominator)
    tt = true_doubling_time(rr_)
    est = mpf(72) / rr_
    e = (est - tt) / tt * 100
    if worst is None or abs(e) > abs(worst[1]):
        worst = (rq, e)
    s = 1 if e > 0 else -1
    if prev_sign is not None and s != prev_sign:
        sign_changes += 1
    prev_sign = s
    if abs(e) > BOUND:
        broken.append(float(rq))

check("every one of the 81 grid points is within the stated 2% band", not broken,
      f"worst |error| = {mp.nstr(abs(worst[1]), 4)}% at r = {float(worst[0])}"
      + (f"   BROKEN AT {broken}" if broken else ""))
check("the error crosses zero exactly once inside the range", sign_changes == 1,
      f"{sign_changes} sign change(s)")

print()
print("=" * 78)
print("D. the band is TIGHT: the quoted endpoints are the extremes")
print("=" * 78)

e4 = (mpf(72) / 4 - true_doubling_time(4)) / true_doubling_time(4) * 100
e12 = (mpf(72) / 12 - true_doubling_time(12)) / true_doubling_time(12) * 100
check("r = 4  -> +1.85% as quoted (worst over-estimate)", abs(e4 - mpf("1.85")) < mpf("0.01"),
      f"{mp.nstr(e4, 4)}%  (72/4 = 18, true {mp.nstr(true_doubling_time(4), 8)})")
check("r = 12 -> -1.90% as quoted (worst under-estimate)", abs(e12 - mpf("-1.901")) < mpf("0.01"),
      f"{mp.nstr(e12, 4)}%  (72/12 = 6, true {mp.nstr(true_doubling_time(12), 8)})")
check("the worst grid point is one of the two endpoints", float(worst[0]) in (4.0, 12.0),
      f"worst at r = {float(worst[0])}")
check("a 1.8% band would NOT hold, so 2% cannot be tightened much",
      max(abs(e4), abs(e12)) > mpf("1.8"), f"max |error| = {mp.nstr(max(abs(e4), abs(e12)), 4)}%")

print()
print("=" * 78)
print("E. carry case: r = 50 breaks the rule")
print("=" * 78)

t50 = true_doubling_time(50)
est50 = Fraction(72, 50)
e50 = (mpf(72) / 50 - t50) / t50 * 100
check("72 / 50 = 1.44 exactly", est50 == Fraction(36, 25) and float(est50) == 1.44)
check("true doubling time at 50% is 1.7095...", abs(t50 - mpf("1.70951129")) < mpf("1e-7"),
      f"t(50) = {mp.nstr(t50, 9)}")
check("1.5**1.44 falls short of 2, confirming the estimate is too low",
      mpf("1.5") ** mpf("1.44") < 2, f"1.5**1.44 = {mp.nstr(mpf('1.5') ** mpf('1.44'), 8)}")
check("the 2% bound is BROKEN there", abs(e50) > BOUND, f"error {mp.nstr(e50, 4)}%")
check("broken by nearly 8x the band, as the plan states", abs(e50) / BOUND > 7,
      f"{mp.nstr(abs(e50) / BOUND, 4)}x")

print("  drift table:")
for rr in (12, 20, 30, 40, 50, 100):
    tt = true_doubling_time(rr)
    print(f"      r={rr:4}%   rule {float(Fraction(72, rr)):7.4f}   "
          f"true {mp.nstr(tt, 7):>9}   error {mp.nstr((mpf(72) / rr - tt) / tt * 100, 4):>8}%")

drift = [abs((mpf(72) / rr - true_doubling_time(rr)) / true_doubling_time(rr))
         for rr in (12, 20, 30, 40, 50, 100)]
check("the error grows monotonically past the range", all(a < b for a, b in zip(drift, drift[1:])))
check("at r = 100 the true doubling time is exactly 1 period",
      abs(true_doubling_time(100) - 1) < mpf("1e-30"),
      f"rule says {float(Fraction(72, 100))} - absurd, growth of 100% IS a doubling")

print()
print("=" * 78)
print("F. the numerator 72 is not ln2, and that is the point")
print("=" * 78)

check("100 * ln2 = 69.3147, the CONTINUOUS-compounding numerator",
      abs(log(2) * 100 - mpf("69.3147180")) < mpf("1e-7"), f"{mp.nstr(log(2) * 100, 9)}")
check("72 is strictly larger, which is what pays for discrete compounding", mpf(72) > log(2) * 100)
check("72 divides exactly by 2,3,4,6,8,9,12 (why 72 and not 69 or 70)",
      all(72 % d == 0 for d in (2, 3, 4, 6, 8, 9, 12)))
check("69 would be worse at the drawn rate",
      abs((mpf(69) / 8 - num_val) / num_val) > abs(err8 / 100),
      f"69/8 = {float(Fraction(69, 8))} vs true {mp.nstr(num_val, 8)}")

print()
print("=" * 78)
print("G. operand draw replays from seed 411890531")
print("=" * 78)


def mulberry32(seed):
    a = seed & 0xFFFFFFFF

    def nxt():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        x = a
        x = ((x ^ (x >> 15)) * (x | 1)) & 0xFFFFFFFF
        x ^= (x + (((x ^ (x >> 7)) * (x | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((x ^ (x >> 14)) & 0xFFFFFFFF) / 4294967296

    return nxt


nxt = mulberry32(411890531)
drawn = 4 + int(nxt() * (12 - 4 + 1))
check("independent re-implementation of the sampler draws r = 8", drawn == 8, f"drew {drawn}")
check("8 lies inside the declared range [4, 12]", 4 <= 8 <= 12)
check("the range endpoints are the WORST cases, so the range hides nothing",
      float(worst[0]) in (4.0, 12.0))

print()
print("=" * 78)
if FAILS:
    print(f"RESULT: FAILED - {len(FAILS)} check(s): {FAILS}")
    raise SystemExit(1)
print("RESULT: ALL CHECKS PASSED")
print("  worked example  : 8% per year -> 72 / 8 = 9 periods   (true 9.006468, -0.07%)")
print("  applicability   : |72/r - t| / t <= 2% for all r in {4.0, 4.1, ..., 12.0}  [81/81]")
print("  band tightness  : worst +1.850% at r=4, worst -1.901% at r=12")
print("  carry case      : r = 50 -> 1.44 vs true 1.7095, -15.77%  (bound broken 7.9x)")
print("=" * 78)
