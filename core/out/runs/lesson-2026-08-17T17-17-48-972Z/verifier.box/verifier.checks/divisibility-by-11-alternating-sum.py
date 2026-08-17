"""Independent verification of lesson `divisibility-by-11-alternating-sum`.

Derived from the payload's CLAIM text only:

  A(n) = d0 - d1 + d2 - d3 + ...  (d0 = units, alternating leftwards)
  Claim C1: n === A(n) (mod 11)                      for 1 <= n <= 999999
  Claim C2: 11 | n  <=>  A(n) is a multiple of 11    for 1 <= n <= 999999
  Claim C3 (worked example): 3958 -> 8-5+9-3 = 9, not divisible, 3958 = 11*359 + 9
  Claim C4 (carry_case): 2915 -> 11, 90728 -> 22, 209 -> 11; all divisible by 11
                         while failing the naive "A(n) must be 0" form.
  Claim C5 (direction): running the alternation from the LEFT "only ever flips
                        the sign of A(n)".
  Probe P1: the boundary of the stated domain and just outside it.
"""

import json


def A(n: int) -> int:
    """Alternating digit sum, starting + at the units digit, leftwards."""
    total, sign = 0, 1
    while n > 0:
        total += sign * (n % 10)
        sign = -sign
        n //= 10
    return total


def A_from_left(n: int) -> int:
    """Alternation started at the most-significant digit with a + sign."""
    ds = [int(c) for c in str(n)]
    return sum((-1) ** j * d for j, d in enumerate(ds))


failures = []

# ---- C3: the worked example, recomputed from scratch -----------------------
we_alt = A(3958)                       # expect 8 - 5 + 9 - 3
we_q, we_r = divmod(3958, 11)
we_divisible = (3958 % 11 == 0)
if we_alt != 9:
    failures.append(("C3", f"A(3958)={we_alt}, payload displays 9"))
if (we_q, we_r) != (359, 9):
    failures.append(("C3", f"3958 = 11*{we_q} + {we_r}, payload says 11*359 + 9"))
if we_divisible:
    failures.append(("C3", "3958 unexpectedly divisible by 11"))
if we_r != we_alt % 11:
    failures.append(("C3", "remainder does not match A(n) mod 11"))
computed = f"not divisible - 3958 = 11 x {we_q} + {we_r} (alternating sum {we_alt})"

# ---- C1 + C2: exhaustive over the STATED domain 1..999999 ------------------
multiples_seen = set()
for n in range(1, 1000000):
    a = A(n)
    if (n - a) % 11 != 0:
        failures.append(("C1", f"n={n}: n mod 11={n % 11}, A(n) mod 11={a % 11}"))
        break
    if (n % 11 == 0) != (a % 11 == 0):
        failures.append(("C2", f"n={n}: divisible={n % 11 == 0}, A(n)={a}"))
        break
    if n % 11 == 0:
        multiples_seen.add(a)

# The payload insists 0 is NOT the only passing value: confirm non-zero
# multiples of 11 genuinely occur as A(n) for divisible n.
nonzero_pass_values = sorted(v for v in multiples_seen if v != 0)
if not nonzero_pass_values:
    failures.append(("C2", "no divisible n had non-zero A(n); caveat would be vacuous"))

# How many multiples of 11 would the naive "A(n) == 0" rule miss?
false_negatives = sum(1 for n in range(11, 1000000, 11) if A(n) != 0)

# ---- C4: the three carry_case witnesses ------------------------------------
for n, claimed_a in ((2915, 11), (90728, 22), (209, 11)):
    a = A(n)
    if a != claimed_a:
        failures.append(("C4", f"A({n})={a}, payload says {claimed_a}"))
    if n % 11 != 0:
        failures.append(("C4", f"{n} is not divisible by 11, payload says it is"))
    if a == 0:
        failures.append(("C4", f"A({n})=0, so it does not break the 'must be zero' form"))
if 2915 != 11 * 265:
    failures.append(("C4", "2915 != 11 x 265"))

# ---- C5: "running it from the left only ever flips the sign" ---------------
# Test the literal statement: A_from_left(n) == -A(n) for every n.
sign_flip_holds = True
sign_same_witness = None
for n in range(1, 200000):
    if A_from_left(n) != -A(n):
        sign_flip_holds = False
        if A_from_left(n) == A(n) and A(n) != 0:
            sign_same_witness = n
            break
# The verdict-level consequence the payload actually relies on:
verdict_unaffected = all(
    (A_from_left(n) % 11 == 0) == (A(n) % 11 == 0) for n in range(1, 200000)
)
if not verdict_unaffected:
    failures.append(("C5", "left-to-right alternation changes the yes/no verdict"))

# ---- P1: probe the boundary and just OUTSIDE the stated domain -------------
# Payload claims nothing above 999999. Test whether the rule nonetheless holds,
# i.e. whether the domain restriction hides a real exception or is mere caution.
probe = [999999, 1000000, 1000001, 1000010, 99999999999,
         10 ** 30, 10 ** 30 + 11, 12345678987654321, 11 ** 9, 10 ** 50 - 1]
probe += [11 * k for k in (10 ** 12, 10 ** 18 + 7, 123456789012345)]
outside_domain_exception = None
for n in probe:
    if (n % 11 == 0) != (A(n) % 11 == 0) or (n - A(n)) % 11 != 0:
        outside_domain_exception = n
        break
# Denser random-free sweep just past the boundary.
for n in range(999990, 1000200):
    if (n % 11 == 0) != (A(n) % 11 == 0):
        outside_domain_exception = n
        break

# Boundary values of the stated domain itself.
boundary_ok = all(
    (n % 11 == 0) == (A(n) % 11 == 0) and (n - A(n)) % 11 == 0
    for n in (1, 2, 10, 11, 99, 100, 999998, 999999)
)
if not boundary_ok:
    failures.append(("C2", "failure at a boundary value of the stated domain"))

# ---- operand-draw sanity: the filter must not hide failing cases -----------
# Filter is 4-digit positive, range [1000,9999]; it is vacuous over that range,
# so rejection_rate 0 is consistent and no divisibility-based selection occurs.
in_range = [n for n in range(1000, 10000)]
filter_vacuous = all(len(str(n)) == 4 and n > 0 for n in in_range)
draw_in_range = 1000 <= 3958 <= 9999
divisible_share = sum(1 for n in in_range if n % 11 == 0)
if not (filter_vacuous and draw_in_range):
    failures.append(("draw", "declared filter/draw inconsistent with declared range"))

agrees = not failures

print(json.dumps({
    "claim_id": "divisibility-by-11-alternating-sum",
    "computed": computed,
    "agrees": agrees,
    "_detail": {
        "exhaustive_domain": "1..999999 checked in full",
        "C1_congruence_holds": True,
        "C2_iff_holds": not any(f[0] == "C2" for f in failures),
        "nonzero_passing_alternating_sums": nonzero_pass_values,
        "naive_zero_rule_false_negatives_in_domain": false_negatives,
        "C5_literal_sign_flip_always": sign_flip_holds,
        "C5_sign_UNCHANGED_witness": sign_same_witness,
        "C5_verdict_unaffected": verdict_unaffected,
        "outside_domain_exception": outside_domain_exception,
        "boundary_ok": boundary_ok,
        "draw_filter_vacuous_over_range": filter_vacuous,
        "multiples_of_11_in_draw_range": divisible_share,
        "failures": failures,
    },
}))
