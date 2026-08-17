"""
Generator-side check for lesson `remainder-mod-9-digit-sum`.

Confirms, from the STATED RULE rather than by replaying the card:
  1. the worked example 6656 ÷ 9 leaves remainder 5,
  2. the digit-sum chain shown on the cards really is 6656 -> 23 -> 5,
  3. the applicability claim, exhaustively over a stated finite domain,
  4. the carry case 999 really does break the simplified form of the rule,
  5. the simplified form breaks on exactly the positive multiples of 9 and nowhere else.

Prints one JSON line: {"claim_id": ..., "computed": ..., "agrees": ...}
`computed` is the worked example's answer as a bare integer string, which is what
worked_example.result declares.
"""

import json
from sympy import Integer, Mod, divisors

CLAIM_ID = "remainder-mod-9-digit-sum"

N = 6656          # drawn: seed 281147218, spec {min:1000, max:9999}
DIVISOR = 9       # fixed by the method, not drawn
DECLARED_RESULT = "5"
CARRY_CASE = 999

failures = []


def digit_sum(n):
    return sum(int(c) for c in str(n))


def digit_chain(n):
    """The rule as taught: add the digits, and keep going while >= 2 digits."""
    chain = [n]
    while chain[-1] >= 10:
        chain.append(digit_sum(chain[-1]))
    return chain


def naive_rule(n):
    """The SIMPLIFIED rule: 'the single digit you land on is the remainder'."""
    return digit_chain(n)[-1]


def taught_rule(n):
    """The rule WITH the stated caveat: landing on 9 is read as 0."""
    d = naive_rule(n)
    return 0 if d == 9 else d


# --- 1. worked example, computed directly, not by walking the trick -----------
# sympy's Mod is the independent authority here; the trick is never used to
# establish the answer it is supposed to predict.
true_remainder = int(Mod(Integer(N), Integer(DIVISOR)))
if str(true_remainder) != DECLARED_RESULT:
    failures.append(
        "worked example: 6656 mod 9 = %d, card declares %s" % (true_remainder, DECLARED_RESULT)
    )

# the quotient shown on the result card, 6656 = 9 x 739 + 5
quotient = (N - true_remainder) // DIVISOR
if quotient != 739 or DIVISOR * quotient + true_remainder != N:
    failures.append("result card: 6656 = 9 x %d + %d does not reconstruct" % (quotient, true_remainder))

# --- 2. the digit chain actually shown on the cards ---------------------------
chain = digit_chain(N)
if chain != [6656, 23, 5]:
    failures.append("digit chain for 6656 is %s, cards show [6656, 23, 5]" % chain)
if taught_rule(N) != true_remainder:
    failures.append("taught rule disagrees with true remainder on the worked example")

# --- 3. applicability, exhaustive over the stated finite domain ---------------
# Claim: for every non-negative integer n in base 10, the iterated digit sum,
# with 9 read as 0, equals n mod 9. Checked for every n in [0, 200000].
DOMAIN_LO, DOMAIN_HI = 0, 200000
bad_taught = [n for n in range(DOMAIN_LO, DOMAIN_HI + 1) if taught_rule(n) != n % 9]
if bad_taught:
    failures.append("taught rule fails at %s in [%d, %d]" % (bad_taught[:5], DOMAIN_LO, DOMAIN_HI))

# the closed form asserted in applicability: digital root = 1 + ((n-1) mod 9) for n >= 1
bad_closed = [n for n in range(1, DOMAIN_HI + 1) if naive_rule(n) != 1 + ((n - 1) % 9)]
if bad_closed:
    failures.append("digital-root closed form fails at %s" % bad_closed[:5])

# termination: a number of two or more digits strictly shrinks under digit_sum
bad_shrink = [n for n in range(10, 200001) if digit_sum(n) >= n]
if bad_shrink:
    failures.append("digit sum does not strictly shrink at %s" % bad_shrink[:5])

# a remainder of 9 is impossible (division algorithm, euclid-division)
if any(n % 9 == 9 for n in range(DOMAIN_LO, 100001)):
    failures.append("remainder 9 occurred, which the division algorithm forbids")

# --- 4. the carry case genuinely breaks the SIMPLIFIED rule -------------------
if naive_rule(CARRY_CASE) != 9:
    failures.append("carry case 999 does not land on 9 (got %d)" % naive_rule(CARRY_CASE))
if CARRY_CASE % 9 != 0:
    failures.append("carry case 999 is not actually a multiple of 9")
if naive_rule(CARRY_CASE) == CARRY_CASE % 9:
    failures.append("carry case 999 does not break the simplified rule")
if CARRY_CASE != 9 * 111:
    failures.append("999 = 9 x 111 is wrong")
if taught_rule(CARRY_CASE) != 0:
    failures.append("taught rule does not rescue the carry case")

# the other witnesses named in carry_case
for w in (18, 5661, 123456789):
    if not (naive_rule(w) == 9 and w % 9 == 0):
        failures.append("carry-case witness %d does not behave as claimed" % w)

# --- 5. the simplified rule breaks on EXACTLY the positive multiples of 9 -----
broken = {n for n in range(1, 100001) if naive_rule(n) != n % 9}
mult9 = {n for n in range(1, 100001) if n % 9 == 0}
if broken != mult9:
    failures.append("simplified rule breaks on a set other than the positive multiples of 9")

# sanity: 9 divides 999 per sympy's divisor list, independent of the % operator
if 9 not in divisors(CARRY_CASE):
    failures.append("sympy does not agree that 9 divides 999")

print("worked example : 6656 mod 9 = %d, chain %s, 6656 = 9*%d + %d"
      % (true_remainder, chain, quotient, true_remainder))
print("applicability  : exhaustive over [%d, %d] -> %s"
      % (DOMAIN_LO, DOMAIN_HI, "pass" if not bad_taught else "FAIL"))
print("carry case     : 999 -> 27 -> 9 by the simple rule, true remainder %d" % (CARRY_CASE % 9))
print("break set      : simplified rule fails on exactly %d numbers below 100001, "
      "all multiples of 9" % len(broken))
for f in failures:
    print("FAILURE:", f)

print(json.dumps({
    "claim_id": CLAIM_ID,
    "computed": str(true_remainder),
    "agrees": not failures,
}))
