"""Planner-side check for lesson `multiply-equidistant-difference-of-squares` (Math tricks #4).

Confirms, independently of the on-screen steps:
  1. the worked example 53 x 67 = 3551 by direct multiplication;
  2. the identity a*b = m^2 - d^2 symbolically (SymPy), matching theorem `difference-of-squares`;
  3. the stated applicability exhaustively over a declared finite domain
     (all ordered pairs a <= b with 10 <= a, b <= 99 and a + b even);
  4. that the carry case 53 x 68 really breaks the whole-number form, and that no even-sum
     pair in the domain breaks it;
  5. that the operands were produced by the declared seeded draw (mulberry32 replay).
"""

import sympy as sp

FAILURES = []


def check(label, ok, detail=""):
    print(("PASS  " if ok else "FAIL  ") + label + (("  -- " + detail) if detail else ""))
    if not ok:
        FAILURES.append(label)


# ---------------------------------------------------------------- 1. worked example
A, B = 53, 67
check("worked example 53*67 == 3551", A * B == 3551, f"53*67 = {A*B}")
m, d = (A + B) // 2, (B - A) // 2
check("midpoint/half-gap are 60 and 7", (m, d) == (60, 7), f"m={m}, d={d}")
check("60^2 - 7^2 == 3551", m**2 - d**2 == 3551, f"{m**2} - {d**2} = {m**2 - d**2}")

# ---------------------------------------------------------------- 2. identity, symbolic
sm, sd = sp.symbols("m d")
lhs = (sm - sd) * (sm + sd)
rhs = sm**2 - sd**2
check("symbolic (m-d)(m+d) - (m^2-d^2) == 0", sp.simplify(sp.expand(lhs - rhs)) == 0)

# The method's own form: given a, b with a+b even, m=(a+b)/2, d=(b-a)/2 => a*b = m^2 - d^2.
sa, sb = sp.symbols("a b")
mm, dd = (sa + sb) / 2, (sb - sa) / 2
check("symbolic a*b == ((a+b)/2)^2 - ((b-a)/2)^2",
      sp.simplify(sp.expand(mm**2 - dd**2 - sa * sb)) == 0)

# ---------------------------------------------------------------- 3+4. exhaustive domain
even_pairs = odd_pairs = 0
bad_even = []
non_integer_midpoint = []
for a in range(10, 100):
    for b in range(a, 100):
        if (a + b) % 2 == 0:
            even_pairs += 1
            mi, di = (a + b) // 2, (b - a) // 2
            if mi**2 - di**2 != a * b:
                bad_even.append((a, b))
        else:
            odd_pairs += 1
            if sp.Rational(a + b, 2).q != 1:      # midpoint is a true half-integer
                non_integer_midpoint.append((a, b))

check("every even-sum 2-digit pair satisfies a*b = m^2 - d^2",
      not bad_even, f"{even_pairs} pairs checked, {len(bad_even)} counterexamples")
check("every odd-sum 2-digit pair has a non-integer midpoint (rule not applicable)",
      len(non_integer_midpoint) == odd_pairs,
      f"{odd_pairs} odd-sum pairs, {len(non_integer_midpoint)} with half-integer midpoint")

# the declared carry case, concretely
ca, cb = 53, 68
check("carry case 53 x 68 has odd sum", (ca + cb) % 2 == 1, f"sum = {ca+cb}")
naive = (ca + cb) // 2  # what a viewer doing integer division 'in their head' would use
check("carry case: naive whole-number midpoint 60 gives the wrong answer",
      naive**2 - ((cb - ca) // 2) ** 2 != ca * cb,
      f"naive {naive}^2 - {(cb-ca)//2}^2 = {naive**2 - ((cb-ca)//2)**2}, true product = {ca*cb}")
check("carry case fix: 53*67 + 53 == 53*68",
      53 * 67 + 53 == ca * cb, f"3551 + 53 = {53*67+53}, 53*68 = {ca*cb}")
# and the half-integer form is still exact, it is just not mental arithmetic
hm, hd = sp.Rational(ca + cb, 2), sp.Rational(cb - ca, 2)
check("carry case: half-integer form still exact (60.5^2 - 7.5^2)",
      hm**2 - hd**2 == ca * cb, f"{hm}^2 - {hd}^2 = {hm**2 - hd**2}")

# ---------------------------------------------------------------- 5. seeded draw replay
def mulberry32(seed):
    a = seed & 0xFFFFFFFF

    def imul(x, y):
        r = (x * y) & 0xFFFFFFFF
        return r - 0x100000000 if r >= 0x80000000 else r

    def nxt():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = imul(t ^ (t >> 15), t | 1) & 0xFFFFFFFF
        t ^= (t + imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF
        t &= 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return nxt


nxt = mulberry32(288346991)
lo, hi = 2, 9
draws = [lo + int(nxt() * (hi - lo + 1)) for _ in range(2)]
check("declared seed 288346991 over [2,9] reproduces draws [6, 7]", draws == [6, 7], str(draws))
t, gap = draws
check("draw -> operands 53 and 67", (10 * t - gap, 10 * t + gap) == (53, 67),
      f"midpoint {10*t}, gap {gap}")

print()
print("RESULT:", "ALL CHECKS PASSED" if not FAILURES else f"{len(FAILURES)} FAILED: {FAILURES}")
