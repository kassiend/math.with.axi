"""Generator's independent check for lesson `percentage-swap-commutativity`.

Confirms two things blind of the plan's narrative:
  1. The worked example: 6% of 76 equals 4.56.
  2. Universality claim: a% of b == b% of a for every integer pair (a, b) with
     0 <= a, b <= 100 — an exhaustive finite-domain SymPy check, per §3.2 of the
     brief. No whitelisted theorem exists for commutativity of multiplication in
     `core/verify/theorems.json`, so the claim stands on this enumeration.
"""

from sympy import Rational, simplify

LESSON_ID = "percentage-swap-commutativity"

# ---- 1. Worked example --------------------------------------------------------
a, b = 6, 76
computed = Rational(a, 100) * b            # exact: 6/100 * 76 = 456/100
expected = Rational(456, 100)              # 4.56 exactly
assert computed == expected, f"worked example failed: {computed} != {expected}"

# Swap must give the same value.
swapped = Rational(b, 100) * a
assert swapped == computed, f"swap disagrees: {swapped} != {computed}"

# ---- 2. Universality over the finite domain the viewer meets in practice ------
# a% of b := (a/100) * b; b% of a := (b/100) * a. Enumerate every pair.
disagreements = []
for x in range(0, 101):
    for y in range(0, 101):
        left = Rational(x, 100) * y
        right = Rational(y, 100) * x
        if simplify(left - right) != 0:
            disagreements.append((x, y, left, right))
assert not disagreements, f"universality failed on {len(disagreements)} pair(s)"

# Format the reported result the way the plan shows it on screen.
result_str = f"{float(expected):.2f}"       # "4.56"

import json
print(json.dumps({"claim_id": LESSON_ID, "computed": result_str, "agrees": computed == expected}))
