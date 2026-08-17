"""Generator-side independent SymPy check for lesson square-two-digit-ending-in-5.

Confirms two things:
  1. The worked example: 95^2 == 9025.
  2. The universality claim recorded in nulls[]: for every n in {1, ..., 9},
     (10n + 5)^2 equals 100 * n * (n + 1) + 25 exactly (no carry case exists
     across the stated finite two-digit domain).

Emits exactly one line of JSON to stdout and nothing else.
"""

import json

from sympy import Integer, Symbol, expand, simplify

# --- 1. Universality check over the stated finite domain n in {1, ..., 9} ---
# Compare the direct square (10n + 5)^2 with the shortcut 100 * n * (n + 1) + 25
# for every n in the domain. Also verify the algebraic identity symbolically.
n_sym = Symbol("n", integer=True)
identity_ok = simplify(expand((10 * n_sym + 5) ** 2) - (100 * n_sym * (n_sym + 1) + 25)) == 0

domain_ok = True
for n in range(1, 10):
    lhs = Integer(10 * n + 5) ** 2
    rhs = Integer(100) * Integer(n) * Integer(n + 1) + Integer(25)
    if lhs != rhs:
        domain_ok = False
        break

# --- 2. Worked example: 95^2 ---
n_worked = 9
operand = 10 * n_worked + 5  # == 95
computed_int = Integer(operand) ** 2  # SymPy-independent computation of 95^2
shortcut_int = Integer(100) * Integer(n_worked) * Integer(n_worked + 1) + Integer(25)

worked_ok = computed_int == Integer(9025) and shortcut_int == computed_int

agrees = bool(identity_ok and domain_ok and worked_ok)
computed = str(int(computed_int))

print(json.dumps({
    "claim_id": "square-two-digit-ending-in-5",
    "computed": computed,
    "agrees": agrees,
}))
