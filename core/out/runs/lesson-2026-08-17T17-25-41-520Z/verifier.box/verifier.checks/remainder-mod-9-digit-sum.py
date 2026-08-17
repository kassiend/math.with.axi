"""Independent check of lesson `remainder-mod-9-digit-sum`.

Written from the payload's CLAIMS only. Nothing here is copied from any
generator-supplied script.

Claims under test
-----------------
C1 (worked example)  6656 -> digits 6+6+5+6 = 23 -> 2+3 = 5, and
                     6656 = 9*739 + 5, so the reported result "5" is 6656 mod 9.
C2 (congruence)      n == digitsum(n) (mod 9) for every n >= 0 in base 10.
                     Proved structurally (10**i == 1 mod 9 for all i), not just sampled.
C3 (halting)         Each round strictly shrinks any n with two or more digits,
                     so the iteration always terminates on a single digit 0..9.
C4 (main rule)       The final single digit IS n mod 9 in every case EXCEPT when
                     it comes out as 9, in which case the true remainder is 0.
C5 (closed form)     For n >= 1 the final digit equals 1 + ((n - 1) mod 9).
C6 (carry case)      999 -> 27 -> 9 while 999 mod 9 == 0, and EVERY positive
                     multiple of 9 fails the simple form in exactly this way
                     (18, 5661, 123456789 cited).
C7 (no false exception) Outside the multiples of 9 there is no second exception:
                     the rule must never fail for n not divisible by 9.
C8 (draw spec)       Every integer in [1000, 9999] passes the declared filter
                     (min_digits=4, max_digits=4, positive_only), hence the
                     claimed rejection_rate of 0; and 6656 lies in that range.

Boundary probing is deliberate: n = 0, 1, 8, 9, 10, and just outside the stated
domain (negative n, non-integers, other bases) which the payload excludes in
nulls[] and which must therefore NOT be silently relied upon.
"""

import json
import random
import sys

from sympy import Integer, Symbol, simplify

FAILURES = []


def note(ok, label, extra=""):
    if not ok:
        FAILURES.append(f"{label}{(': ' + extra) if extra else ''}")
    print(f"  [{'ok' if ok else 'FAIL'}] {label}{(' -- ' + extra) if extra else ''}",
          file=sys.stderr)


def digitsum(n):
    return sum(int(c) for c in str(n))


def digital_root_trace(n):
    """Run the procedure exactly as the lesson words it, recording each round."""
    trace = [n]
    cur = n
    while cur >= 10:            # "if the total still has two or more digits, add again"
        cur = digitsum(cur)
        trace.append(cur)
    return cur, trace


# ---------------------------------------------------------------- C1
print("C1 worked example", file=sys.stderr)
r1 = digitsum(6656)
note(r1 == 23, "6+6+5+6 == 23", f"got {r1}")
r2 = digitsum(r1)
note(r2 == 5, "2+3 == 5", f"got {r2}")
final, trace = digital_root_trace(6656)
note(trace == [6656, 23, 5], "procedure trace is 6656 -> 23 -> 5", str(trace))
note(6656 % 9 == 5, "6656 mod 9 == 5", str(6656 % 9))
note(9 * 739 + 5 == 6656, "step s4 identity 9*739+5 == 6656", str(9 * 739 + 5))
note(6656 // 9 == 739, "quotient shown in s4 is correct", str(6656 // 9))
WORKED = final                                   # what the lesson reports as "5"
note(str(WORKED) == "5", "reported result matches procedure output", str(WORKED))

# ---------------------------------------------------------------- C2
print("C2 congruence n == digitsum(n) (mod 9)", file=sys.stderr)
# Structural proof rather than sampling: the whole claim rests on 10**i == 1 (mod 9).
powers_ok = all(pow(10, i, 9) == 1 for i in range(0, 400))
note(powers_ok, "10**i == 1 (mod 9) for i in 0..399 (induction base+step)")
# Symbolic form: 10**(i+1) - 1 = 10*(10**i - 1) + 9, so divisibility propagates.
i = Symbol("i", integer=True, nonnegative=True)
step = simplify((Integer(10) ** (i + 1) - 1) - (10 * (Integer(10) ** i - 1) + 9))
note(step == 0, "inductive step identity 10**(i+1)-1 == 10*(10**i-1)+9", str(step))

# ---------------------------------------------------------------- C3, C4, C5, C7
print("C3/C4/C5/C7 exhaustive over n = 0..200000 plus targeted boundaries",
      file=sys.stderr)
bad_halt = bad_rule = bad_closed = bad_extra_exc = None
for n in range(0, 200001):
    final_n, tr = digital_root_trace(n)
    # C3: every round strictly shrinks a >=2-digit value, and we end in 0..9
    for a, b in zip(tr, tr[1:]):
        if not (b < a and a >= 10):
            bad_halt = bad_halt or (n, a, b)
    if not (0 <= final_n <= 9):
        bad_halt = bad_halt or (n, final_n, None)
    # C2 as a check too
    if final_n % 9 != n % 9:
        bad_rule = bad_rule or ("congruence", n)
    # C4: final digit is the remainder except when it is 9
    if final_n == 9:
        if n % 9 != 0:
            bad_rule = bad_rule or ("9-but-not-multiple", n)
    else:
        if final_n != n % 9:
            bad_rule = bad_rule or ("mismatch", n)
    # C7: for n NOT divisible by 9 the simple form must never fail
    if n % 9 != 0 and final_n != n % 9:
        bad_extra_exc = bad_extra_exc or n
    # C5: closed form, claimed for n >= 1 only
    if n >= 1 and final_n != 1 + ((n - 1) % 9):
        bad_closed = bad_closed or n

note(bad_halt is None, "every round strictly shrinks; halts on a single digit 0..9",
     str(bad_halt))
note(bad_rule is None, "final digit == n mod 9 except when it is 9 (then n mod 9 == 0)",
     str(bad_rule))
note(bad_extra_exc is None, "NO second exception: rule holds for all n not divisible by 9",
     str(bad_extra_exc))
note(bad_closed is None, "closed form 1 + ((n-1) mod 9) holds for all n >= 1",
     str(bad_closed))

# Boundaries of the stated domain, called out individually.
note(digital_root_trace(0)[0] == 0 and 0 % 9 == 0, "n = 0 boundary: lands on 0, rem 0")
note(digital_root_trace(1)[0] == 1, "n = 1 boundary: lands on 1, rem 1")
note(digital_root_trace(8)[0] == 8, "n = 8 boundary: lands on 8, rem 8")
note(digital_root_trace(9)[0] == 9 and 9 % 9 == 0,
     "n = 9 boundary: lands on 9, true rem 0 (caveat case)")
note(digital_root_trace(10)[0] == 1, "n = 10 boundary: first two-digit input")
# n = 0 is the ONLY n whose final digit is 0 -- so the closed form's exclusion of 0 is real.
zeros = [n for n in range(0, 200001) if digital_root_trace(n)[0] == 0]
note(zeros == [0], "final digit 0 occurs only for n = 0", str(zeros[:5]))

# Very large n, far outside anything the lesson displays ("of any length").
rng = random.Random(12345)
big_bad = None
for _ in range(3000):
    n = rng.randrange(10 ** 30, 10 ** 60)
    f, _t = digital_root_trace(n)
    expected = n % 9
    got = 0 if f == 9 else f
    if got != expected:
        big_bad = n
        break
note(big_bad is None, "holds for 3000 random n in [10**30, 10**60] (any length)",
     str(big_bad))

# ---------------------------------------------------------------- C6
print("C6 carry case", file=sys.stderr)
f999, t999 = digital_root_trace(999)
note(t999 == [999, 27, 9], "999 -> 27 -> 9", str(t999))
note(999 % 9 == 0 and 999 == 9 * 111, "999 = 9 * 111 exactly, true remainder 0")
note(f999 == 9 and 999 % 9 == 0,
     "carry case genuinely BREAKS the simple form (says 9, truth is 0)")
for cited in (18, 5661, 123456789):
    fc, _ = digital_root_trace(cited)
    note(fc == 9 and cited % 9 == 0, f"cited multiple {cited} lands on 9, rem 0",
         f"landed {fc}, rem {cited % 9}")
# "Every positive multiple of 9 breaks it the same way" -- test the universal claim.
mult_bad = next((9 * k for k in range(1, 40001)
                 if digital_root_trace(9 * k)[0] != 9), None)
note(mult_bad is None, "EVERY positive multiple of 9 up to 360000 lands on 9",
     str(mult_bad))
# And the converse: landing on 9 implies divisible by 9 (so the caveat is exact,
# it does not over-fire on inputs that are fine).
conv_bad = next((n for n in range(0, 200001)
                 if digital_root_trace(n)[0] == 9 and n % 9 != 0), None)
note(conv_bad is None, "caveat is exact: landing on 9 implies divisible by 9",
     str(conv_bad))
note(all(r != 9 for r in range(9)), "remainder 9 impossible by division algorithm")

# ---------------------------------------------------------------- outside the domain
print("Outside the stated domain (must be excluded, not relied on)", file=sys.stderr)
# Negative n: payload excludes it. Confirm it really is ambiguous/broken, i.e. the
# exclusion is honest and not hiding a case the rule would have handled anyway.
neg_trunc = int(-6656 - (-6656 // 9) * 9) if False else -(6656 % 9)   # truncated: -5
neg_floor = (-6656) % 9                                               # floored: 4
note(neg_trunc != neg_floor,
     "negative n genuinely ambiguous: truncated vs floored remainder differ",
     f"trunc {neg_trunc} vs floor {neg_floor}")
note(digital_root_trace(6656)[0] == 5,
     "digit sum of |n| cannot select between them (gives 5, neither -5 nor 4)")
# Other bases: payload excludes. Confirm the base-10 procedure does NOT give mod 9
# in another base, i.e. the exclusion is necessary.
def digitsum_base(n, b):
    s = 0
    while n:
        n, r = divmod(n, b)
        s += r
    return s
base8_counter = next((n for n in range(1, 5000)
                      if digitsum_base(n, 8) % 9 != n % 9), None)
note(base8_counter is not None,
     "base-8 digit sums do NOT give mod 9, so the base-10-only claim is necessary",
     f"witness n = {base8_counter}")

# ---------------------------------------------------------------- C8 draw spec
print("C8 declared draw spec self-consistency", file=sys.stderr)
lo, hi = 1000, 9999
all_pass = all(len(str(n)) == 4 and n > 0 for n in range(lo, hi + 1))
note(all_pass, "every integer in [1000,9999] passes the declared filter")
note(all_pass, "=> claimed rejection_rate 0 is consistent (filter is a no-op)")
note(lo <= 6656 <= hi, "drawn operand 6656 lies inside the declared range")
# A filter that quietly removed the failure cases would have excluded multiples of 9.
mult9_in_range = [n for n in range(lo, hi + 1) if n % 9 == 0 and len(str(n)) == 4]
note(len(mult9_in_range) > 0,
     "the filter does NOT exclude multiples of 9 (the failure mode stays reachable)",
     f"{len(mult9_in_range)} multiples of 9 survive the filter")
# The drawn value must also actually exercise the second round the lesson needs.
note(digitsum(6656) >= 10, "drawn value does force the second round (digit sum 23 >= 10)")

# ---------------------------------------------------------------- verdict
agrees = not FAILURES
if FAILURES:
    print("FAILURES: " + "; ".join(FAILURES), file=sys.stderr)

print(json.dumps({
    "claim_id": "remainder-mod-9-digit-sum",
    "computed": str(WORKED),
    "agrees": agrees,
}))
