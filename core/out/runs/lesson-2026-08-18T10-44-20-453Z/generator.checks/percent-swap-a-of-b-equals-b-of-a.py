"""Generator-side check for lesson `percent-swap-a-of-b-equals-b-of-a` (Math tricks #5).

Confirms, from the STATED RULE and not by re-walking the card steps:
  1. the worked example 3% of 125 = 3.75, computed directly;
  2. the universality claim "a% of b = b% of a for all real a, b" - symbolically, and
     exhaustively over a stated finite domain;
  3. the carry case: the swap fails for "off" - 20% off 50 = 40 but 50% off 20 = 10 -
     and in general a% off b = b% off a only when a = b;
  4. the operand draw is the one the declared seed + spec produce (mulberry32 replay).
"""

from sympy import Rational, symbols, simplify, solve, Eq

failures = []


def check(label, ok, detail=""):
    print(("PASS  " if ok else "FAIL  ") + label + ((" | " + detail) if detail else ""))
    if not ok:
        failures.append(label)


# ---------------------------------------------------------------- 1. worked example
a, b = 3, 125
direct = Rational(a, 100) * b                      # 3% of 125, straight from the definition
swapped = Rational(b, 100) * a                     # 125% of 3
check("worked example 3% of 125 = 3.75",
      direct == Rational(15, 4) and float(direct) == 3.75,
      f"direct={direct} ({float(direct)})")
check("swap gives the same value for the worked example",
      direct == swapped, f"3%of125={direct}, 125%of3={swapped}")

# ------------------------------------------------- 2. universality of the "of" swap
x, y = symbols("x y", real=True)
sym_gap = simplify(x / 100 * y - y / 100 * x)
check("symbolic: a%*b - b%*a simplifies to 0 for real a, b",
      sym_gap == 0, f"gap={sym_gap}")

# Exhaustive over the stated finite domain: all integer pairs 1..300 (90,000 pairs).
DOMAIN = range(1, 301)
bad = [(i, j) for i in DOMAIN for j in DOMAIN
       if Rational(i, 100) * j != Rational(j, 100) * i]
check(f"exhaustive: a% of b == b% of a for all integers 1..300 ({len(DOMAIN)**2} pairs)",
      not bad, f"counterexamples={bad[:3]}")

# Non-integer spot domain, since applicability claims all reals, not just integers.
tenths = [Rational(n, 10) for n in range(1, 200)]
bad_t = [(i, j) for i in tenths[:60] for j in tenths[:60]
         if Rational(i, 100) * j != Rational(j, 100) * i]
check("exhaustive: same holds on tenths 0.1..6.0", not bad_t, f"counterexamples={bad_t[:3]}")

# ------------------------------------------------------------------ 3. carry case
def off(pct, price):
    """price after pct% off it."""
    return price - Rational(pct, 100) * price


check("carry case: 20% off 50 = 40", off(20, 50) == 40, f"={off(20,50)}")
check("carry case: 50% off 20 = 10", off(50, 20) == 10, f"={off(50,20)}")
check("carry case actually breaks the swap (40 != 10)", off(20, 50) != off(50, 20))

sols = solve(Eq(y - x / 100 * y, x - y / 100 * x), y)
check("a% off b == b% off a only when a = b",
      sols == [x], f"solve gave {sols}")

off_bad = [(i, j) for i in range(1, 101) for j in range(1, 101)
           if i != j and off(i, j) == off(j, i)]
check("exhaustive: no unequal integer pair 1..100 satisfies the 'off' swap",
      not off_bad, f"counterexamples={off_bad[:3]}")

# ------------------------------------------------------- 4. operand draw reproduces
def mulberry32(seed):
    a_ = seed & 0xFFFFFFFF

    def nxt():
        nonlocal a_
        a_ = (a_ + 0x6D2B79F5) & 0xFFFFFFFF
        t = a_
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + ((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF) & 0xFFFFFFFF
        t &= 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return nxt


nxt = mulberry32(343466150)
lo, hi = 2, 9
replay = [lo + int(nxt() * (hi - lo + 1)) for _ in range(2)]
check("declared seed 343466150 + spec {min:2,max:9} replays to [3, 5]",
      replay == [3, 5], f"replay={replay}")
check("mapping draws -> operands: a=draws[0]=3, b=25*draws[1]=125",
      replay[0] == a and 25 * replay[1] == b, f"a={replay[0]}, b={25*replay[1]}")

print()
print("RESULT:", "ALL CHECKS PASSED" if not failures else f"{len(failures)} FAILED: {failures}")
raise SystemExit(1 if failures else 0)
