"""
Generator check — lesson "line-multiplication-crossings-two-digit" (Math tricks #7).

Confirms, independently of the drawing code:
  1. the worked example 23 x 22 = 506, computed directly;
  2. the band counts shown on the card (4 | 10 | 6) are the digit products they claim to be;
  3. the stated carry_case really does break the naive "read the counts off" rule;
  4. the stated applicability holds exhaustively over its declared finite domain
     (all two-digit a, b with no zero digit), for BOTH claims:
       - carrying the bands always reproduces a*b,
       - the naive read-off is correct exactly when every band count is below 10.
"""

from sympy import Integer, symbols, expand

FAILURES = []


def check(label, ok, detail=""):
    print(("PASS  " if ok else "FAIL  ") + label + (("  " + detail) if detail else ""))
    if not ok:
        FAILURES.append(label)


# --- 1. the worked example, computed directly -------------------------------
A, B = 23, 22
product = Integer(A) * Integer(B)
check("worked example 23 x 22 = 506", product == 506, "sympy gives %s" % product)


# --- band model -------------------------------------------------------------
def bands(a, b):
    """Crossings per diagonal band: (hundreds, tens, units)."""
    a1, a0 = divmod(a, 10)
    b1, b0 = divmod(b, 10)
    return a1 * b1, a1 * b0 + a0 * b1, a0 * b0


def carry_assemble(a, b):
    """The method as performed by hand: carry from the units band leftwards."""
    h, t, u = bands(a, b)
    d0 = u % 10
    t += u // 10
    d1 = t % 10
    h += t // 10
    return int(str(h) + str(d1) + str(d0))


def naive_readoff(a, b):
    """The SIMPLE rule with no carrying: just concatenate the three band counts."""
    h, t, u = bands(a, b)
    return int(str(h) + str(t) + str(u))


# --- 2. the band counts on the card -----------------------------------------
h, t, u = bands(A, B)
check("bands of 23 x 22 are 4 | 10 | 6", (h, t, u) == (4, 10, 6), "got %s | %s | %s" % (h, t, u))
check("carrying the bands gives 506", carry_assemble(A, B) == 506,
      "got %s" % carry_assemble(A, B))

# the identity the method rests on, symbolically
a1, a0, b1, b0 = symbols("a1 a0 b1 b0")
lhs = expand((10 * a1 + a0) * (10 * b1 + b0))
rhs = expand(100 * (a1 * b1) + 10 * (a1 * b0 + a0 * b1) + (a0 * b0))
check("identity (10a1+a0)(10b1+b0) = 100*H + 10*T + U", expand(lhs - rhs) == 0)


# --- 3. the carry_case really breaks the simple rule -------------------------
check("carry_case: naive read-off of 23 x 22 is NOT 506",
      naive_readoff(A, B) != 506, "naive gives %s" % naive_readoff(A, B))
check("carry_case: 34 x 25 also breaks the naive rule",
      naive_readoff(34, 25) != 34 * 25,
      "naive %s vs true %s" % (naive_readoff(34, 25), 34 * 25))


# --- 4. exhaustive check over the declared finite domain ---------------------
DOMAIN = [n for n in range(10, 100) if n % 10 != 0]
bad_carry = []
bad_equiv = []
clean_example = None
for a in DOMAIN:
    for b in DOMAIN:
        if carry_assemble(a, b) != a * b:
            bad_carry.append((a, b))
        all_small = max(bands(a, b)) < 10
        naive_ok = naive_readoff(a, b) == a * b
        if all_small != naive_ok:
            bad_equiv.append((a, b))
        if all_small and clean_example is None:
            clean_example = (a, b)

check("applicability: carrying the bands reproduces a*b for all %d pairs" % (len(DOMAIN) ** 2),
      not bad_carry, "counterexamples: %s" % bad_carry[:5])
check("applicability: naive read-off correct EXACTLY when every band < 10",
      not bad_equiv, "counterexamples: %s" % bad_equiv[:5])

n_clean = sum(1 for a in DOMAIN for b in DOMAIN if max(bands(a, b)) < 10)
print("      no-carry pairs: %d of %d (%.1f%%); carry pairs exist, e.g. %s" %
      (n_clean, len(DOMAIN) ** 2, 100.0 * n_clean / len(DOMAIN) ** 2, (A, B)))
print("      a clean no-carry pair for comparison: %s -> %s" %
      (clean_example, naive_readoff(*clean_example)))

# --- zero digit: the reason the domain excludes it --------------------------
check("zero digit is excluded from the domain (undrawable, 0 lines)",
      all(a % 10 != 0 for a in DOMAIN))

print()
print("RESULT: " + ("ALL CHECKS PASSED" if not FAILURES else "FAILED -> " + ", ".join(FAILURES)))
raise SystemExit(1 if FAILURES else 0)
