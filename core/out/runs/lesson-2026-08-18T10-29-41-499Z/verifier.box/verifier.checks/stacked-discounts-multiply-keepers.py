"""Independent verification of claim `stacked-discounts-multiply-keepers`.

Derived from the payload's claim text only:

  applicability: for a% off then b% off, 0 <= a <= 100, 0 <= b <= 100, the
                 fraction still to pay is (1 - a/100)(1 - b/100); the total
                 discount is a + b - ab/100 percent; exact, any starting
                 price, any number of stacks, either order.
  worked ex.:    a=10, b=80  ->  18% left, 82% off, 100 -> 90 -> 18
  carry_case:    adding is wrong whenever both discounts are nonzero;
                 adding agrees with the correct rule only when a=0 or b=0.
                 50% then 50% leaves 25%.

Every sub-check must pass for `agrees` to be true. Exactly one JSON line
is printed.
"""

import json
from sympy import Rational, symbols, simplify, expand, nsimplify

CLAIM = "stacked-discounts-multiply-keepers"
ok = True


def keep(a, b):
    """Fraction still to pay, straight from the claimed rule."""
    return (1 - Rational(a, 100)) * (1 - Rational(b, 100))


# ---------------------------------------------------------------- 1. worked example
# Model the transaction independently of the rule: apply each discount in
# turn to the running price, starting from a price of 100.
price = Rational(100)
for pct in (10, 80):
    price = price - price * Rational(pct, 100)     # take pct% off the RUNNING price
# price is now what is actually paid, out of 100
left_pct = price                                    # since start was exactly 100
off_pct = 100 - left_pct

ok &= (left_pct == 18)                              # "18% of the price left"
ok &= (off_pct == 82)                               # "i.e. 82% off"
ok &= (keep(10, 80) == Rational(18, 100))           # rule reproduces the transaction
# the displayed trail 100 -> 90 -> 18
trail = [Rational(100)]
for pct in (10, 80):
    trail.append(trail[-1] * (1 - Rational(pct, 100)))
ok &= (trail == [Rational(100), Rational(90), Rational(18)])
# the display's own arithmetic: 0.9 x 0.2 = 0.18
ok &= (nsimplify("0.9") * nsimplify("0.2") == nsimplify("0.18"))

# ---------------------------------------------------------------- 2. universality of a+b-ab/100
# Claim says the identity is EXACT for every a, b in range. Prove it
# symbolically over all reals (which strictly contains the stated domain),
# rather than sampling.
a, b = symbols("a b", real=True)
lhs = 100 * (1 - (1 - a / 100) * (1 - b / 100))     # total discount, percent
rhs = a + b - a * b / 100
ok &= (simplify(expand(lhs - rhs)) == 0)

# ---------------------------------------------------------------- 3. boundary of the stated domain
# a, b in {0, 1, 50, 99, 100} plus a full integer sweep of the closed box.
for x in range(0, 101):
    for y in range(0, 101):
        k = keep(x, y)
        # keep-fraction must land in [0,1] everywhere in the stated domain
        ok &= (0 <= k <= 1)
        # discount formula must match the multiplicative truth
        ok &= (100 * (1 - k) == x + y - Rational(x * y, 100))
        # order must not matter (claim: "in either order")
        ok &= (k == keep(y, x))
        # carry_case: adding equals the truth IFF one of them is zero
        adds_ok = (x + y == x + y - Rational(x * y, 100))
        ok &= (adds_ok == (x == 0 or y == 0))

# endpoints behave as claimed
ok &= (keep(0, 37) == Rational(63, 100))            # 0% off is a no-op
ok &= (keep(100, 80) == 0)                          # 100% off absorbs anything
ok &= (keep(50, 50) == Rational(1, 4))              # carry_case: not free, 25% left

# ---------------------------------------------------------------- 4. just OUTSIDE the stated domain
# The claim restricts to 0<=a,b<=100 and to percentage-off-running-price.
# Confirm the restriction is doing real work, i.e. the excluded cases are
# genuinely different, so the boundary is drawn honestly.
# (a) a fixed-amount coupon is NOT reproduced by any keep-fraction rule:
#     "10 off then 80% off" depends on the starting price, keep-fractions do not.
def fixed_then_pct(p):
    return (p - 10) * Rational(20, 100)
ok &= (fixed_then_pct(100) / 100 != fixed_then_pct(200) / 200)   # price-dependent
# (b) a coupon computed on the ORIGINAL price differs from the stacked rule:
#     100 -> 10% off -> 90, then 80% of ORIGINAL 100 = 80 off -> 10, not 18.
ok &= (Rational(100) * (1 - Rational(10, 100)) - Rational(100) * Rational(80, 100) == 10)
ok &= (10 != 18)                                     # so exclusion (b) is necessary
# (c) outside the range the keep-fraction leaves [0,1], which is why the
#     claim caps at 100 -- verify it really does escape, i.e. the cap is not idle.
ok &= (keep(120, 0) < 0)
ok &= (keep(-20, 0) > 1)

# ---------------------------------------------------------------- 5. "any starting price", "any number of stacks"
for p in (Rational(1), Rational(4999, 100), Rational(12345, 7), Rational(1, 3)):
    ok &= (p * keep(10, 80) == p * Rational(18, 100))
    # three stacked discounts: keep multiplying
    q = p
    for pct in (10, 80, 25):
        q = q * (1 - Rational(pct, 100))
    ok &= (q == p * Rational(9, 10) * Rational(1, 5) * Rational(3, 4))

computed = f"{left_pct}% left, {off_pct}% off (100 -> {trail[1]} -> {trail[2]})"
print(json.dumps({"claim_id": CLAIM, "computed": computed, "agrees": bool(ok)}))
