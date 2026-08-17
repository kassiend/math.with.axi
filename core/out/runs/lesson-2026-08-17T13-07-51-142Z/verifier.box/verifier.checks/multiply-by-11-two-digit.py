"""Independent verification for the 'multiply by 11 (two-digit)' lesson.

The claim, restated only from the payload:
  For any n in [10, 99] with n = 10a + b, a in {1..9}, b in {0..9},
    n * 11 = 100*a + 10*(a + b) + b.
  When a + b < 10 the answer digits are a, a+b, b (a three-digit number).
  When a + b >= 10, the payload says: 'the answer's digits are (a + 1),
    (a + b - 10), b, a four-digit number where the '1' carries into the
    hundreds.'
  Worked example: 92 * 11 = 1012.
  The 'full carry set' is the 45 two-digit numbers whose digits sum to >= 10.

This script does four independent things:
  1) Direct SymPy multiplication of the worked example.
  2) Reconstructs 92 * 11 via the payload's positional rule for carry cases,
     interpreted as 100*(a+1) + 10*(a+b-10) + b (i.e. the '1' carries into
     the hundreds column, with any further overflow handled by standard
     place-value arithmetic).
  3) Exhaustively checks the *arithmetic* identity
     n*11 == 100*a + 10*(a+b) + b for all n in [10, 99] AND the split-form
     reconstruction (with-carry or without-carry) for all n in [10, 99].
  4) Tests the payload's explicit textual claim that every carry case is
     'a four-digit number', by counting how many of the 45 carry cases
     actually produce a four-digit product.
"""

import json
from sympy import Integer


def digits(n):
    a, b = divmod(n, 10)
    return a, b


def reconstruct(n):
    """Payload's method, interpreted with correct place-value semantics."""
    a, b = digits(n)
    s = a + b
    if s < 10:
        return 100 * a + 10 * s + b
    # carry case: hundreds becomes (a+1), tens becomes (s-10), units stay b
    return 100 * (a + 1) + 10 * (s - 10) + b


# 1) Direct check of the worked example.
direct = Integer(92) * Integer(11)
worked_expected = Integer(1012)
worked_agrees = (direct == worked_expected)

# 2) Reconstruction for n = 92.
rule_92 = reconstruct(92)
rule_agrees_92 = (rule_92 == int(direct))

# 3) Exhaustive checks over the stated domain [10, 99].
identity_all_agree = True
reconstruct_all_agree = True
first_identity_fail = None
first_reconstruct_fail = None
for n in range(10, 100):
    a, b = digits(n)
    true_val = n * 11
    formula_val = 100 * a + 10 * (a + b) + b
    reconstruct_val = reconstruct(n)
    if formula_val != true_val:
        identity_all_agree = False
        if first_identity_fail is None:
            first_identity_fail = {"n": n, "true": true_val, "formula": formula_val}
    if reconstruct_val != true_val:
        reconstruct_all_agree = False
        if first_reconstruct_fail is None:
            first_reconstruct_fail = {"n": n, "true": true_val, "reconstruct": reconstruct_val}

# 4) Test the payload's textual 'a four-digit number' claim about carry cases.
carry_cases = [n for n in range(10, 100) if (n // 10) + (n % 10) >= 10]
four_digit_carry_cases = [n for n in carry_cases if n * 11 >= 1000]
three_digit_carry_cases = [n for n in carry_cases if n * 11 < 1000]

# Boundary probes just outside the stated domain (informational only).
boundary_notes = {}
for n in (9, 100):
    a, b = divmod(n, 10)
    s = a + b
    naive = 100 * a + 10 * s + b if s < 10 else None
    boundary_notes[n] = {"true_product": n * 11, "naive_drop_sum_form": naive}

# Overall verdict: does the worked example, computed independently, agree?
overall_agrees = bool(worked_agrees and rule_agrees_92 and identity_all_agree and reconstruct_all_agree)

print(json.dumps({
    "claim_id": "multiply-by-11-two-digit",
    "computed": str(int(direct)),
    "agrees": overall_agrees,
    "_diagnostics": {
        "worked_example_direct": int(direct),
        "worked_example_expected": int(worked_expected),
        "rule_reconstruction_for_92": rule_92,
        "identity_exhaustive_over_10_to_99": identity_all_agree,
        "reconstruction_exhaustive_over_10_to_99": reconstruct_all_agree,
        "first_identity_fail": first_identity_fail,
        "first_reconstruct_fail": first_reconstruct_fail,
        "num_carry_cases": len(carry_cases),
        "num_four_digit_carry_cases": len(four_digit_carry_cases),
        "num_three_digit_carry_cases": len(three_digit_carry_cases),
        "three_digit_carry_examples": three_digit_carry_cases[:10],
        "boundary_notes": boundary_notes,
    }
}))
