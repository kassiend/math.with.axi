"""Probe the payload's stated domain and just outside it.

Claims under test (payload `applicability`):
  C1: for a = round(sqrt(n)), |d| <= a
  C2: estimate a + d/(2a) is never below sqrt(n)
  C3: overshoot < 1/(8a)
  C4: "Two decimal places are therefore reliable for any a >= 40"
"""

from decimal import Decimal, getcontext
import math

getcontext().prec = 50


def isqrt_nearest(n):
    r = math.isqrt(n)
    return r + 1 if (n - r * r) > (r + 1) * (r + 1) - n else r


def dsqrt(n):
    return Decimal(n).sqrt()


def r2(x):
    return (x * 100 + Decimal("0.5")).to_integral_value(rounding="ROUND_FLOOR") / 100


bad_c1 = bad_c2 = bad_c3 = []
bad_c1, bad_c2, bad_c3, bad_c4 = [], [], [], []

for n in range(1, 400001):
    a = isqrt_nearest(n)
    d = n - a * a
    if abs(d) > a:
        bad_c1.append(n)
    est = Decimal(a) + Decimal(d) / (2 * Decimal(a))
    ex = dsqrt(n)
    if est < ex:
        bad_c2.append(n)
    if a * a != n and (est - ex) >= Decimal(1) / (8 * Decimal(a)):
        bad_c3.append(n)
    if a >= 40 and r2(est) != r2(ex):
        bad_c4.append((n, a, str(r2(est)), str(r2(ex)), str(ex)[:12]))

print("C1 |d|<=a violations:", bad_c1[:5], "count", len(bad_c1))
print("C2 upper-bound violations:", bad_c2[:5], "count", len(bad_c2))
print("C3 overshoot<1/(8a) violations:", bad_c3[:5], "count", len(bad_c3))
print("C4 two-decimal violations for a>=40: count", len(bad_c4))
for row in bad_c4[:12]:
    print("   n=%d a=%d est2dp=%s true2dp=%s true=%s" % row)

# how far up does C4 keep failing?
if bad_c4:
    print("largest a with a 2dp failure:", max(r[1] for r in bad_c4))
    print("smallest n failing:", bad_c4[0][0])

# the draw range itself
lo, hi = 1100, 2999
print("anchor a range over draw spec [%d,%d]: %d..%d" % (lo, hi, isqrt_nearest(lo), isqrt_nearest(hi)))
inrange_fail = [r for r in bad_c4 if lo <= r[0] <= hi]
print("2dp failures inside the draw range:", len(inrange_fail), inrange_fail[:8])
below40 = [n for n in range(lo, hi + 1) if isqrt_nearest(n) < 40]
print("draws in spec with a<40 (outside claimed a>=40 guarantee):", len(below40), "e.g.", below40[:5])
