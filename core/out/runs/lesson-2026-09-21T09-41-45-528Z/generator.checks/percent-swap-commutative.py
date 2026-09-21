"""Generator-side check for the 'Flip the percent' lesson.

Confirms two things:
  1. The worked example 7% of 20 = 1.4 evaluates as claimed under the rule.
  2. The universality claim (a% of b == b% of a) holds exhaustively over the
     stated finite domain of integers a, b in [1, 200], using SymPy rationals
     so there is no floating-point wiggle room.

Prints exactly one JSON line at the very end, and nothing after it.
"""

import json
from sympy import Rational

LESSON_ID = "percent-swap-commutative"

# --- 1. Worked example -------------------------------------------------------
a, b = 7, 20
expected = Rational(14, 10)  # 1.4 exactly, as a rational

lhs = Rational(a, 100) * b   # a% of b
rhs = Rational(b, 100) * a   # b% of a

assert lhs == expected, f"a% of b came out {lhs}, expected {expected}"
assert rhs == expected, f"b% of a came out {rhs}, expected {expected}"
assert lhs == rhs, "the swap identity failed on the worked example"

# --- 2. Universality sweep ---------------------------------------------------
# Exhaustive over integers a, b in [1, 200]. Per §3.2, universality needs
# either a whitelisted theorem or an exhaustive symbolic check over a stated
# finite domain; there is no direct commutativity theorem in
# core/verify/theorems.json, so we do the sweep.
DOMAIN_MIN, DOMAIN_MAX = 1, 200
mismatches = []
for x in range(DOMAIN_MIN, DOMAIN_MAX + 1):
    for y in range(DOMAIN_MIN, DOMAIN_MAX + 1):
        if Rational(x, 100) * y != Rational(y, 100) * x:
            mismatches.append((x, y))
            if len(mismatches) >= 5:
                break
    if mismatches:
        break
assert not mismatches, f"universality failed on: {mismatches}"

# The result string reported to the orchestrator matches worked_example.result
# in plan.out.json verbatim.
computed = "1.4"
agrees = (float(expected) == 1.4) and (lhs == rhs)

report = {"claim_id": LESSON_ID, "computed": computed, "agrees": bool(agrees)}
print(json.dumps(report))
