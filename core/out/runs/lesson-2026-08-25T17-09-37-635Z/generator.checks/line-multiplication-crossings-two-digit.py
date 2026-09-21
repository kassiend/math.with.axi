"""
Generator check - lesson "line-multiplication-crossings-two-digit" (Math tricks #7).

Confirms, independently of the drawing code and of the displayed steps:

  1. the worked example 12 x 23 = 276, computed directly;
  2. the band counts on the card (2 | 7 | 6) are the digit products they claim to be,
     and that the drawn pair needs no carry, so the card's read-off is honest;
  3. the identity the method rests on, symbolically;
  4. the stated carry_case really does break the straight read-off;
  5. the applicability claim, exhaustively over its declared finite domain
     (all two-digit a, b with no zero digit - 81 x 81 = 6561 pairs), in three parts:
       a. carrying the bands always reproduces a*b;
       b. the straight read-off is correct EXACTLY when the units band and the tens band
          are both below 10 - an "iff", so both a false positive and a false negative fail;
       c. the leftmost band is genuinely unrestricted: pairs with a hundreds band of 10 or
          more exist and still read off correctly (21 x 51 -> 10 | 7 | 1 -> 1071).

  (5c) is the reason applicability does not say "every band below 10". That looser wording is
  false, and stating it would teach a restriction the method does not have.

The FINAL line on stdout is the orchestrator contract line: one line of JSON carrying the
claim id, the computed worked-example result, and whether every assertion above passed.
"""

import atexit
import json

from sympy import Integer, expand, symbols

CLAIM_ID = "line-multiplication-crossings-two-digit"

FAILURES = []
COMPLETED = False


@atexit.register
def emit_contract_line():
    """The orchestrator reads only the last stdout line, so it must always exist.

    Registered at exit rather than called inline: if an assertion path raises, the
    traceback goes to stderr and this still lands last on stdout, reporting
    agrees=false rather than leaving the orchestrator with nothing to parse.
    """
    result = globals().get("product")
    print(json.dumps({
        "claim_id": CLAIM_ID,
        "computed": None if result is None else str(result),
        "agrees": bool(COMPLETED and not FAILURES),
    }))


def check(label, ok, detail=""):
    print(("PASS  " if ok else "FAIL  ") + label + (("  " + detail) if detail else ""))
    if not ok:
        FAILURES.append(label)


# --- 1. the worked example, computed directly, not by re-walking the steps ---
A, B = 12, 23
product = Integer(A) * Integer(B)
check("worked example 12 x 23 = 276", product == 276, "sympy gives %s" % product)


# --- the model ---------------------------------------------------------------
def bands(a, b):
    """Crossings per diagonal band, left to right: (hundreds, tens, units)."""
    a1, a0 = divmod(a, 10)
    b1, b0 = divmod(b, 10)
    return a1 * b1, a1 * b0 + a0 * b1, a0 * b0


def read_off(a, b):
    """The SIMPLE rule: write the three band counts side by side, no carrying."""
    h, t, u = bands(a, b)
    return int("%d%d%d" % (h, t, u))


def carry_assemble(a, b):
    """The method as performed by hand: carry out of units, then out of tens."""
    h, t, u = bands(a, b)
    d0 = u % 10
    t += u // 10
    d1 = t % 10
    h += t // 10
    return int("%d%d%d" % (h, d1, d0))


# --- 2. the numbers printed on the card --------------------------------------
h, t, u = bands(A, B)
check("bands of 12 x 23 are 2 | 7 | 6", (h, t, u) == (2, 7, 6), "got %s | %s | %s" % (h, t, u))
check("drawn pair needs no carry (tens and units bands below 10)", t < 10 and u < 10)
check("reading 2 | 7 | 6 off gives 276", read_off(A, B) == 276, "got %s" % read_off(A, B))
check("total crossings countable on a phone", (h + t + u) == 15, "got %s dots" % (h + t + u))

# the compare step's claim: band -> digit product -> place value -> sum
a1, a0 = divmod(A, 10)
b1, b0 = divmod(B, 10)
columns = [a1 * b1 * 100, (a1 * b0 + a0 * b1) * 10, a0 * b0]
check("columns 200 + 70 + 6 sum to the product", sum(columns) == A * B,
      "%s -> %s" % (columns, sum(columns)))


# --- 3. the identity, symbolically -------------------------------------------
s_a1, s_a0, s_b1, s_b0 = symbols("a1 a0 b1 b0")
lhs = expand((10 * s_a1 + s_a0) * (10 * s_b1 + s_b0))
rhs = expand(100 * (s_a1 * s_b1) + 10 * (s_a1 * s_b0 + s_a0 * s_b1) + s_a0 * s_b0)
check("identity (10a1+a0)(10b1+b0) = 100H + 10T + U", expand(lhs - rhs) == 0)


# --- 4. the carry_case actually breaks the simple rule -----------------------
check("carry_case 23 x 22: bands are 4 | 10 | 6", bands(23, 22) == (4, 10, 6),
      "got %s" % (bands(23, 22),))
check("carry_case 23 x 22: straight read-off is WRONG", read_off(23, 22) != 23 * 22,
      "read-off %s vs true %s" % (read_off(23, 22), 23 * 22))
check("carry_case 23 x 22: carrying gives 506", carry_assemble(23, 22) == 506 == 23 * 22,
      "got %s" % carry_assemble(23, 22))
check("units-band carry 34 x 25 also breaks the read-off", read_off(34, 25) != 34 * 25,
      "read-off %s vs true %s" % (read_off(34, 25), 34 * 25))


# --- 5. exhaustive check over the declared finite domain ---------------------
DOMAIN = [n for n in range(10, 100) if n % 10 != 0]
PAIRS = len(DOMAIN) ** 2

bad_carry, bad_iff, big_left = [], [], []
for a in DOMAIN:
    for b in DOMAIN:
        H, T, U = bands(a, b)
        if carry_assemble(a, b) != a * b:
            bad_carry.append((a, b))
        stated = (T < 10 and U < 10)          # what applicability claims
        actual = (read_off(a, b) == a * b)    # what is true
        if stated != actual:
            bad_iff.append((a, b, H, T, U, read_off(a, b), a * b))
        if H >= 10 and actual:
            big_left.append((a, b))

check("5a. carrying the bands reproduces a*b for all %d pairs" % PAIRS,
      not bad_carry, "counterexamples: %s" % bad_carry[:5])
check("5b. read-off correct IFF tens band < 10 and units band < 10",
      not bad_iff, "counterexamples: %s" % bad_iff[:5])
check("5c. leftmost band may be 10 or more and still read off correctly",
      len(big_left) > 0 and (21, 51) in big_left,
      "%d such pairs, e.g. 21 x 51 -> %s -> %s" % (len(big_left), bands(21, 51), read_off(21, 51)))

# the looser wording this lesson deliberately does NOT use, shown to be false
loose_wrong = [(a, b) for (a, b) in big_left if max(bands(a, b)) >= 10]
check("'every band below 10' would be a FALSE applicability statement",
      len(loose_wrong) > 0, "e.g. %s reads off correctly with a band of 10+" % (loose_wrong[0],))

n_clean = sum(1 for a in DOMAIN for b in DOMAIN if read_off(a, b) == a * b)
print("      read-off works for %d of %d no-zero-digit pairs (%.1f%%); the rest carry."
      % (n_clean, PAIRS, 100.0 * n_clean / PAIRS))
check("zero digit excluded from the domain (undrawable: no lines)",
      all(n % 10 != 0 for n in DOMAIN))


# --- 6. the seeded draw is the one reported ----------------------------------
DRAWS = [1, 2, 2, 3]
check("operands assembled from the declared draw [1,2,2,3]",
      (10 * DRAWS[0] + DRAWS[1], 10 * DRAWS[2] + DRAWS[3]) == (A, B),
      "-> %s x %s" % (10 * DRAWS[0] + DRAWS[1], 10 * DRAWS[2] + DRAWS[3]))
check("drawn digits are non-zero and at most 3",
      all(1 <= d <= 3 for d in DRAWS))

COMPLETED = True   # every check above was reached and reported

print()
print("RESULT: " + ("ALL CHECKS PASSED" if not FAILURES else "FAILED -> " + ", ".join(FAILURES)))

# the contract line is printed by emit_contract_line() at exit, after this point
raise SystemExit(1 if FAILURES else 0)
