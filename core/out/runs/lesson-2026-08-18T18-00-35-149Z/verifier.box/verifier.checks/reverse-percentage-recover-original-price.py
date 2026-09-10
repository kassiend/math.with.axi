"""Independent verification of claim `reverse-percentage-recover-original-price`.

Derived solely from the payload's stated claim:

    For every real P > 0 and every d with 0 <= d < 100,
        P = S / (1 - d/100)   where   S = P * (1 - d/100).

    Worked example: S = 68, d = 80  =>  P = 340.
    carry_case: d = 100 -> keeper 0 -> undefined (division by zero), and the
    map P -> S collapses (non-injective), so no method can recover P.
    Secondary claim: S * (1 + d/100) < P for every d in 1..99 (adding back fails).

All arithmetic in exact rationals / symbolics. No floats used for any verdict.
"""

import json
from fractions import Fraction

import sympy as sp

FAILS = []


def check(label, ok, extra=""):
    if not ok:
        FAILS.append(f"{label}{(' :: ' + extra) if extra else ''}")
    return ok


def keeper(d):
    """Fraction of the ticket price still paid."""
    return 1 - Fraction(d) / 100


# ---------------------------------------------------------------- 1. worked example
# Recompute the headline result from the two operands the card shows the viewer:
# sale price S = 68 and discount d = 80.  Nothing else is assumed.
S_ex, d_ex = Fraction(68), Fraction(80)
k_ex = keeper(d_ex)                      # 1 - 80/100 = 1/5
computed = S_ex / k_ex                   # 68 / (1/5)

check("worked_example.keeper == 1/5", k_ex == Fraction(1, 5), str(k_ex))
check("worked_example.result == 340", computed == 340, str(computed))
# round trip the other way, independently of the division above
check("round_trip 340*(1-80/100) == 68", Fraction(340) * k_ex == 68)
# the card's own restatement in step s4: 340 - 80% of 340 == 68
check("s4 340 - 0.8*340 == 68", Fraction(340) - Fraction(80, 100) * 340 == 68)
# step s3 asserts the shortcut  / 0.2  ==  * 5
check("s3 divide-by-0.2 equals times-5", S_ex / Fraction(2, 10) == S_ex * 5)
# step s2 asserts 100 - 80 = 20 and 20% -> 0.2
check("s2 100-80=20 and 20% == 0.2", (100 - 80) == 20 and Fraction(20, 100) == Fraction(2, 10))

# ---------------------------------------------------------------- 2. symbolic identity
P, d = sp.symbols("P d", real=True)
k_sym = 1 - d / 100
recovered = sp.simplify((P * k_sym) / k_sym)
check("symbolic P*k/k == P for k != 0", sp.simplify(recovered - P) == 0, str(recovered))

# ---------------------------------------------------------------- 3. exhaustive: the DRAWN grid
# The payload declares the draw domain: P = 10t, t in [3,40]; d = 10k, k in [1,9].
# If any member of that grid broke the rule, the "no filter applied" claim would
# be hiding a failure.  Test every single one.
drawn_grid_ok = True
for t in range(3, 41):
    for kk in range(1, 10):
        Pv, dv = Fraction(10 * t), 10 * kk
        Sv = Pv * keeper(dv)
        if Sv / keeper(dv) != Pv:
            drawn_grid_ok = False
        # the DECLARED presentational reason for the ranges: S is always a whole
        # number of pounds, i.e. no card ever has to render pence.
        if Sv.denominator != 1 or Sv != t * (10 - kk):
            drawn_grid_ok = False
check("exhaustive over declared draw grid (342 cells): rule exact & S integral", drawn_grid_ok)

# the drawn values actually lie inside the declared ranges
check("drawn k=8 in [1,9]", 1 <= 8 <= 9)
check("drawn t=34 in [3,40]", 3 <= 34 <= 40)
check("drawn maps give d=80, P=340, S=68", 10 * 8 == 80 and 10 * 34 == 340
      and Fraction(340) * keeper(80) == 68)

# ---------------------------------------------------------------- 4. exhaustive: the WIDER claim
# Payload claims verification over d in 0..99, P in 1..500 in exact rationals.
wider_ok = True
for dv in range(0, 100):
    kv = keeper(dv)
    if kv <= 0:
        wider_ok = False
        break
    for Pv in range(1, 501):
        Sv = Fraction(Pv) * kv
        if Sv / kv != Pv:
            wider_ok = False
            break
    if not wider_ok:
        break
check("exhaustive d=0..99 x P=1..500 in exact rationals", wider_ok)

# ---------------------------------------------------------------- 5. escaping the stated domain
# Non-integer d and non-integer P are covered by "every real P > 0", so probe them.
for dv in [Fraction(1, 3), Fraction(100, 3), Fraction(4999, 50), Fraction(9999, 100)]:
    for Pv in [Fraction(1999, 100), Fraction(1, 7), Fraction(100000, 1)]:
        Sv = Pv * keeper(dv)
        check(f"non-integer probe d={dv} P={Pv}", Sv / keeper(dv) == Pv)

# d = 0 boundary (inside the claimed range): keeper 1, sale price == ticket price
check("d=0 boundary: keeper==1 and S==P", keeper(0) == 1 and Fraction(340) * keeper(0) == 340)

# just inside the upper edge: d = 99.99 still recovers exactly in rationals
d_edge = Fraction(9999, 100)
check("d=99.99 still exact", (Fraction(340) * keeper(d_edge)) / keeper(d_edge) == 340)

# ---------------------------------------------------------------- 6. the carry_case must actually break it
# (a) keeper is exactly zero at d = 100
check("carry_case keeper(100) == 0", keeper(100) == 0)
# (b) the rule's own instruction is a division by zero
div_by_zero = False
try:
    _ = Fraction(0) / keeper(100)
except ZeroDivisionError:
    div_by_zero = True
check("carry_case d=100 raises ZeroDivisionError", div_by_zero)
# (c) the stronger claim: the map collapses, so recovery is impossible in principle.
#     Two distinct prices named on the card must give the same sale price.
check("carry_case collapse: 340 and 5 both map to 0",
      Fraction(340) * keeper(100) == 0 and Fraction(5) * keeper(100) == 0)
# (d) the collapse is total across the whole drawn price range
check("carry_case collapse over all drawn prices",
      all(Fraction(10 * t) * keeper(100) == 0 for t in range(3, 41)))
# (e) and d=100 is genuinely OUTSIDE the stated applicability [0,100) -- i.e. the
#     applicability condition really does exclude the counterexample.
check("carry_case excluded by stated condition d<100", not (0 <= 100 < 100))

# ---------------------------------------------------------------- 7. the "add it back" failure
# Claim: S*(1+d/100) = P*(1-(d/100)^2) < P for EVERY d strictly in (0,100).
addback_ok = True
for dv in range(1, 100):
    kv = keeper(dv)
    for Pv in [Fraction(340), Fraction(1), Fraction(9999, 100)]:
        Sv = Pv * kv
        back = Sv * (1 + Fraction(dv) / 100)
        if not (back < Pv):
            addback_ok = False
        if back != Pv * (1 - (Fraction(dv) / 100) ** 2):
            addback_ok = False
check("add-back strictly short of P for all d in 1..99", addback_ok)
# and it is NOT short at d = 0, which is why the claim says "strictly between"
check("add-back exact at d=0 (justifies 'strictly between')",
      Fraction(340) * keeper(0) * (1 + Fraction(0, 100)) == 340)
# the card's caveat arithmetic: 68 * 1.8 = 122.40
check("caveat 68*1.8 == 122.40", Fraction(68) * Fraction(18, 10) == Fraction(1224, 10))
# and that it matches the P*(1-(d/100)^2) formula quoted in applicability
check("caveat matches P*(1-(d/100)^2)",
      Fraction(340) * (1 - (Fraction(80, 100)) ** 2) == Fraction(1224, 10))
# the true shortfall (for the record): 340 - 122.40 = 217.60
shortfall = Fraction(340) - Fraction(1224, 10)
check("shortfall is 217.60 not 122.40", shortfall == Fraction(2176, 10), str(shortfall))

# ---------------------------------------------------------------- verdict
agrees = (computed == 340) and not FAILS
print(json.dumps({
    "claim_id": "reverse-percentage-recover-original-price",
    "computed": str(computed),
    "agrees": agrees,
}))
if FAILS:
    import sys
    print("FAILURES: " + " | ".join(FAILS), file=sys.stderr)
