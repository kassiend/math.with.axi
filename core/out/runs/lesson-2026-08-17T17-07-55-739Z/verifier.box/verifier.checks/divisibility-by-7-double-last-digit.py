"""Independent verification of lesson `divisibility-by-7-double-last-digit`.

Derived from the payload's CLAIM text only:
  "Every integer n with at least two digits. Write n = 10a + b, where b is the
   last digit (0-9) and a is the number formed by all the digits in front of it.
   Then 7 divides n if and only if 7 divides a - 2b. [...] The step may be
   repeated on the new number until it is small enough to judge by sight, and it
   is valid even when a - 2b is zero or negative."
  Worked example: 838 -> 83 - 2*8 = 67 -> not divisible (838 = 7*119 + 5).
  Caveat: the step preserves divisibility but NOT the remainder.
  Caveat: 12 -> 1 - 2*2 = -3, negatives allowed.

`agrees` tracks the payload's LITERAL claims: the iff, the worked example, the
proof identity, the caveats. Domain-overreach probes (section 8) are recorded
as data for the report and are NOT folded into `agrees`.
"""

import json
import random

from sympy import Integer, gcd, symbols, simplify, expand

CLAIM_ID = "divisibility-by-7-double-last-digit"

failures = []
probes = {}


def check(label, condition, extra=""):
    if not condition:
        failures.append(f"{label}{(' :: ' + extra) if extra else ''}")
    return bool(condition)


def step_of(m):
    """The payload's step under its own equation n = 10a + b with b in 0..9."""
    aa, bb = divmod(m, 10)          # unique pair with b in {0..9}
    return aa - 2 * bb


# ---------------------------------------------------------------------------
# 1. The worked example, recomputed from scratch.
# ---------------------------------------------------------------------------
n = Integer(838)
a, b = divmod(n, 10)                                   # a = 83, b = 8
step = a - 2 * b
check("worked_example.decomposition", (a, b) == (83, 8), f"a={a} b={b}")
check("worked_example.step_value", step == 67, f"step={step}")
check("worked_example.step_not_div7", step % 7 != 0, f"67 mod 7 = {step % 7}")
check("worked_example.n_not_div7", n % 7 != 0, f"838 mod 7 = {n % 7}")
check("worked_example.quotient_remainder",
      7 * 119 + 5 == 838 and n % 7 == 5, f"838 = 7*{n // 7} + {n % 7}")
check("step_s4.arithmetic", 7 * 9 + 4 == 67 and step % 7 == 4,
      f"67 = 7*{step // 7} + {step % 7}")

worked = ("838 -> a=83, b=8 -> 83-2*8 = 67; 67 mod 7 = 4 != 0 "
          "=> 838 NOT divisible by 7 (838 = 7*119 + 5)")

# ---------------------------------------------------------------------------
# 2. The identity the payload's proof rests on: -2*(10a+b) == (a-2b) - 21a.
# ---------------------------------------------------------------------------
A, B = symbols("A B", integer=True)
check("proof.identity",
      simplify(expand(-2 * (10 * A + B)) - expand((A - 2 * B) - 21 * A)) == 0)
check("proof.gcd_2_7", gcd(Integer(2), Integer(7)) == 1)

# ---------------------------------------------------------------------------
# 3. Universality of the iff, exhaustive over a stated finite domain, then
#    random large operands far outside the drawn 3-digit range.
# ---------------------------------------------------------------------------
bad = [m for m in range(-20000, 20001)
       if not (-10 < m < 10) and ((m % 7 == 0) != (step_of(m) % 7 == 0))]
check("iff.exhaustive_-20000..20000", not bad, f"witnesses={bad[:5]}")

rng = random.Random(20260817)
bad_big = []
for _ in range(5000):
    m = rng.randrange(10, 10 ** 18)
    if (m % 7 == 0) != (step_of(m) % 7 == 0):
        bad_big.append(m)
check("iff.random_large_up_to_1e18", not bad_big, f"witnesses={bad_big[:5]}")

# ---------------------------------------------------------------------------
# 4. Boundary of the stated domain, and just outside it.
# ---------------------------------------------------------------------------
bad_one = [m for m in range(0, 10) if (m % 7 == 0) != (step_of(m) % 7 == 0)]
check("iff.one_digit_outside_domain_still_true", not bad_one, f"{bad_one}")

bad_bd = [m for m in (10, 11, 14, 70, 99, -10, -14, -70, -99, 100, 105, 999, 994)
          if (m % 7 == 0) != (step_of(m) % 7 == 0)]
check("iff.boundary", not bad_bd, f"{bad_bd}")

check("zero_result.divisible", step_of(21) == 0 and 21 % 7 == 0)
check("carry_case.twelve",
      step_of(12) == -3 and (-3) % 7 != 0 and 12 % 7 != 0, f"{step_of(12)}")
check("negative.judge_by_abs_ok",
      all((m % 7 == 0) == (abs(m) % 7 == 0) for m in range(-500, 501)))

# ---------------------------------------------------------------------------
# 5. Caveat: divisibility preserved, REMAINDER not. Is the caveat real & needed?
# ---------------------------------------------------------------------------
check("caveat.remainder_differs_838", (838 % 7, 67 % 7) == (5, 4))
mismatch = [m for m in range(100, 1000) if (m % 7) != (step_of(m) % 7)]
check("caveat.remainder_not_preserved_in_general", len(mismatch) > 0,
      f"{len(mismatch)}/900 three-digit n change remainder")
probes["remainder_mismatch_count_3digit"] = f"{len(mismatch)}/900"

# ---------------------------------------------------------------------------
# 6. "Repeat until small" must terminate. Test the POSITIVE domain (where the
#    lesson's steps live) as a payload claim; the signed case is probed in 8.
# ---------------------------------------------------------------------------
bad_dec = [m for m in range(10, 20000) if not abs(step_of(m)) < abs(m)]
check("iteration.strictly_decreasing_positive", not bad_dec, f"{bad_dec[:5]}")


def iterate_abs(m):
    """Payload's prescription: repeat, judging a negative by its abs value."""
    m = abs(m)
    guard = 0
    while m >= 10:
        m = abs(step_of(m))
        guard += 1
        if guard > 200:
            return None                    # non-terminating
    return m


bad_it = [m for m in range(10, 20000)
          if (m % 7 == 0) != (iterate_abs(m) in (0, 7))]
check("iteration.abs_form_agrees_with_mod7", not bad_it, f"{bad_it[:5]}")
probes["iterate_abs(838)"] = str(iterate_abs(838))
check("iteration.838_endpoint_not_mult_of_7",
      iterate_abs(838) not in (0, 7) and 838 % 7 != 0,
      f"endpoint={iterate_abs(838)}")

# ---------------------------------------------------------------------------
# 7. Operand-draw audit: declared filter must be rendering-only.
#    Filter = {min_digits 3, max_digits 3, positive_only} over range 100..999,
#    which already implies all three -> vacuous, so it hides nothing.
# ---------------------------------------------------------------------------
pool = list(range(100, 1000))
check("draw.filter_is_vacuous_over_range",
      len(pool) == 900 and all(len(str(m)) == 3 and m > 0 for m in pool))
check("draw.filter_excludes_no_failures",
      all((m % 7 == 0) == (step_of(m) % 7 == 0) for m in pool))
check("draw.operand_in_pool", 838 in pool)
neg_step = [m for m in pool if step_of(m) < 0]
check("draw.pool_retains_awkward_cases", len(neg_step) > 0,
      f"{len(neg_step)} pool members give a negative first step, e.g. {neg_step[:3]}")
probes["pool_negative_step_count"] = f"{len(neg_step)}/900 e.g. {neg_step[:3]}"
probes["rejection_rate_consistent"] = "yes: filter vacuous over 100..999 -> 0"

# ---------------------------------------------------------------------------
# 8. PROBES of the declared domain "every integer n with at least two digits".
#    Recorded, not folded into `agrees`.
# ---------------------------------------------------------------------------
# 8a. For n < 0 the payload's construction has no digit-reading solution:
#     digits of -83 are 8,3 -> 10*8+3 = 83 != -83.
probes["neg.digit_equation_has_no_solution"] = f"10*8+3={10*8+3} != -83"
# 8b. The sign-carrying reading a=-8,b=3 yields an outright FALSE verdict.
probes["neg.sign_reading_false_positive"] = (
    f"-83: -8-2*3 = {-8 - 2 * 3} is a multiple of 7, but -83 = 7*{-83 // 7} + {-83 % 7}")
# 8c. Under the floor reading the iff survives, but "repeat until small" has
#     fixed points, so the iteration never shrinks.
fixed = [m for m in range(-100, -9) if step_of(m) == m]
probes["neg.iteration_fixed_points"] = f"{fixed} map to themselves forever"
probes["pos.iteration_fixed_points"] = str(
    [m for m in range(10, 100000) if step_of(m) == m])

agrees = not failures

import sys
print(json.dumps({"probes": probes, "failures": failures}, indent=2), file=sys.stderr)

# stdout: exactly one line of JSON, exactly three fields.
print(json.dumps({
    "claim_id": CLAIM_ID,
    "computed": worked if agrees else worked + " | FAILURES: " + "; ".join(failures[:5]),
    "agrees": agrees,
}))
