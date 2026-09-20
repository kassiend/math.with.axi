"""
Planner-side sanity check for the lesson `divisibility-by-7-double-and-subtract`.

This confirms two things the Verifier will independently re-check:
  1. The worked example 497 is divisible by 7 and reduces to 35 by the stated rule.
  2. The stated universality — "for any positive integer with 2+ digits, iterating
     (a - 2b) reduces to a value congruent to N mod 7, so divisibility is preserved" —
     holds exhaustively over a declared finite domain (2..6 digit positive integers).
  3. The carry_case 1001 requires a second pass and does end at −7 (divisible by 7).
"""

from sympy import Integer


def reduce_once(n: int) -> int:
    """Apply the rule once: split off the last digit b, take the rest a, return a - 2*b."""
    a, b = divmod(n, 10)
    return a - 2 * b


def iterate(n: int) -> int:
    """Iterate the rule until |value| < 10, so the answer is a single-digit signed int."""
    x = n
    while abs(x) >= 10:
        x = reduce_once(x)
    return x


# ---------------------------------------------------------------------------
# (1) worked example
# ---------------------------------------------------------------------------
n = 497
one_pass = reduce_once(n)  # 49 - 2*7 = 35
assert one_pass == 35, f"one-pass mismatch: expected 35, got {one_pass}"
assert n % 7 == 0, f"{n} is not divisible by 7"
assert n // 7 == 71, f"{n} / 7 = {n // 7}, expected 71"
assert one_pass % 7 == 0, "reduced value must also be divisible by 7"
print(f"worked example ok: {n} -> {one_pass} (=5*7), and {n} = 71 * 7")

# ---------------------------------------------------------------------------
# (2) universality claim — exhaustive over positive integers with 2..6 digits
#     For each N, iterate the rule and confirm the small final value has the same
#     divisibility-by-7 status as N itself.
# ---------------------------------------------------------------------------
mismatches = []
for N in range(10, 10**6 + 1):
    small = iterate(N)
    if (N % 7 == 0) != (small % 7 == 0):
        mismatches.append((N, small))
        if len(mismatches) > 5:
            break

assert not mismatches, f"universality broken at: {mismatches[:5]}"
print(f"universality ok: rule preserves divisibility-by-7 over 10..1,000,000 "
      f"({10**6 - 9} integers tested)")

# ---------------------------------------------------------------------------
# (3) carry_case — 1001 needs two passes, ends at -7
# ---------------------------------------------------------------------------
pass1 = reduce_once(1001)      # 100 - 2 = 98
pass2 = reduce_once(pass1)     # 9 - 16 = -7
assert pass1 == 98, f"expected 98 after one pass, got {pass1}"
assert pass2 == -7, f"expected -7 after two passes, got {pass2}"
assert 1001 % 7 == 0, "1001 must actually be divisible by 7 for the caveat to make sense"
assert pass2 % 7 == 0
print(f"carry_case ok: 1001 -> {pass1} -> {pass2}, all divisible by 7")

# ---------------------------------------------------------------------------
# (4) sanity: rule is a mod-7 invariant, provable algebraically
#     N = 10a + b; rule(N) = a - 2b.
#     N - (-2)*rule(N) = 10a + b + 2a - 4b = 12a - 3b = 3(4a - b), not obviously = 7k.
#     Instead: 3 * rule(N) = 3a - 6b ≡ 3a + b ≡ 10a + b - 7a ≡ N  (mod 7).
#     So 7 | N  iff  7 | 3*rule(N)  iff  7 | rule(N)  (since gcd(3,7)=1).
# ---------------------------------------------------------------------------
from sympy import symbols, simplify, Mod
a, b = symbols("a b", integer=True, nonnegative=True)
N = 10 * a + b
rule = a - 2 * b
# 3 * rule - N = 3a - 6b - 10a - b = -7a - 7b = -7(a+b)
diff = simplify(3 * rule - N + 7 * (a + b))
assert diff == 0, f"algebraic identity failed: 3*rule(N) - N + 7(a+b) = {diff}"
print("algebraic invariant ok: 3 * (a - 2b) ≡ (10a + b) (mod 7)")

print("\nALL PLANNER CHECKS PASSED")
