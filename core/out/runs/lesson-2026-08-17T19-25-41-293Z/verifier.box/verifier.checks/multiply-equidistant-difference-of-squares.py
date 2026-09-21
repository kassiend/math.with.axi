"""Independent verification of lesson `multiply-equidistant-difference-of-squares`.

Written from the payload's CLAIMS alone (applicability sentence, worked_example,
carry_case, steps, operand_draw), without reference to any generator-supplied script.

Claims under test
-----------------
C1  Worked example: 53 x 67 = 60^2 - 7^2 = 3600 - 49 = 3551, midpoint 60, half-gap 7.
C2  Applicability: for ANY two integers a,b with a+b even, m=(a+b)/2 and d=(a-b)/2
    are whole numbers and a*b = m^2 - d^2 exactly.
C3  Universality of the underlying identity (difference-of-squares read right-to-left).
C4  Boundary / just-outside-the-domain probing: negatives, zero, one, equal operands,
    odd sum (the excluded case), non-integers.
C5  carry_case internal consistency: 53 x 68 = 3551 + 53 = 3604, and 53+68 is odd so
    the stated applicability genuinely excludes it (counterexample must actually be
    excluded by the stated condition).
C6  Operand provenance: do the declared draws support the worked-example operands?

Prints exactly one JSON line; `agrees` is the verdict on the worked-example result C1.
"""

import json
from fractions import Fraction

import sympy as sp

failures = []
notes = {}

# ---------------------------------------------------------------- C1 worked example
a0, b0 = 53, 67
true_product = a0 * b0                     # computed from scratch
m0 = Fraction(a0 + b0, 2)
d0 = Fraction(a0 - b0, 2)                  # note: (a-b)/2 as the payload defines it

if true_product != 3551:
    failures.append(f"C1 product: 53*67 = {true_product}, payload says 3551")
if m0 != 60:
    failures.append(f"C1 midpoint: (53+67)/2 = {m0}, payload says 60")
if abs(d0) != 7:
    failures.append(f"C1 half-gap: |(53-67)/2| = {abs(d0)}, payload says 7")
if 60**2 - 7**2 != true_product:
    failures.append("C1 identity chain 60^2-7^2 does not equal 53*67")
if 60**2 != 3600 or 7**2 != 49 or 3600 - 49 != 3551:
    failures.append("C1 arithmetic in the displayed chain 3600-49=3551 is wrong")

notes["C1_worked_example"] = f"53*67={true_product}; 60^2-7^2={60**2-7**2}"

# ------------------------------------------------- C3 symbolic universality of identity
A, B = sp.symbols("A B")
M = (A + B) / 2
D = (A - B) / 2
if sp.simplify(M**2 - D**2 - A * B) != 0:
    failures.append("C3 identity ((a+b)/2)^2 - ((a-b)/2)^2 = a*b fails symbolically")
notes["C3_symbolic"] = "((a+b)/2)^2-((a-b)/2)^2 - a*b simplifies to 0"

# ------------------------------- C2/C4 exhaustive scan over a stated finite domain,
# deliberately including negatives, zero, one, and equal operands.
LO, HI = -40, 40
even_sum_checked = 0
integrality_violations = 0
for a in range(LO, HI + 1):
    for b in range(LO, HI + 1):
        s = a + b
        if s % 2 == 0:
            m = Fraction(s, 2)
            d = Fraction(a - b, 2)
            even_sum_checked += 1
            if m.denominator != 1 or d.denominator != 1:
                integrality_violations += 1
                failures.append(f"C2 integrality fails at a={a}, b={b}")
            if m * m - d * d != a * b:
                failures.append(f"C2 product identity fails at a={a}, b={b}")

notes["C2_scan"] = (
    f"all integer pairs in [{LO},{HI}]^2 with even sum: {even_sum_checked} pairs, "
    f"integrality violations {integrality_violations}, identity violations 0"
)

# Explicit boundary witnesses the applicability sentence must survive.
boundary = [(-5, -3), (0, 4), (0, 0), (1, 1), (7, 7), (-3, 3), (1, -1), (2, -8)]
for a, b in boundary:
    m = Fraction(a + b, 2)
    d = Fraction(a - b, 2)
    if m.denominator != 1 or d.denominator != 1 or m * m - d * d != a * b:
        failures.append(f"C4 boundary case fails at a={a}, b={b}")
notes["C4_boundary"] = "negatives, zero, one, equal operands, sign-straddling pairs all hold"

# ---- C4 just OUTSIDE the stated domain: odd sum. The whole-number form must break,
# while the underlying identity survives over the rationals (as the payload implies).
odd_break = 0
odd_identity_ok = 0
for a in range(LO, HI + 1):
    for b in range(LO, HI + 1):
        if (a + b) % 2 != 0:
            m = Fraction(a + b, 2)
            d = Fraction(a - b, 2)
            if m.denominator == 2 and d.denominator == 2:
                odd_break += 1          # correctly NOT whole numbers
            if m * m - d * d == a * b:
                odd_identity_ok += 1    # identity still true over Q
total_odd = sum(
    1 for a in range(LO, HI + 1) for b in range(LO, HI + 1) if (a + b) % 2
)
if odd_break != total_odd or odd_identity_ok != total_odd:
    failures.append("C4 odd-sum characterisation is not exactly the non-integer case")
notes["C4_outside_domain"] = (
    f"all {total_odd} odd-sum pairs give half-integer m,d (so the whole-number method is "
    "genuinely excluded) while the rational identity still holds -> the applicability "
    "condition is exactly right, neither too wide nor too narrow"
)

# ------------------------------------------------------------------ C5 carry case
cc_true = 53 * 68
if cc_true != 3604:
    failures.append(f"C5 53*68 = {cc_true}, payload says 3604")
if 3551 + 53 != 3604:
    failures.append("C5 adjustment 3551+53 != 3604")
if (53 + 68) % 2 == 0:
    failures.append("C5 carry_case is NOT excluded by the stated applicability condition")
notes["C5_carry_case"] = (
    f"53*68={cc_true}; 53+68={53+68} is odd so the stated condition does exclude it; "
    "the +53 adjustment (shifting b by 1 adds a) is correct"
)

# --------------------------------------------------------------- C6 operand provenance
spec_min, spec_max, max_digits = 2, 9, 1
draws = [6, 7]
operands = [53, 67]
draws_in_spec = all(spec_min <= x <= spec_max and len(str(abs(x))) <= max_digits for x in draws)
operands_in_spec = all(
    spec_min <= x <= spec_max and len(str(abs(x))) <= max_digits for x in operands
)
provenance_ok = (draws == operands)
# Kept OUT of `failures` on purpose: `agrees` must report on the arithmetic claim only,
# so that a provenance defect is not misread as an arithmetic error. Reported separately.
provenance_failures = []
if not provenance_ok:
    provenance_failures.append(
        f"C6 declared draws {draws} are not the worked-example operands {operands}; "
        f"operands satisfy declared spec: {operands_in_spec}"
    )
notes["C6_provenance"] = (
    f"draws {draws} lie in declared spec [2,9]/1-digit: {draws_in_spec}; "
    f"operands {operands} lie in declared spec: {operands_in_spec}; draws==operands: {provenance_ok}"
)

# ------------------------------------------------------- C1 display-step reachability
# Can a viewer reach 3551 from the printed strings alone, in order?
# s3 prints "60^2 - 7^2 = 3600 - 49"; s4 prints "3551". The subtraction 3600-49 is
# never displayed as a performed step.
displayed_values = [3600, 49, 3551]
step_gap = (3600 - 49 == 3551)  # true, but performed off-screen by the viewer
notes["display_steps"] = (
    "s2 asserts the midpoint 60 without showing (53+67)/2; s3 stops at '3600 - 49' and "
    f"s4 jumps to 3551 -- the subtraction is correct ({step_gap}) but is never shown"
)

computed = str(true_product)
agrees = (computed == "3551") and not failures

import sys
for k, v in notes.items():
    print(f"[diag] {k}: {v}", file=sys.stderr)
for f in failures:
    print(f"[FAIL] {f}", file=sys.stderr)
for f in provenance_failures:
    print(f"[PROVENANCE-FAIL] {f}", file=sys.stderr)

print(json.dumps({
    "claim_id": "multiply-equidistant-difference-of-squares",
    "computed": computed,
    "agrees": agrees,
}))
