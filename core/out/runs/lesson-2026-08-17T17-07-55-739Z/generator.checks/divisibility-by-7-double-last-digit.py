"""Generator-side independent SymPy check for lesson divisibility-by-7-double-last-digit.

Confirms, without re-walking the taught procedure where the claim allows a direct test:

  1. Worked example: 838 is NOT divisible by 7, by direct division (838 = 7*119 + 5).

  2. The rule is an exact equivalence, symbolically: for n = 10a + b,
     -2*n - (a - 2b) = -21a, a multiple of 7 for every integer a. Since gcd(2,7)=1,
     7 | n  <=>  7 | (a - 2b). Checked with SymPy over integer symbols.

  3. Exhaustive numeric confirmation of that equivalence over a stated finite domain,
     every integer n in [10, 100000] (and the negative mirror [-100000, -10]),
     so the universality claim in `applicability` is evidenced, not asserted.

  4. Caveat honesty (`carry_case`), three separate claims:
       a. remainders are NOT preserved: 838 % 7 == 5 while 67 % 7 == 4;
       b. the negative case 12 -> 1 - 2*2 = -3 is real, and the test still decides
          correctly there (7 does not divide -3, and 7 does not divide 12);
       c. one pass is not always sufficient - some n reduce to a value still too
          large to judge by sight, so the step must be repeatable.

  5. The displayed working lines are arithmetically true: 83 - 2*8 == 67 and
     67 == 7*9 + 4.

Emits exactly one JSON line to stdout.
"""

import json

from sympy import Symbol, Integer, simplify, expand, gcd

N = Integer(838)

# --- 1. Worked example, computed directly -----------------------------------
quotient, remainder = divmod(int(N), 7)
worked_ok = (remainder != 0) and (quotient == 119) and (remainder == 5)

# --- 2. Symbolic equivalence -------------------------------------------------
a = Symbol("a", integer=True)
b = Symbol("b", integer=True)
n_sym = 10 * a + b
reduced = a - 2 * b
# -2*n - (a - 2b) must be exactly -21a, i.e. divisible by 7 for all integers a.
difference = simplify(expand(-2 * n_sym - reduced) - (-21 * a))
symbolic_ok = bool(difference == 0) and bool(gcd(Integer(2), Integer(7)) == 1)

# --- 3. Exhaustive check over a stated finite domain -------------------------
def reduce_once(n: int) -> int:
    a_val, b_val = divmod(abs(n), 10)
    return a_val - 2 * b_val

DOMAIN_LO, DOMAIN_HI = 10, 100000
equivalence_ok = all(
    ((n % 7 == 0) == (reduce_once(n) % 7 == 0))
    for n in range(DOMAIN_LO, DOMAIN_HI + 1)
)
negative_mirror_ok = all(
    ((n % 7 == 0) == (reduce_once(n) % 7 == 0))
    for n in range(-DOMAIN_HI, -DOMAIN_LO + 1)
)

# --- 4a. Remainders are not preserved ---------------------------------------
step_838 = reduce_once(838)  # 83 - 16
remainder_not_preserved = (step_838 == 67) and (838 % 7 == 5) and (67 % 7 == 4) \
    and (838 % 7 != 67 % 7)
# and it is not a one-off: count how often the remainder survives a step
remainder_survives = sum(1 for n in range(10, 10001) if n % 7 == (reduce_once(n) % 7))
remainder_generally_lost = remainder_survives < (10001 - 10)

# --- 4b. The negative case is real and still decides correctly ---------------
step_12 = reduce_once(12)
negative_case_ok = (step_12 == -3) and (step_12 < 0) \
    and ((12 % 7 == 0) == (step_12 % 7 == 0)) and (12 % 7 != 0)

# --- 4c. One pass is not always enough ---------------------------------------
def needs_more_than_one_pass(n: int) -> bool:
    """True if a single reduction leaves a value still >= 100 (not sight-judgeable)."""
    return abs(reduce_once(n)) >= 100

multi_pass_example = next(n for n in range(1000, 100000) if needs_more_than_one_pass(n))
repetition_needed = needs_more_than_one_pass(multi_pass_example)

# repeated application still decides correctly, over the same finite domain
def reduce_until_small(n: int) -> int:
    v = abs(n)
    while v >= 100:
        v = abs(reduce_once(v))
    return v

iteration_ok = all(
    ((n % 7 == 0) == (reduce_until_small(n) % 7 == 0))
    for n in range(10, 100001)
)

# --- 5. Displayed working lines ---------------------------------------------
display_ok = (83 - 2 * 8 == 67) and (67 == 7 * 9 + 4)

agrees = bool(
    worked_ok
    and symbolic_ok
    and equivalence_ok
    and negative_mirror_ok
    and remainder_not_preserved
    and remainder_generally_lost
    and negative_case_ok
    and repetition_needed
    and iteration_ok
    and display_ok
)

print(json.dumps({
    "claim_id": "divisibility-by-7-double-last-digit",
    "computed": f"838 = 7*{quotient} + {remainder}; one step -> {step_838}",
    "worked_example_not_divisible_by_7": worked_ok,
    "symbolic_equivalence": symbolic_ok,
    "exhaustive_domain": f"[{DOMAIN_LO}, {DOMAIN_HI}] and its negative mirror",
    "equivalence_holds_on_domain": bool(equivalence_ok and negative_mirror_ok),
    "iterated_rule_holds_on_domain": bool(iteration_ok),
    "remainder_not_preserved_838_67": bool(remainder_not_preserved),
    "negative_case_12_gives_minus3": bool(negative_case_ok),
    "single_pass_insufficient_example": multi_pass_example,
    "display_lines_true": bool(display_ok),
    "agrees": agrees,
}))
