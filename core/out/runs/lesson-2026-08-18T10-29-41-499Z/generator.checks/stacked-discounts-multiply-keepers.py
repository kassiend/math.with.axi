"""
Planner-side check for lesson `stacked-discounts-multiply-keepers` (Math tricks #5).

Confirms, from the STATED RULE and not by re-walking the display steps:
  1. the worked example 10% off then 80% off leaves 18% (82% off),
  2. the applicability claim: for all a, b in [0, 100] the price left after a% off then
     b% off is (1 - a/100)(1 - b/100) of the original, exactly, and order-independent
     - symbolically, and exhaustively over the declared finite integer domain,
  3. the carry_case: the "add the discounts" rule fails at the drawn example and at
     50/50, and agrees with the true rule only when one discount is 0.
"""

from fractions import Fraction

import sympy as sp

FAIL = []


def check(label, ok):
    print(("PASS  " if ok else "FAIL  ") + label)
    if not ok:
        FAIL.append(label)


# ---------------------------------------------------------------- 1. worked example
# Computed straight from the definition of a discount (price times what is left),
# with exact rationals, not from the card's 0.9 x 0.2.
price = Fraction(100)
after_first = price * (1 - Fraction(10, 100))
after_second = after_first * (1 - Fraction(80, 100))

check("100 -> 10% off -> 90", after_first == 90)
check("90 -> 80% off -> 18", after_second == 18)
check("fraction of price left = 18/100", after_second / price == Fraction(18, 100))
check("total discount = 82%", 100 * (1 - after_second / price) == 82)

# same thing on an arbitrary symbolic price: the result must be price-independent
P = sp.symbols("P", positive=True)
left_sym = sp.simplify(P * sp.Rational(90, 100) * sp.Rational(20, 100) / P)
check("price-independent: fraction left = 9/50 for any P", left_sym == sp.Rational(9, 50))

# ------------------------------------------------------- 2. applicability, symbolic
a, b, Pp = sp.symbols("a b Pp")
stated = Pp * (1 - a / 100) * (1 - b / 100)          # the rule as stated on the card
sequential = (Pp * (1 - a / 100)) * (1 - b / 100)    # discounts actually applied in turn
check("symbolic: keep-product == sequential application",
      sp.simplify(stated - sequential) == 0)

total_off = sp.simplify(100 * (1 - stated / Pp))
check("symbolic: total discount = a + b - ab/100",
      sp.simplify(total_off - (a + b - a * b / 100)) == 0)

reversed_order = Pp * (1 - b / 100) * (1 - a / 100)
check("symbolic: order does not matter", sp.simplify(stated - reversed_order) == 0)

# ------------------------------------- 2b. applicability, exhaustive on the declared
# finite domain: all integer percentages a, b in 0..100, exact rational arithmetic.
ok_all = True
for ai in range(0, 101):
    ka = 1 - Fraction(ai, 100)
    for bi in range(0, 101):
        kb = 1 - Fraction(bi, 100)
        seq = (Fraction(100) * ka) * kb          # apply one after the other
        rule = Fraction(100) * (ka * kb)         # multiply the keepers
        off = ai + bi - Fraction(ai * bi, 100)   # closed form for total % off
        if seq != rule or 100 - seq != off or seq < 0:
            ok_all = False
            print("   counterexample:", ai, bi, seq, rule, off)
            break
    if not ok_all:
        break
check("exhaustive a,b in 0..100 (10201 pairs): rule exact, closed form matches", ok_all)

# --------------------------------------------------------------- 3. the carry case
naive = 10 + 80                                   # "add the discounts"
true_off = 100 - (100 * Fraction(90, 100) * Fraction(20, 100))
check("carry_case: adding gives 90% off but the truth is 82% off",
      naive == 90 and true_off == 82 and naive != true_off)

fifty = Fraction(100) * Fraction(50, 100) * Fraction(50, 100)
check("carry_case: 50% then 50% leaves 25, not 0", fifty == 25 and (50 + 50) == 100)

# adding equals multiplying-the-keepers exactly when one discount is zero
agree_nonzero = [
    (ai, bi)
    for ai in range(0, 101)
    for bi in range(0, 101)
    if ai + bi == ai + bi - Fraction(ai * bi, 100) and ai != 0 and bi != 0
]
check("carry_case: add-rule agrees only when a = 0 or b = 0", agree_nonzero == [])

# and it is wrong for EVERY pair of nonzero discounts (never accidentally right)
always_wrong = all(
    (ai + bi) != (ai + bi - Fraction(ai * bi, 100))
    for ai in range(1, 101)
    for bi in range(1, 101)
)
check("carry_case: add-rule wrong for all 10000 nonzero pairs", always_wrong)

print()
print("RESULT:", "ALL CHECKS PASSED" if not FAIL else "FAILED -> " + "; ".join(FAIL))
raise SystemExit(0 if not FAIL else 1)
