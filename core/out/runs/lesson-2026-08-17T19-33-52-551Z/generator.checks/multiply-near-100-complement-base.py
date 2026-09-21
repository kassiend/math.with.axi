"""
Generator-side check for lesson `multiply-near-100-complement-base`.

Confirms, from the STATED RULE rather than by replaying the card:
  1. the worked example 97 x 92 = 8924, computed directly,
  2. the arithmetic actually printed on the five cards,
  3. the identity itself, symbolically, for all a and b,
  4. the applicability claim, exhaustively over the stated finite domain [91,99]^2,
  5. that the two-digit pad in the rule statement is load-bearing, not decoration,
  6. that the carry case 88 x 89 really does break the digit step,
  7. that the break condition is the gap product exceeding 99 and NOT "a gap reached
     two digits" (90 x 91 separates those two), together with the single degenerate
     escape stated in carry_case: a cross-subtraction of 0, as in 50 x 50.

Prints one JSON line: {"claim_id": ..., "computed": ..., "agrees": ...}
`computed` is the worked example's answer as a bare integer string, which is what
worked_example.result declares.
"""

import json
from sympy import Integer, symbols, expand, simplify

CLAIM_ID = "multiply-near-100-complement-base"

X, Y = 97, 92           # drawn: seed 288838249, spec {min:91, max:99}, n=2
DECLARED_RESULT = "8924"
BASE = 100
LO, HI = 91, 99         # the declared applicability domain
CARRY_X, CARRY_Y = 88, 89

failures = []


def gap(n):
    """Distance from the base."""
    return BASE - n


def digit_rule(x, y):
    """
    The rule EXACTLY as taught: cross-subtract for the left block, multiply the
    gaps for the right block, write the right block as TWO digits, read the two
    blocks side by side as one number. Returns None if a block cannot be written
    (negative left block), which is itself a failure of the digit step.
    """
    left = x - gap(y)
    right = gap(x) * gap(y)
    if left < 0 or right < 0:
        return None
    return int(str(left) + "%02d" % right) if right < 100 else int(str(left) + str(right))


def unpadded_rule(x, y):
    """The same thing with the pad dropped -- what a viewer does if the card omits 'two digits'."""
    return int(str(x - gap(y)) + str(gap(x) * gap(y)))


def identity_value(x, y):
    """The algebra, with no digit step at all: 100*(100-a-b) + a*b."""
    a, b = gap(x), gap(y)
    return BASE * (BASE - a - b) + a * b


# --- 1. worked example, computed directly, not by walking the trick -----------
# sympy multiplies; the trick is never used to establish the answer it predicts.
true_product = int(Integer(X) * Integer(Y))
if str(true_product) != DECLARED_RESULT:
    failures.append("worked example: 97 x 92 = %d, card declares %s" % (true_product, DECLARED_RESULT))

# --- 2. the arithmetic printed on the cards ----------------------------------
if gap(X) != 3:
    failures.append("card s2: 100 - 97 is %d, card shows 3" % gap(X))
if gap(Y) != 8:
    failures.append("card s2: 100 - 92 is %d, card shows 8" % gap(Y))
if X - gap(Y) != 89:
    failures.append("card s3: 97 - 8 is %d, card shows 89" % (X - gap(Y)))
if Y - gap(X) != 89:
    failures.append("cross-subtraction disagrees: 92 - 3 = %d, not 89" % (Y - gap(X)))
if gap(X) * gap(Y) != 24:
    failures.append("card s4: 3 x 8 is %d, card shows 24" % (gap(X) * gap(Y)))
if digit_rule(X, Y) != true_product:
    failures.append("card s4: digit rule gives %s, true product %d" % (digit_rule(X, Y), true_product))

# --- 3. the identity, symbolically, for every a and b ------------------------
a, b = symbols("a b", integer=True)
lhs = expand((BASE - a) * (BASE - b))
rhs = expand(BASE * (BASE - a - b) + a * b)
if simplify(lhs - rhs) != 0:
    failures.append("(100-a)(100-b) != 100(100-a-b) + ab symbolically")
# the cross-subtraction claim: both readings give the same left block
if simplify(((BASE - a) - b) - ((BASE - b) - a)) != 0:
    failures.append("x - b and y - a are not the same left block")

# --- 4. applicability, exhaustive over the stated finite domain ---------------
domain = [(x, y) for x in range(LO, HI + 1) for y in range(LO, HI + 1)]
bad_rule = [(x, y) for x, y in domain if digit_rule(x, y) != x * y]
if bad_rule:
    failures.append("digit rule fails inside [%d,%d]^2 at %s" % (LO, HI, bad_rule[:5]))

bad_identity = [(x, y) for x, y in domain if identity_value(x, y) != x * y]
if bad_identity:
    failures.append("identity fails inside the domain at %s" % bad_identity[:5])

# the reason the domain works: the gap product can never need a third digit
worst = max(gap(x) * gap(y) for x, y in domain)
if worst != 81 or worst > 99:
    failures.append("max gap product over the domain is %d, claim says 81 and < 100" % worst)
if any(gap(x) not in range(1, 10) for x, _ in domain):
    failures.append("a gap outside 1-9 occurred inside [91,99]")
if any(x - gap(y) < 0 for x, y in domain):
    failures.append("a negative left block occurred inside the domain")
if len(domain) != 81:
    failures.append("domain is %d pairs, expected 81" % len(domain))

# --- 5. the two-digit pad is load-bearing ------------------------------------
pad_needed = [(x, y) for x, y in domain if gap(x) * gap(y) < 10]
if not pad_needed:
    failures.append("no pair in the domain needs the leading-zero pad -- claim is idle")
bad_unpadded = [(x, y) for x, y in pad_needed if unpadded_rule(x, y) != x * y]
if len(bad_unpadded) != len(pad_needed):
    failures.append("dropping the pad did NOT break every small-gap-product pair")
# the pair named in applicability
if digit_rule(99, 98) != 9702 or unpadded_rule(99, 98) != 972:
    failures.append("99 x 98: padded %s / unpadded %s, applicability says 9702 / 972"
                    % (digit_rule(99, 98), unpadded_rule(99, 98)))

# --- 6. the carry case genuinely breaks the digit step -----------------------
carry_true = int(Integer(CARRY_X) * Integer(CARRY_Y))
ca, cb = gap(CARRY_X), gap(CARRY_Y)
if (ca, cb) != (12, 11):
    failures.append("carry case gaps are %d and %d, carry_case says 12 and 11" % (ca, cb))
if CARRY_X - cb != 77:
    failures.append("carry case left block is %d, carry_case says 77" % (CARRY_X - cb))
if ca * cb != 132:
    failures.append("carry case gap product is %d, carry_case says 132" % (ca * cb))
if carry_true != 7832:
    failures.append("88 x 89 = %d, carry_case says 7832" % carry_true)
naive_concat = int(str(CARRY_X - cb) + str(ca * cb))
if naive_concat != 77132:
    failures.append("naive concatenation for 88 x 89 is %d, carry_case says 77132" % naive_concat)
if naive_concat == carry_true:
    failures.append("carry case does not actually break the simple rule")
if BASE * (CARRY_X - cb) + ca * cb != carry_true:
    failures.append("carrying the 1 does not repair the carry case")
if (CARRY_X, CARRY_Y) in domain:
    failures.append("carry case lies inside the declared applicability domain")

# --- 7. the break condition, and its one degenerate escape -------------------
# carry_case claims the digit step is correct exactly when a*b <= 99, with one
# escape: a cross-subtraction of 0 leaves no left block for an overflow to corrupt.
WIDE_LO, WIDE_HI = 1, 99
wide = [(x, y) for x in range(WIDE_LO, WIDE_HI + 1) for y in range(WIDE_LO, WIDE_HI + 1)]


def predicted_ok(x, y):
    left = x - gap(y)
    right = gap(x) * gap(y)
    return (right <= 99 and left >= 0) or left == 0


mismatch = [(x, y) for x, y in wide if (digit_rule(x, y) == x * y) != predicted_ok(x, y)]
if mismatch:
    failures.append("stated break set is wrong; witnesses %s" % mismatch[:5])

# the escapes are real, and are exactly the zero-left-block pairs
escapes = [(x, y) for x, y in wide if gap(x) * gap(y) > 99 and digit_rule(x, y) == x * y]
if not escapes or any(x - gap(y) != 0 for x, y in escapes):
    failures.append("escapes from the >99 break are not exactly the zero-left-block pairs: %s"
                    % escapes[:5])
if (50, 50) not in escapes or digit_rule(50, 50) != 2500:
    failures.append("50 x 50 does not behave as carry_case claims (degenerate escape)")
# the separating witness named in carry_case: a two-digit gap that still works
if not (gap(90) == 10 and digit_rule(90, 91) == 8190 == 90 * 91):
    failures.append("90 x 91 does not behave as carry_case claims (two-digit gap, still correct)")
# and none of this can reach the taught domain
if any((x, y) in domain for x, y in escapes):
    failures.append("a degenerate escape lies inside the taught domain")

print("worked example : 97 x 92 -> gaps 3 and 8, 97 - 8 = 89, 3 x 8 = 24, glued 8924; "
      "sympy says %d" % true_product)
print("identity       : (100-a)(100-b) = 100(100-a-b) + ab holds symbolically for all a, b")
print("applicability  : exhaustive over [%d,%d]^2 = %d pairs -> %s (max gap product %d)"
      % (LO, HI, len(domain), "pass" if not bad_rule else "FAIL", worst))
print("pad            : %d of %d pairs need the leading zero; all %d fail without it"
      % (len(pad_needed), len(domain), len(bad_unpadded)))
print("carry case     : 88 x 89 -> 77 and 12 x 11 = 132; naive glue %d, true %d, carried 7700+132"
      % (naive_concat, carry_true))
print("break set      : over [%d,%d]^2 the digit rule is correct on exactly the pairs with gap "
      "product <= 99, plus %d zero-left-block escapes such as 50 x 50; 90 x 91 works with a "
      "gap of 10" % (WIDE_LO, WIDE_HI, len(escapes)))
for f in failures:
    print("FAILURE:", f)

print(json.dumps({
    "claim_id": CLAIM_ID,
    "computed": str(true_product),
    "agrees": not failures,
}))
