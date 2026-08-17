"""Generator-side independent SymPy check for lesson multiply-by-11-two-digit.

Confirms four claims from the plan, independently of the taught procedure:

  1. Worked example: 92 * 11 == 1012 (direct integer multiply, not by re-walking
     the trick — a script that reproduces the trick would reproduce its bug).

  2. Universality of the full rule over the applicability domain n in [10, 99]:
     writing n = 10a + b with a in {1,...,9}, b in {0,...,9},
       n * 11 == 100 * (a + c) + 10 * ((a + b) - 10 * c) + b
     where c = 1 if a + b >= 10 else 0. Confirmed symbolically for both
     branches and exhaustively for every n in the finite domain.

  3. Carry-case honesty: the simplified 'drop the digit sum between the digits'
     form equals n * 11 exactly when a + b < 10, and is not a valid decimal
     representation when a + b >= 10 — so `carry_case` documents a real
     limitation, not a rhetorical one.

  4. Carry-set enumeration in `carry_case` matches the true 45-element set.

Emits exactly one JSON line to stdout.
"""

import json

from sympy import Symbol, simplify, expand, Integer

# --- 1. Worked example ------------------------------------------------------
worked_product = Integer(92) * Integer(11)
worked_ok = worked_product == Integer(1012)

# --- 2a. Symbolic identity of the taught rule (both branches) ---------------
a = Symbol("a", integer=True)
b = Symbol("b", integer=True)
no_carry_expr = 100 * a + 10 * (a + b) + b                # branch: a + b < 10
carry_expr    = 100 * (a + 1) + 10 * (a + b - 10) + b     # branch: a + b >= 10
identity_no_carry = simplify(expand((10 * a + b) * 11) - no_carry_expr) == 0
identity_carry    = simplify(expand((10 * a + b) * 11) - carry_expr) == 0
identity_ok = bool(identity_no_carry and identity_carry)

# --- 2b. Exhaustive numeric check over [10, 99] -----------------------------
def taught_rule(n: int) -> int:
    """Reproduce n*11 by the exact split-add-carry procedure the lesson teaches."""
    a_val, b_val = divmod(n, 10)
    s = a_val + b_val
    carry, ones_of_sum = divmod(s, 10)  # carry in {0, 1} for two-digit inputs
    return (a_val + carry) * 100 + ones_of_sum * 10 + b_val

domain_ok = all(taught_rule(n) == n * 11 for n in range(10, 100))

# --- 3. Caveat honesty -------------------------------------------------------
def naive_drop_between(n: int):
    """The over-simplified rule: literally place (a+b) between a and b as a
    single digit. Returns None when a+b >= 10 (not a valid single digit)."""
    a_val, b_val = divmod(n, 10)
    s = a_val + b_val
    if s >= 10:
        return None
    return a_val * 100 + s * 10 + b_val

simple_matches_truth_iff_sum_lt_10 = True
for n in range(10, 100):
    a_val, b_val = divmod(n, 10)
    naive = naive_drop_between(n)
    truth = n * 11
    if a_val + b_val < 10:
        if naive != truth:
            simple_matches_truth_iff_sum_lt_10 = False
            break
    else:
        if naive is not None:  # would contradict a+b>=10
            simple_matches_truth_iff_sum_lt_10 = False
            break

# --- 3b. 92 is a genuine carry case -----------------------------------------
n = 92
a_val, b_val = divmod(n, 10)
carry_case_real = (a_val + b_val >= 10) and (naive_drop_between(n) is None)

# --- 4. Carry-set enumeration in the plan matches the true set --------------
claimed_carry = {19, 28, 29, 37, 38, 39, 46, 47, 48, 49,
                 55, 56, 57, 58, 59, 64, 65, 66, 67, 68, 69,
                 73, 74, 75, 76, 77, 78, 79, 82, 83, 84, 85,
                 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99}
actual_carry = {n for n in range(10, 100) if sum(divmod(n, 10)) >= 10}
carry_set_ok = claimed_carry == actual_carry and len(actual_carry) == 45

agrees = bool(
    worked_ok
    and identity_ok
    and domain_ok
    and simple_matches_truth_iff_sum_lt_10
    and carry_case_real
    and carry_set_ok
)
computed = str(int(worked_product))

print(json.dumps({
    "claim_id": "multiply-by-11-two-digit",
    "computed": computed,
    "agrees": agrees,
}))
