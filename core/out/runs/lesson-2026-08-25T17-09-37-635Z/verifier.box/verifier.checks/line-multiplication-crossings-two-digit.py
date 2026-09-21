#!/usr/bin/env python
"""
Independent check of lesson claim `line-multiplication-crossings-two-digit`,
derived from the payload text ONLY (method + applicability + carry_case).

Claim as stated in the payload:
  * Domain: two two-digit whole numbers, no zero digit.
  * Bands, left to right: hundreds = a1*b1, tens = a1*b0 + a0*b1, units = a0*b0
    (crossing counts of the line diagram).
  * "Reading the three counts straight off as the digits of the answer is valid
     exactly when the units band and the tens band are each below 10."
  * "The leftmost band is not restricted -- a count of 10 or more there simply
     spills into the thousands digit and still reads correctly."
  * carry_case: 23*22 -> 4|10|6 -> 506 ; 34*25 breaks via units band ;
     21*51 -> 10|7|1 reads off as 1071.
  * worked_example: 12*23 -> bands 2|7|6 -> "276".
"""
import json
from sympy import Integer, symbols, expand, simplify

CLAIM = "line-multiplication-crossings-two-digit"

def bands(a, b):
    a1, a0 = divmod(a, 10)
    b1, b0 = divmod(b, 10)
    return a1 * b1, a1 * b0 + a0 * b1, a0 * b0

def straight_read(H, T, U):
    """Read the three counts straight off, left to right, as written digits."""
    return Integer(str(H) + str(T) + str(U))

failures = []

# ---- 0. symbolic identity behind the diagram -------------------------------
a1, a0, b1, b0 = symbols("a1 a0 b1 b0", integer=True)
lhs = (10 * a1 + a0) * (10 * b1 + b0)
rhs = 100 * (a1 * b1) + 10 * (a1 * b0 + a0 * b1) + (a0 * b0)
if simplify(expand(lhs - rhs)) != 0:
    failures.append("symbolic band identity fails")

# ---- 1. the worked example --------------------------------------------------
H, T, U = bands(12, 23)
worked = straight_read(H, T, U)
if (H, T, U) != (2, 7, 6):
    failures.append("worked-example bands != 2|7|6, got %s" % ((H, T, U),))
if worked != 12 * 23 or worked != 276:
    failures.append("worked-example read-off %s != 276" % worked)

# ---- 2. full domain sweep: no zero digit, both two-digit --------------------
DOMAIN = [n for n in range(11, 100) if n % 10 != 0 and (n // 10) != 0]
carry_free_ok = carry_free_bad = 0
left_big_ok = 0
for a in DOMAIN:
    for b in DOMAIN:
        H, T, U = bands(a, b)
        prod = a * b
        # place-value identity must hold for every pair in the domain
        if 100 * H + 10 * T + U != prod:
            failures.append("place-value identity fails at %d*%d" % (a, b))
        ok = (straight_read(H, T, U) == prod)
        cond = (T < 10 and U < 10)          # payload's stated condition
        if cond != ok:                       # "valid EXACTLY when"
            failures.append(
                "applicability condition wrong at %d*%d: bands %s, cond=%s, read-off ok=%s"
                % (a, b, (H, T, U), cond, ok))
        if cond:
            carry_free_ok += ok
            carry_free_bad += (not ok)
            if H >= 10:                      # "leftmost band is not restricted"
                if not ok:
                    failures.append("left band >=10 breaks read-off at %d*%d" % (a, b))
                left_big_ok += 1
if left_big_ok == 0:
    failures.append("no witness found for the unrestricted-left-band claim")
if carry_free_bad:
    failures.append("%d carry-free pairs failed straight read-off" % carry_free_bad)

# ---- 3. the payload's three named cases -------------------------------------
named = [
    (23, 22, (4, 10, 6), 506, False),   # tens band 10 -> breaks, true answer 506
    (34, 25, None,       850, False),   # units band 20 -> breaks
    (21, 51, (10, 7, 1), 1071, True),   # left band 10 -> still reads off
    (12, 23, (2, 7, 6),  276,  True),
]
for a, b, want_bands, want_prod, want_ok in named:
    H, T, U = bands(a, b)
    if want_bands is not None and (H, T, U) != want_bands:
        failures.append("bands for %d*%d: got %s want %s" % (a, b, (H, T, U), want_bands))
    if a * b != want_prod:
        failures.append("product %d*%d = %d, payload says %d" % (a, b, a * b, want_prod))
    if (straight_read(H, T, U) == a * b) != want_ok:
        failures.append("read-off status wrong for %d*%d" % (a, b))
    # carrying left from an over-full band must repair every case
    carried = 100 * H + 10 * T + U
    if carried != a * b:
        failures.append("carry repair fails for %d*%d" % (a, b))
# 34*25 must genuinely be broken by the UNITS band specifically (payload's reason)
_, _, u3425 = bands(34, 25)
if u3425 < 10:
    failures.append("34*25 units band is %d, not >=10 as payload claims" % u3425)

# ---- 4. boundary just outside the stated domain ------------------------------
# zero digit: excluded by the payload for drawing reasons only. Confirm that the
# exclusion is a rendering exclusion, not a mathematical one (identity survives).
for a, b in [(10, 23), (20, 30), (12, 20), (10, 10)]:
    H, T, U = bands(a, b)
    if 100 * H + 10 * T + U != a * b:
        failures.append("identity unexpectedly fails at zero-digit pair %d*%d" % (a, b))
# Three-digit operands sit outside the stated domain. The band arithmetic is a
# SPLIT identity (true for any a = 10*a1 + a0), so it survives; what fails is the
# drawing/read-off, because a1 = 12 is not a digit and cannot be drawn as lines.
# The payload's domain restriction must therefore be doing real work: check that
# straight read-off genuinely breaks there.
for a, b in [(123, 23), (105, 34)]:
    H, T, U = bands(a, b)
    if straight_read(H, T, U) == a * b:
        failures.append("read-off unexpectedly still works outside domain at %d*%d" % (a, b))

agrees = not failures
print(json.dumps({
    "claim_id": CLAIM,
    "computed": str(worked),
    "agrees": bool(agrees),
}))
