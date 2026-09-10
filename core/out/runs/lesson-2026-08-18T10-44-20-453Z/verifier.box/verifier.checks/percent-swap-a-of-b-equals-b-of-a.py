"""Independent verification of lesson `percent-swap-a-of-b-equals-b-of-a`.

Derived from the payload's CLAIMS only:
  applicability : for real a, b :  a% of b == b% of a, both equal a*b/100
  worked example: operands (3, 125) -> "3.75"
  display step  : 125% of 3 == 3 + 0.75
  carry case    : 'off' does NOT swap; 20% off 50 = 40, 50% off 20 = 10,
                  and a% off b == b% off a only when a == b.

Everything is done in exact arithmetic (Rational) or symbolically; no floats
are used for any decision.
"""

import json
import random

import sympy as sp

CLAIM_ID = "percent-swap-a-of-b-equals-b-of-a"

failures = []


def pct_of(a, b):
    """a% of b, by the definition of 'percent of': (a/100) * b."""
    return sp.Rational(a, 100) * b if not isinstance(a, sp.Expr) else (a / 100) * b


def pct_off(a, b):
    """a% off b: remove a% of b from b."""
    return b - (a / 100) * b if isinstance(a, sp.Expr) or isinstance(b, sp.Expr) \
        else b - sp.Rational(a, 100) * b


# ---------------------------------------------------------------- 1. worked example
lhs = sp.Rational(3, 100) * 125          # 3% of 125, straight from the definition
if lhs != sp.Rational(15, 4):
    failures.append(f"worked example value {lhs} != 15/4")

computed = str(sp.nsimplify(lhs))        # exact
computed_decimal = "3.75" if lhs == sp.Rational(375, 100) else str(sp.Float(lhs))

if computed_decimal != "3.75":
    failures.append(f"worked example decimal {computed_decimal} != stated 3.75")

# ---------------------------------------------------------------- 2. the swap itself
swapped = sp.Rational(125, 100) * 3      # 125% of 3
if swapped != lhs:
    failures.append(f"swap failed on the worked example: {swapped} != {lhs}")

# display step s3 asserts 125% of 3 = 3 + 0.75
if swapped != 3 + sp.Rational(3, 4):
    failures.append(f"step s3 decomposition wrong: {swapped} != 3 + 3/4")

# ---------------------------------------------------------------- 3. universality over the REALS
a, b = sp.symbols("a b", real=True)
identity = sp.simplify(pct_of(a, b) - pct_of(b, a))
if identity != 0:
    failures.append(f"symbolic identity a% of b - b% of a did not vanish: {identity}")
# and that both sides really are a*b/100 as the payload asserts
if sp.simplify(pct_of(a, b) - a * b / 100) != 0:
    failures.append("a% of b is not a*b/100 symbolically")

# ---------------------------------------------------------------- 4. boundary + just outside it
#    the payload claims NO exception for real a,b, so probe hard.
probes = [
    (0, 0), (0, 5), (5, 0),                      # zero
    (1, 1), (100, 7), (7, 100),                  # unit / identity-ish
    (-3, 125), (3, -125), (-3, -125),            # negatives (outside any 'positive' reading)
    (sp.Rational(1, 3), sp.Rational(7, 11)),     # non-integers
    (sp.Rational(-22, 7), sp.pi),                # irrational operand
    (sp.sqrt(2), sp.E),                          # both irrational
    (10**12, sp.Rational(1, 10**12)),            # extreme magnitudes
    (2, 9), (2, 2), (9, 9),                      # the declared draw range endpoints
    (1, 10), (0, 1),                             # just outside the declared draw range
]
for x, y in probes:
    d = sp.simplify(pct_of(x, y) - pct_of(y, x))
    if d != 0:
        failures.append(f"swap FAILED at (a={x}, b={y}): difference {d}")

# randomised exact-rational sweep, no floats
rng = random.Random(20260818)
for _ in range(4000):
    x = sp.Rational(rng.randint(-10**6, 10**6), rng.randint(1, 1000))
    y = sp.Rational(rng.randint(-10**6, 10**6), rng.randint(1, 1000))
    if pct_of(x, y) != pct_of(y, x):
        failures.append(f"random swap failure at ({x}, {y})")
        break

# ---------------------------------------------------------------- 5. the carry case ('off')
if pct_off(20, 50) != 40:
    failures.append(f"20% off 50 = {pct_off(20, 50)}, payload says 40")
if pct_off(50, 20) != 10:
    failures.append(f"50% off 20 = {pct_off(50, 20)}, payload says 10")
if pct_off(20, 50) == pct_off(50, 20):
    failures.append("carry case does not actually break: 'off' swapped equally")

# 'a% off b = b% off a only when a = b'  -> solve exactly
sols = sp.solve(sp.Eq(pct_off(a, b), pct_off(b, a)), b, dict=True)
if sols != [{b: a}]:
    failures.append(f"'off' equality solution set is {sols}, not exactly b = a")
# confirm the claim is an iff: equal when a==b, unequal whenever a!=b
if sp.simplify(pct_off(a, a) - pct_off(a, a)) != 0:
    failures.append("'off' not reflexive")
diff_off = sp.simplify(pct_off(a, b) - pct_off(b, a))
if sp.simplify(diff_off - (b - a)) != 0:
    failures.append(f"'off' difference is {diff_off}, expected b - a")

# ---------------------------------------------------------------- 6. does the shortcut respect 'of' vs 'off' separation
# a% of b == b% of a must hold even where 'off' fails, e.g. (20, 50)
if pct_of(20, 50) != pct_of(50, 20):
    failures.append("'of' swap failed on the very pair used for the 'off' caveat")

print(json.dumps({
    "claim_id": CLAIM_ID,
    "computed": computed_decimal,
    "agrees": not failures,
    **({"failures": failures} if failures else {}),
}))
