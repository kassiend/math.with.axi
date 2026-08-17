"""Generator-side independent SymPy check for lesson divisibility-by-11-alternating-sum.

Claims tested, none of them by re-walking the displayed steps:

  1. Worked example: 3958 is NOT divisible by 11, and 3958 = 11 * 359 + 9.
     Checked with direct integer arithmetic (Mod / divmod), not with the trick.

  2. Symbolic ground: for a 4-digit number n = 1000*d3 + 100*d2 + 10*d1 + d0,
     n - (d0 - d1 + d2 - d3) is identically divisible by 11.

  3. Universality over the declared finite domain 1 <= n <= 999999:
     n % 11 == 0  <->  A(n) % 11 == 0, and moreover n % 11 == A(n) % 11,
     where A(n) is the right-to-left alternating digit sum. Exhaustive.

  4. Caveat honesty: the simplified 'the digits must cancel to zero' form
     (A(n) == 0) is a strictly weaker test — 2915 has A = 11 != 0 yet
     2915 = 11 * 265, so the simple form gives a false negative. Also
     confirms the plan's other cited breaks (209 -> 11, 90728 -> 22) and
     that the simple form never gives a false POSITIVE (A(n) == 0 always
     does imply divisibility), which is what makes it a caveat and not a
     wrong rule.

  5. Card arithmetic on the caveat step: 5 - 1 + 9 - 2 == 11 and 11 | 2915.

Emits exactly one JSON line to stdout.
"""

import json

from sympy import Integer, Mod, Symbol, expand, simplify

DOMAIN_MAX = 999_999


def alternating_sum(n: int) -> int:
    """A(n): units digit positive, alternating leftwards. No divisibility logic."""
    total = 0
    sign = 1
    while n > 0:
        total += sign * (n % 10)
        sign = -sign
        n //= 10
    return total


# --- 1. Worked example, by direct arithmetic --------------------------------
n_worked = Integer(3958)
worked_remainder = Mod(n_worked, 11)
worked_not_divisible = worked_remainder != 0
worked_quotient_ok = Integer(11) * Integer(359) + Integer(9) == n_worked
worked_remainder_ok = worked_remainder == Integer(9)
worked_ok = bool(worked_not_divisible and worked_quotient_ok and worked_remainder_ok)

# --- 2. Symbolic ground for a 4-digit number --------------------------------
d0, d1, d2, d3 = (Symbol(f"d{i}", integer=True) for i in range(4))
n_sym = 1000 * d3 + 100 * d2 + 10 * d1 + d0
a_sym = d0 - d1 + d2 - d3
# n - A(n) = 1001*d3 + 99*d2 + 11*d1 = 11 * (91*d3 + 9*d2 + d1)
difference = expand(n_sym - a_sym)
symbolic_ok = simplify(difference - 11 * (91 * d3 + 9 * d2 + d1)) == 0

# --- 3. Exhaustive check over the declared domain ---------------------------
domain_iff_ok = True
domain_congruence_ok = True
for n in range(1, DOMAIN_MAX + 1):
    a = alternating_sum(n)
    if (n % 11 == 0) != (a % 11 == 0):
        domain_iff_ok = False
        break
    if n % 11 != a % 11:  # Python's % returns a non-negative residue for both
        domain_congruence_ok = False
        break

# --- 4. Caveat honesty -------------------------------------------------------
carry_case = 2915
carry_a = alternating_sum(carry_case)
carry_case_breaks_simple_form = bool(
    carry_a != 0 and carry_case % 11 == 0 and carry_a % 11 == 0
)
other_breaks_ok = all(
    alternating_sum(x) != 0 and x % 11 == 0
    for x in (209, 90_728)
)
cited_values_ok = alternating_sum(209) == 11 and alternating_sum(90_728) == 22

# The simple form must be sound-but-incomplete: no false positives, and at
# least one false negative in the domain (there are many).
no_false_positive = True
false_negatives = 0
for n in range(1, 100_000):
    a = alternating_sum(n)
    if a == 0 and n % 11 != 0:
        no_false_positive = False
        break
    if a != 0 and n % 11 == 0:
        false_negatives += 1
caveat_ok = bool(
    carry_case_breaks_simple_form
    and other_breaks_ok
    and cited_values_ok
    and no_false_positive
    and false_negatives > 0
)

# --- 5. Card arithmetic on the shown steps ----------------------------------
cards_ok = bool(
    (8 - 5 + 9 - 3) == 9
    and alternating_sum(3958) == 9
    and (5 - 1 + 9 - 2) == 11
    and carry_case % 11 == 0
    and carry_case // 11 == 265
)

agrees = bool(
    worked_ok
    and symbolic_ok
    and domain_iff_ok
    and domain_congruence_ok
    and caveat_ok
    and cards_ok
)

print(
    json.dumps(
        {
            "claim_id": "divisibility-by-11-alternating-sum",
            "computed": f"3958 = 11*359 + {int(worked_remainder)}; A(3958)={alternating_sum(3958)}; "
            f"A(2915)={carry_a} (2915 = 11*{carry_case // 11}); "
            f"domain 1..{DOMAIN_MAX} exhaustive iff+congruence pass={domain_iff_ok and domain_congruence_ok}; "
            f"false negatives of the 'A=0' form below 100000 = {false_negatives}",
            "agrees": agrees,
        }
    )
)
