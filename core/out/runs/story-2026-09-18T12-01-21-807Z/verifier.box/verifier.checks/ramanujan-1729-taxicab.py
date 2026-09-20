"""Independent verification of the 1729 taxicab claim.

Claim (formula_latex): 1^3 + 12^3 = 9^3 + 10^3 = 1729.
Mechanism: 1729 is the smallest positive integer expressible as a
sum of two positive cubes in two different (unordered) ways.

We verify:
  step 1: 1^3 + 12^3 == 1 + 1728
  step 2: 9^3 + 10^3 == 729 + 1000
  step 3: 1 + 1728 == 729 + 1000 == 1729
and independently brute-force that 1729 is the smallest such number.
"""

import json
from sympy import Integer

def cubes_representations(n):
    """Return the set of unordered pairs {a,b} with a,b>=1 and a^3+b^3 == n."""
    reps = set()
    a = 1
    while 2 * a ** 3 <= n:
        rem = n - a ** 3
        # find b >= a with b^3 == rem
        # integer cube root
        lo, hi = a, int(round(rem ** (1.0 / 3.0))) + 2
        b = None
        for cand in range(max(a, 1), hi + 1):
            if cand ** 3 == rem:
                b = cand
                break
            if cand ** 3 > rem:
                break
        if b is not None and b >= a:
            reps.add((a, b))
        a += 1
    return reps


def main():
    ok = True
    reasons = []

    # step 1: 1^3 + 12^3 = 1 + 1728
    s1_lhs = Integer(1) ** 3 + Integer(12) ** 3
    s1_rhs = Integer(1) + Integer(1728)
    if s1_lhs != s1_rhs:
        ok = False
        reasons.append(f"step1 mismatch: {s1_lhs} vs {s1_rhs}")

    # step 2: 9^3 + 10^3 = 729 + 1000
    s2_lhs = Integer(9) ** 3 + Integer(10) ** 3
    s2_rhs = Integer(729) + Integer(1000)
    if s2_lhs != s2_rhs:
        ok = False
        reasons.append(f"step2 mismatch: {s2_lhs} vs {s2_rhs}")

    # step 3: both equal 1729
    if s1_lhs != Integer(1729) or s2_lhs != Integer(1729):
        ok = False
        reasons.append(f"step3 mismatch: {s1_lhs}, {s2_lhs} vs 1729")

    # Independent brute-force search for the smallest positive integer
    # expressible as the sum of two positive cubes in two distinct
    # unordered ways.
    smallest = None
    for n in range(1, 2000):
        reps = cubes_representations(n)
        if len(reps) >= 2:
            smallest = n
            break

    if smallest != 1729:
        ok = False
        reasons.append(f"smallest taxicab-2 number is {smallest}, not 1729")

    # Confirm the two representations of 1729 are exactly {(1,12),(9,10)}
    reps_1729 = cubes_representations(1729)
    if reps_1729 != {(1, 12), (9, 10)}:
        ok = False
        reasons.append(f"representations of 1729 are {reps_1729}")

    computed = {
        "1^3+12^3": int(s1_lhs),
        "9^3+10^3": int(s2_lhs),
        "smallest_taxicab2": smallest,
        "reps_of_1729": sorted(reps_1729),
    }
    if not ok:
        computed["reasons"] = reasons

    print(json.dumps({
        "claim_id": "ramanujan-1729-taxicab",
        "computed": json.dumps(computed, default=str),
        "agrees": ok,
    }))


if __name__ == "__main__":
    main()
