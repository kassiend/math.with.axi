"""Independent verification of the last-two-digits divisibility-by-4 rule.

Derived only from the claim in verifier.in.json:
  - Worked example: does 4 divide 552, and what is the quotient?
  - Universality: for every non-negative integer n, does
        (4 | n)  <->  (4 | (n mod 100))
    and is the quotient of the worked example correct?

We probe:
  * The worked example (552, divisor 4).
  * The universality claim on a wide range and at boundaries
    (0, 1, 3, 4, 50, 99, 100, 999, 1000, and some larger values).
  * Values just outside the stated non-negative domain (negatives),
    to see whether the applicability restriction is real.
"""

import json
from sympy import Integer, Mod

def divides(d, n):
    return Mod(n, d) == 0

# --- worked-example check --------------------------------------------------
n = 552
divisor = 4
last_two = n % 100
claimed_quotient = 138

# The lesson claim: 4 | 552 with quotient 138, obtained via last-two-digit rule.
rule_says_divides = divides(divisor, last_two)
actually_divides = divides(divisor, n)
worked_quotient = n // divisor
worked_ok = (
    rule_says_divides
    and actually_divides
    and worked_quotient == claimed_quotient
    and last_two == 52
)

# --- universality probe ----------------------------------------------------
# Test every n in [0, 10_000] plus scattered larger values and negatives.
probes = list(range(0, 10_001))
probes += [12_345, 99_999, 1_000_000, 1_000_002, 1_234_568]
negatives = [-1, -2, -3, -4, -52, -100, -552]

universal_ok = True
counterexample = None
for m in probes:
    lhs = (m % 4 == 0)
    rhs = ((m % 100) % 4 == 0)
    if lhs != rhs:
        universal_ok = False
        counterexample = m
        break

# Check that the equivalence also holds on negatives (Python's % is
# non-negative for positive modulus, matching the mathematical mod).
neg_ok = True
neg_counter = None
for m in negatives:
    lhs = (m % 4 == 0)
    rhs = ((m % 100) % 4 == 0)
    if lhs != rhs:
        neg_ok = False
        neg_counter = m
        break

agrees = bool(worked_ok and universal_ok and neg_ok)

print(json.dumps({
    "claim_id": "divisibility-by-4-last-two-digits",
    "computed": str(worked_quotient),
    "agrees": agrees,
    "_diagnostics": {
        "last_two_digits": int(last_two),
        "rule_says_divides": bool(rule_says_divides),
        "actually_divides": bool(actually_divides),
        "universality_counterexample_in_[0,10000]+extras": counterexample,
        "negative_domain_counterexample": neg_counter,
    },
}))
