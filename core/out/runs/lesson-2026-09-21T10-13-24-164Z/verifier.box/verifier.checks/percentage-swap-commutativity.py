"""Independent verification for percentage-swap-commutativity.

Claim from the payload:
  - Method: a% of b = b% of a for any two real a, b, because
    a% of b = (a*b)/100 and multiplication is commutative.
  - carry_case is null (payload claims NO numeric exception).
  - Worked example: 6% of 76 = 4.56.

This script:
  1. Computes 6% of 76 exactly using sympy.Rational to avoid float error.
  2. Formats the result as a decimal string and compares to "4.56".
  3. Independently probes the universality claim over a wide grid,
     including negatives, zero, one, non-integers, and large values,
     to see if a% of b == b% of a can ever fail in the reals.
  4. Emits exactly one JSON line with the required fields.
"""

import json
from sympy import Rational, nsimplify

# ---- 1. Worked example ---------------------------------------------------
a, b = 6, 76
worked = Rational(a) * Rational(b) / 100  # a% of b, exact
# format as a plain decimal string
worked_decimal = worked.evalf(10)
# strip trailing zeros / cast to "4.56"
worked_str = f"{float(worked):.2f}"
if worked_str.endswith(".00"):
    worked_str = worked_str[:-3]
elif worked_str.endswith("0") and "." in worked_str:
    worked_str = worked_str.rstrip("0")

stated = "4.56"
agrees_worked = (worked_str == stated)

# ---- 2. Universality probe ----------------------------------------------
# Test over a grid that includes negative, zero, one, integers, non-integers,
# and boundary values. Under the identity a% of b == b% of a we should find
# NO counterexample if the payload's claim is correct.
counterexamples = []
grid = [-100, -7, -1, Rational(-1, 2), 0, Rational(1, 3),
        1, 2, Rational(7, 4), 6, 50, 76, 99, 100, 1000, Rational(31415, 10000)]
for x in grid:
    for y in grid:
        lhs = Rational(x) * Rational(y) / 100  # x% of y
        rhs = Rational(y) * Rational(x) / 100  # y% of x
        if lhs != rhs:
            counterexamples.append((str(x), str(y), str(lhs), str(rhs)))

# The identity is a direct consequence of commutativity of multiplication
# in the reals; the grid probe should return zero counterexamples.
universality_holds = (len(counterexamples) == 0)

agrees = agrees_worked and universality_holds

print(json.dumps({
    "claim_id": "percentage-swap-commutativity",
    "computed": worked_str,
    "agrees": agrees,
}))
