"""Independent check of claim `estimate-square-root-nearest-square`.

Derived from the payload text alone:
  n = 2232, a = round(sqrt(n)) is the NEAREST whole square root, d = n - a^2,
  sqrt(n) ~= a + d/(2a); stated result "47.24", exact "47.244047...",
  gap 23, correction "23 / 94 = 0.2447", signed error "+0.00064".
"""

import json
import sympy as sp

CLAIM = "estimate-square-root-nearest-square"

n = sp.Integer(2232)

# a = nearest whole square root, found without assuming the payload's 47.
a = sp.floor(sp.sqrt(n))
if abs(sp.sqrt(n) - (a + 1)) < abs(sp.sqrt(n) - a):
    a = a + 1
a = sp.Integer(a)

d = n - a**2
estimate = sp.Rational(a) + sp.Rational(d, 2 * a)
exact = sp.sqrt(n)

est2 = sp.N(estimate, 30)
exact2 = sp.N(exact, 30)

# Round-half-up to 2 dp, matching how the payload renders "47.24".
def r2(x):
    return sp.Rational(sp.floor(sp.Rational(x) * 100 + sp.Rational(1, 2)), 100)

result_2dp = r2(estimate)
signed_error = est2 - exact2

checks = {
    "anchor_is_47": a == 47,
    "gap_is_23": d == 23,
    "correction_denominator_94": 2 * a == 94,
    "correction_4dp": abs(sp.Rational(d, 2 * a) - sp.Rational(2447, 10000)) < sp.Rational(1, 20000),
    "result_2dp": result_2dp == sp.Rational(4724, 100),
    "exact_prefix": str(sp.N(exact, 12)).startswith("47.244047"),
    # payload asserts the estimate is never below sqrt(n)
    "is_upper_bound": est2 > exact2,
    # payload asserts overshoot < 1/(8a)
    "overshoot_under_1_over_8a": signed_error < sp.N(sp.Rational(1, 8 * a), 30),
    # payload asserts signed error rounds to +0.00064
    "signed_error_5dp": abs(signed_error - sp.N("0.00064", 30)) < sp.N("0.000005", 30),
}

agrees = all(checks.values())
computed = "{:.2f}".format(float(est2))

print(json.dumps({"claim_id": CLAIM, "computed": computed, "agrees": bool(agrees)}))
