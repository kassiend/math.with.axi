"""
Planner-side check for lesson `percent-of-commutes-swap-operands` (Math tricks #5).

Everything is computed from the STATED RULE and from the definition of "percent of",
never by re-walking the display steps:

  1. worked example: 88% of 75, taken straight from the definition (88/100)*75 in exact
     rational arithmetic, and the swapped form (75/100)*88, must both be 66;
  2. applicability: a% of b = b% of a for ALL real a, b - symbolically, and exhaustively
     over the declared finite integer domain 0..200 x 0..200 in exact rationals;
  3. carry_case: the swap is FALSE for percent OFF - 88% off 75 = 9 while 75% off 88 = 22 -
     and solving b - ab/100 = a - ab/100 shows it can only hold when a = b;
  4. the drawn operands really are the declared mappings of the recorded raw draws.

Prints exactly one JSON line: {"claim_id", "computed", "agrees", "checks"}.
"""

import json
from fractions import Fraction

import sympy as sp

checks = []


def check(label, ok):
    checks.append({"check": label, "ok": bool(ok)})
    return bool(ok)


# --------------------------------------------------------------- 1. worked example
# "a% of b" means (a/100) * b. Exact rationals, no floats anywhere.
A, B = 88, 75
direct = Fraction(A, 100) * B          # the question as posed
swapped = Fraction(B, 100) * A         # the question after the flip

check("88% of 75 = 66 straight from the definition", direct == 66)
check("75% of 88 = 66 straight from the definition", swapped == 66)
check("posed and flipped forms agree", direct == swapped)
check("answer is an exact integer", direct.denominator == 1)

computed = str(int(direct))            # "66"

# ------------------------------------------------- 2. applicability, symbolic (reals)
a, b = sp.symbols("a b", real=True)
lhs = a / 100 * b                       # a% of b
rhs = b / 100 * a                       # b% of a
check("symbolic: a% of b - b% of a simplifies to 0", sp.simplify(lhs - rhs) == 0)
check("symbolic: both equal a*b/100", sp.simplify(lhs - a * b / 100) == 0)
# no real pair makes them differ
check("symbolic: no solution to a% of b != b% of a",
      sp.solve(sp.Eq(lhs, rhs), dict=True) in ([{}], []) or sp.simplify(lhs - rhs) == 0)

# ------------------------- 2b. applicability, exhaustive over a declared finite domain
# Declared domain: every integer pair 0 <= a, b <= 200. Exact rational arithmetic.
exhaustive_ok = True
for ai in range(0, 201):
    for bi in range(0, 201):
        if Fraction(ai, 100) * bi != Fraction(bi, 100) * ai:
            exhaustive_ok = False
            break
    if not exhaustive_ok:
        break
check("exhaustive: identity holds for all integer pairs 0..200 x 0..200", exhaustive_ok)

# quarter-step values too, so the claim is not an integers-only artefact
quarter_ok = all(
    Fraction(x, 4) / 100 * Fraction(y, 4) == Fraction(y, 4) / 100 * Fraction(x, 4)
    for x in range(0, 401, 7)
    for y in range(0, 401, 11)
)
check("exhaustive: identity holds on quarter-valued grid too", quarter_ok)

# --------------------------------------------------------------- 3. carry_case: "off"
# "a% off b" means b - (a/100)*b. This is what the plan says the swap does NOT survive.
off_88_of_75 = 75 - Fraction(88, 100) * 75
off_75_of_88 = 88 - Fraction(75, 100) * 88
check("88% off 75 leaves 9", off_88_of_75 == 9)
check("75% off 88 leaves 22", off_75_of_88 == 22)
check("carry_case really breaks the swap: 9 != 22", off_88_of_75 != off_75_of_88)
check("the part removed is the same 66 in both",
      Fraction(88, 100) * 75 == 66 and Fraction(75, 100) * 88 == 66)

# and it breaks for every unequal pair, not just this one
sol = sp.solve(sp.Eq(b - a * b / 100, a - a * b / 100), dict=True)
check("symbolic: percent-off swap forces a = b",
      sp.simplify((b - a * b / 100) - (a - a * b / 100) - (b - a)) == 0
      and sol == [{a: b}] or sp.simplify((b - a * b / 100) - (a - a * b / 100)) == sp.simplify(b - a))
unequal_ok = all(
    (bj - Fraction(ai, 100) * bj) != (ai - Fraction(ai, 100) * bj) or ai == bj
    for ai in range(0, 101, 3)
    for bj in range(0, 101, 7)
)
check("exhaustive: percent-off swap fails for every sampled a != b", unequal_ok)

# ------------------------------------------------------- 4. operands match the draws
check("a = 4 * 22 = 88 as declared", 4 * 22 == A)
check("b = 25 * 3 = 75 as declared", 25 * 3 == B)

agrees = all(c["ok"] for c in checks) and computed == "66"

print(json.dumps({
    "claim_id": "percent-of-commutes-swap-operands",
    "computed": computed,
    "agrees": agrees,
    "checks": checks,
}))
