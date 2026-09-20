"""Generator check — divisibility by 4 via the last two digits.

Confirms:
  1. The worked example: 552 ÷ 4 = 138 with remainder 0.
  2. The intermediate claim: 552's last two digits form 52, and 52 = 4 × 13.
  3. The universality claim declared in the plan (carry_case is null):
     for every n in [0, 10000], 4 | n iff 4 | (n mod 100).

The last line prints the JSON report the orchestrator consumes.
"""

import json
from sympy import symbols, simplify, Mod

LESSON_ID = "divisibility-by-4-last-two-digits"

N = 552
DIVISOR = 4
EXPECTED_QUOTIENT = 138
EXPECTED_LAST_TWO = 52

# --- 1. Worked example ------------------------------------------------------
quotient, remainder = divmod(N, DIVISOR)
assert remainder == 0, f"{N} is not divisible by {DIVISOR} (remainder {remainder})"
assert quotient == EXPECTED_QUOTIENT, (
    f"quotient mismatch: {N} / {DIVISOR} = {quotient}, expected {EXPECTED_QUOTIENT}"
)

# --- 2. Intermediate step ---------------------------------------------------
last_two = N % 100
assert last_two == EXPECTED_LAST_TWO, f"last two of {N} is {last_two}, expected {EXPECTED_LAST_TWO}"
assert last_two % DIVISOR == 0, f"{last_two} is not divisible by {DIVISOR}"
assert last_two // DIVISOR == 13, f"{last_two} / {DIVISOR} != 13"

# --- 3. Universality of the rule -------------------------------------------
# Algebraic sanity via SymPy: Mod(n, 4) == Mod(Mod(n, 100), 4) for symbolic n.
n = symbols("n", integer=True)
assert simplify(Mod(n, 4) - Mod(Mod(n, 100), 4)) == 0, "symbolic identity failed"

# Exhaustive numeric confirmation over a stated finite domain.
DOMAIN_MAX = 10000
for k in range(0, DOMAIN_MAX + 1):
    lhs = (k % DIVISOR == 0)
    rhs = ((k % 100) % DIVISOR == 0)
    assert lhs == rhs, f"rule fails at n={k}: 4|n is {lhs} but 4|(n mod 100) is {rhs}"

report = {
    "claim_id": LESSON_ID,
    "computed": str(quotient),
    "agrees": quotient == EXPECTED_QUOTIENT,
}
print(json.dumps(report))
