"""Generator check — difference of squares factoring.

Confirms:
  1. The worked example: 55² − 30² = 2125, and (55+30)(55−30) = 85 × 25 = 2125.
  2. The intermediate arithmetic: 55 + 30 = 85, 55 − 30 = 25, 85 × 25 = 2125.
  3. The universality claim declared in the plan (carry_case is null):
     for symbolic a, b, (a+b)(a−b) expands to a² − b² — i.e. the identity is a
     polynomial identity and has no exception. Also confirmed exhaustively on a
     stated finite integer domain.

The last line prints the JSON report the orchestrator consumes. Nothing after it.
"""

import json
from sympy import symbols, expand, simplify

LESSON_ID = "difference-of-squares-factoring"

A = 55
B = 30
EXPECTED_SUM = 85
EXPECTED_DIFF = 25
EXPECTED_RESULT = 2125

# --- 1. Worked example (direct) --------------------------------------------
direct = A * A - B * B
assert direct == EXPECTED_RESULT, f"direct: {A}² − {B}² = {direct}, expected {EXPECTED_RESULT}"

# --- 2. Worked example (factored) ------------------------------------------
s = A + B
d = A - B
assert s == EXPECTED_SUM, f"sum: {A} + {B} = {s}, expected {EXPECTED_SUM}"
assert d == EXPECTED_DIFF, f"diff: {A} − {B} = {d}, expected {EXPECTED_DIFF}"

factored = s * d
assert factored == EXPECTED_RESULT, (
    f"factored: ({A}+{B})({A}−{B}) = {s} × {d} = {factored}, expected {EXPECTED_RESULT}"
)
assert factored == direct, "factored and direct disagree — identity has failed on the worked pair"

# --- 3. Universality: symbolic identity ------------------------------------
a, b = symbols("a b")
identity_diff = simplify(expand((a + b) * (a - b)) - (a ** 2 - b ** 2))
assert identity_diff == 0, f"symbolic identity failed: residue {identity_diff}"

# --- 4. Universality: exhaustive on a finite integer domain ----------------
DOMAIN_LO, DOMAIN_HI = -100, 100
for x in range(DOMAIN_LO, DOMAIN_HI + 1):
    for y in range(DOMAIN_LO, DOMAIN_HI + 1):
        lhs = x * x - y * y
        rhs = (x + y) * (x - y)
        assert lhs == rhs, f"identity fails at (a, b) = ({x}, {y}): lhs {lhs}, rhs {rhs}"

report = {
    "claim_id": LESSON_ID,
    "computed": str(EXPECTED_RESULT),
    "agrees": direct == EXPECTED_RESULT and factored == EXPECTED_RESULT,
}
print(json.dumps(report))
