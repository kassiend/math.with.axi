"""Independent check for the 'Divisible by 3?' lesson.

Claim (derived from the payload alone):
  For n = 7351, digit_sum(n) = 16, 16 is not divisible by 3,
  and therefore n is not divisible by 3 (quotient 2450, remainder 1).

Also probe the applicability statement 'any non-negative integer, in base 10'
by comparing the rule (n mod 3 == 0  iff  digit_sum_base10(n) mod 3 == 0)
against direct computation across a wide range of non-negative integers,
including the boundary case n=0.
"""

import json


def digit_sum_base10(n: int) -> int:
    assert n >= 0
    s = 0
    while n > 0:
        s += n % 10
        n //= 10
    return s


def rule_says_divisible_by_3(n: int) -> bool:
    """Iterated digit-sum reduction, as the applicability line permits."""
    s = digit_sum_base10(n)
    while s >= 10:
        s = digit_sum_base10(s)
    return s % 3 == 0


# --- Worked example ---------------------------------------------------------
n = 7351
ds = 7 + 3 + 5 + 1              # what the display shows
ds_computed = digit_sum_base10(n)
q, r = divmod(n, 3)

worked_ok = (
    ds == 16
    and ds_computed == 16
    and ds % 3 != 0
    and n % 3 != 0
    and q == 2450
    and r == 1
)

# --- Boundary + range probe of the applicability claim ---------------------
# Include 0 (the stated lower bound), 1, and a wide sweep.
range_ok = True
first_mismatch = None
for k in list(range(0, 5000)) + [10**6, 10**6 + 1, 10**6 + 2,
                                 10**9, 10**9 + 3, 123456789012345]:
    if rule_says_divisible_by_3(k) != (k % 3 == 0):
        range_ok = False
        first_mismatch = k
        break

# Explicit boundary n=0 check (0 is divisible by 3, digit_sum(0)=0).
boundary_zero_ok = (rule_says_divisible_by_3(0) is True) and (0 % 3 == 0)

agrees = worked_ok and range_ok and boundary_zero_ok

# The 'computed' for the worked example is the verdict on 7351.
computed_str = (
    f"digit_sum(7351)={ds_computed}, 7351 mod 3 = {r}, "
    f"quotient={q}, divisible={n % 3 == 0}"
)

print(json.dumps({
    "claim_id": "divisibility-by-3-digit-sum",
    "computed": computed_str,
    "agrees": bool(agrees),
    "_diagnostics": {
        "worked_ok": worked_ok,
        "range_ok": range_ok,
        "boundary_zero_ok": boundary_zero_ok,
        "first_mismatch": first_mismatch,
    },
}))
