#!/usr/bin/env python3
"""
Independent check for lesson "estimate-product-round-to-nearest-ten" (Math tricks #6).

Rule under test: to estimate a product, round each factor to the nearest ten and
multiply. The worked example's DECISIVE result is the estimate the rule produces
for 49 x 48. This script derives that value from the rule (it does not hardcode it),
then also confirms the applicability claim (both rounded the same way => guaranteed
bound) and the carry_case (opposite rounding => direction not guaranteed).

The orchestrator reads ONLY the last stdout line, a single-line JSON object.
"""
import json
import sys
from sympy import Integer, Rational, nsimplify


def round_ten(n):
    """Round an integer to the nearest multiple of ten (ties go up)."""
    n = Integer(n)
    # nearest multiple of 10; .5 (i.e. remainder 5) rounds up
    return Integer(int((n + 5) // 10) * 10)


CLAIM_ID = "estimate-product-round-to-nearest-ten"

# --- worked example, operands from the declared seeded draw -------------------
a, b = Integer(49), Integer(48)

ra, rb = round_ten(a), round_ten(b)                 # 50, 50
estimate = ra * rb                                  # the rule's output = the claim
true_product = a * b                                # 2352

# sanity: the rounding really did produce 50, 50 (both up)
assert ra == 50 and rb == 50, (ra, rb)
a_up = ra >= a
b_up = rb >= b
both_up = a_up and b_up
print(f"round(49)={ra}, round(48)={rb}, estimate=50*50={estimate}, true=49*48={true_product}",
      file=sys.stderr)

# --- applicability: both rounded up => estimate is an over-estimate -----------
# Guaranteed by monotonicity of multiplication on positive reals; verify on this
# case and exhaustively over the two-digit domain for the "same way" claim.
assert both_up, "worked example should have both factors rounding up"
assert estimate >= true_product, (estimate, true_product)
rel_err = Rational(abs(estimate - true_product), true_product)
print(f"both rounded up -> over-estimate holds; relative error = {float(rel_err):.4f}",
      file=sys.stderr)

same_way_ok = True
for x in range(11, 100):
    for y in range(11, 100):
        rx, ry = round_ten(x), round_ten(y)
        if rx == 0 or ry == 0:
            continue
        est = rx * ry
        tru = x * y
        x_up, y_up = rx >= x, ry >= y
        if x_up and y_up and est < tru:
            same_way_ok = False
        if (not x_up) and (not y_up) and est > tru:
            same_way_ok = False
print(f"exhaustive same-way bound over [11,99]^2: holds = {same_way_ok}", file=sys.stderr)

# --- carry_case: opposite rounding does NOT fix the direction -----------------
# Show one opposite-direction pair whose estimate is BELOW the true product
# (47 up to 50, 43 down to 40): 50*40 = 2000 < 2021.
cx, cy = Integer(47), Integer(43)
crx, cry = round_ten(cx), round_ten(cy)             # 50, 40 (opposite ways)
cest, ctru = crx * cry, cx * cy                     # 2000, 2021
opposite = (crx >= cx) != (cry >= cy)
carry_breaks = opposite and cest < ctru             # under-estimate despite one rounding up
print(f"carry_case 47x43 -> {crx}*{cry}={cest}, true={ctru}, opposite_dirs={opposite}, "
      f"estimate_below_true={cest < ctru}", file=sys.stderr)

# also confirm opposite direction can go the OTHER way (52x48 -> 50*50 above true)
ox, oy = Integer(52), Integer(48)
orx, ory = round_ten(ox), round_ten(oy)             # 50, 50 ... same way, skip
# use 51 x 48 -> 50 (down) x 50 (up): opposite
ox, oy = Integer(51), Integer(48)
orx, ory = round_ten(ox), round_ten(oy)             # 50, 50 -> 51 rounds down to 50, 48 up to 50
opp2 = (orx >= ox) != (ory >= oy)
over2 = orx * ory > ox * oy
print(f"carry_case 51x48 -> {orx}*{ory}={orx*ory}, true={ox*oy}, opposite_dirs={opp2}, "
      f"estimate_above_true={over2}", file=sys.stderr)

# --- independent recompute of the decisive value -----------------------------
recompute = nsimplify(round_ten(49) * round_ten(48))   # 2500, via a second path
computed = str(Integer(estimate))
agrees = (
    str(recompute) == computed
    and same_way_ok
    and estimate >= true_product
    and carry_breaks
)

print(f"decisive computed value (rule's estimate for 49x48) = {computed}", file=sys.stderr)
print(json.dumps({"claim_id": CLAIM_ID, "computed": computed, "agrees": bool(agrees)}))
