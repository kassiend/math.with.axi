"""
Generator-side check for lesson `undo-discount-find-original-price`.

Confirms, from the STATED RULE rather than by replaying the cards:
  1. the worked example: 66 at 40% off came from 110, computed directly as
     66 / (1 - 40/100) in exact rationals, not by walking the tenths steps,
  2. the arithmetic actually printed on the five cards,
  3. the rule symbolically: S / (1 - d/100) returns P for every P and every
     d != 100, and the taught tenths form is the same expression,
  4. applicability, exhaustively over the declared draw domain
     (k = 1..9 tenths crossed with P = 40, 50, ..., 250) and over the wider
     grid of every integer d = 0..99 against every P = 1..500,
  5. that the multiple-of-ten price is presentation only - the division form
     still recovers the original exactly on prices that are not multiples of 10,
  6. carry_case part one: adding the percent back fails at 66 / 40%, and fails
     for EVERY discount, symbolically and exhaustively - never a near miss,
  7. carry_case part two: d = 100 is genuinely non-invertible - every original
     price collapses to the same sale price of 0.

Prints one JSON line: {"claim_id": ..., "computed": ..., "agrees": ...}
`computed` is the recovered original price as a bare integer string, which is
what worked_example.result declares.
"""

import json
from sympy import Rational, symbols, simplify, expand, solve, Eq, nsimplify

CLAIM_ID = "undo-discount-find-original-price"

# drawn: seed 366732696 -> k = 4 (tenths off) and u = 11 (price in tens)
K_TENTHS = 4                       # spec {min:1, max:9}
U_TENS = 11                        # spec {min:4, max:25}
DISCOUNT = 10 * K_TENTHS           # 40 (%)
ORIGINAL = 10 * U_TENS             # 110
SALE = 66                          # the number printed on the cards
DECLARED_RESULT = "110"

failures = []


def keeper(d):
    """The fraction of the price you actually pay after d% off. Exact rational."""
    return 1 - Rational(d, 100)


def sale_of(p, d):
    """Forward direction: what the ticket says."""
    return Rational(p) * keeper(d)


def undo_by_division(s, d):
    """The rule as TAUGHT (general form): divide by what you kept."""
    return Rational(s) / keeper(d)


def undo_by_tenths(s, k):
    """The rule as TAUGHT on the cards: one tenth is s / (10 - k), original is ten of them."""
    return Rational(s, 10 - k) * 10


def undo_by_adding_back(s, d):
    """The intuitive rule the caveat kills: add the percent back onto the sale price."""
    return Rational(s) * (1 + Rational(d, 100))


# --- 1. worked example, from the stated rule, computed directly ---------------
if sale_of(ORIGINAL, DISCOUNT) != SALE:
    failures.append("setup: 110 at 40%% off is %s, cards show 66" % sale_of(ORIGINAL, DISCOUNT))

recovered = undo_by_division(SALE, DISCOUNT)
if recovered != Rational(ORIGINAL) or str(int(recovered)) != DECLARED_RESULT:
    failures.append("worked example: 66 / (1 - 40/100) = %s, card declares %s"
                    % (recovered, DECLARED_RESULT))
if recovered != nsimplify(SALE / (1 - 0.4), rational=True):
    failures.append("division form disagrees with itself across two evaluations")

# the operands are the ones the draws force, not chosen numbers
if (DISCOUNT, ORIGINAL) != (40, 110):
    failures.append("operands do not follow from draws k=4, u=11")

# --- 2. the arithmetic printed on the cards -----------------------------------
if 10 - K_TENTHS != 6:
    failures.append("card s2: 40%% off keeps %d tenths, card shows 6" % (10 - K_TENTHS))
if Rational(SALE, 10 - K_TENTHS) != 11:
    failures.append("card s3: 66 / 6 is %s, card shows 11" % Rational(SALE, 10 - K_TENTHS))
if 11 * 10 != ORIGINAL:
    failures.append("card s4: 11 x 10 is %d, card shows 110" % (11 * 10))
if undo_by_tenths(SALE, K_TENTHS) != Rational(ORIGINAL):
    failures.append("card route (tenths) gives %s, true original %d"
                    % (undo_by_tenths(SALE, K_TENTHS), ORIGINAL))
# card s5, the caveat line, must be arithmetically true as printed
if undo_by_adding_back(SALE, DISCOUNT) != Rational("92.4"):
    failures.append("card s5: 66 + 40%% of 66 is %s, card shows 92.4"
                    % undo_by_adding_back(SALE, DISCOUNT))
if undo_by_adding_back(SALE, DISCOUNT) == Rational(ORIGINAL):
    failures.append("card s5 claims the add-back is wrong, but it hit 110")
# the explanation given in carry_case: 40% of 110 is 44, 40% of 66 is only 26.40
if Rational(40, 100) * ORIGINAL != 44 or Rational(40, 100) * SALE != Rational("26.4"):
    failures.append("carry_case percentages of 110 / 66 are not 44 / 26.40")
if Rational(ORIGINAL) - undo_by_adding_back(SALE, DISCOUNT) != Rational("17.6"):
    failures.append("carry_case shortfall is not 17.60")

# --- 3. the rule, symbolically ------------------------------------------------
P, d, k = symbols("P d k", positive=True)
S_sym = P * (1 - d / 100)
if simplify(S_sym / (1 - d / 100) - P) != 0:
    failures.append("S / (1 - d/100) does not return P symbolically")
# the tenths form on the cards IS the division form, for d = 10k
S_tenths = P * (1 - 10 * k / 100)
if simplify((S_tenths / (10 - k)) * 10 - P) != 0:
    failures.append("tenths form and division form are not the same rule")

# --- 4. applicability, exhaustive over the declared domains -------------------
# 4a. the declared draw domain: k = 1..9 tenths, P = 40, 50, ..., 250
draw_domain = [(kk, 10 * uu) for kk in range(1, 10) for uu in range(4, 26)]
bad_draw = [(kk, p) for kk, p in draw_domain
            if undo_by_tenths(sale_of(p, 10 * kk), kk) != Rational(p)]
if bad_draw:
    failures.append("tenths rule fails inside the declared draw domain at %s" % bad_draw[:5])
# and every intermediate really is whole there, which is the presentation claim
not_whole = [(kk, p) for kk, p in draw_domain
             if Rational(sale_of(p, 10 * kk), 10 - kk).q != 1]
if not_whole:
    failures.append("a tenth came out fractional inside the draw domain at %s" % not_whole[:5])

# 4b. the wider grid: every integer discount 0..99 against every price 1..500
wide = [(dd, p) for dd in range(0, 100) for p in range(1, 501)]
bad_wide = [(dd, p) for dd, p in wide if undo_by_division(sale_of(p, dd), dd) != Rational(p)]
if bad_wide:
    failures.append("division rule fails on the 0..99 x 1..500 grid at %s" % bad_wide[:5])
if len(wide) != 50000:
    failures.append("wide grid is %d pairs, expected 50000" % len(wide))

# --- 5. the multiple-of-ten price is presentation, not mathematics ------------
awkward = [(40, 63), (35, 17), (7, 1), (99, 499), (40, Rational("19.99"))]
bad_awkward = [(dd, p) for dd, p in awkward if undo_by_division(sale_of(p, dd), dd) != Rational(p)]
if bad_awkward:
    failures.append("division rule fails on non-round prices at %s" % bad_awkward)
# 63 at 40% off is 37.80, and 37.80 / 6 * 10 = 63 -- correct, just not whole
if undo_by_tenths(sale_of(63, 40), 4) != 63 or Rational(sale_of(63, 40), 6).q == 1:
    failures.append("the 63 witness does not show 'exact but not whole'")

# --- 6. carry_case part one: the add-back is wrong every single time ----------
# symbolically: S(1 + d/100) = P(1 - d^2/10000), short of P by P*d^2/10000
gap = simplify(P - expand(S_sym * (1 + d / 100)))
if simplify(gap - P * d ** 2 / 10000) != 0:
    failures.append("add-back shortfall is not P*d^2/10000, got %s" % gap)
# so it is exact only when d = 0 (or P = 0), i.e. never for a real discount
roots = solve(Eq(expand(S_sym * (1 + d / 100)), P), d)
if any(r != 0 for r in roots):
    failures.append("add-back equals the original at some nonzero discount: %s" % roots)
bad_addback = [(dd, p) for dd, p in wide
               if dd > 0 and undo_by_adding_back(sale_of(p, dd), dd) == Rational(p)]
if bad_addback:
    failures.append("add-back accidentally succeeded at %s" % bad_addback[:5])
# and it always UNDERSHOOTS, so it is not a rounding-level near miss
not_under = [(dd, p) for dd, p in wide
             if dd > 0 and undo_by_adding_back(sale_of(p, dd), dd) >= Rational(p)]
if not_under:
    failures.append("add-back did not undershoot at %s" % not_under[:5])
# the claim that a bigger discount is worse: 50% off needs doubling, not +50%
if undo_by_adding_back(sale_of(100, 50), 50) != 75 or undo_by_division(sale_of(100, 50), 50) != 100:
    failures.append("the 50%-off witness does not behave as carry_case claims")

# --- 7. carry_case part two: 100% off is not invertible -----------------------
if keeper(100) != 0:
    failures.append("100%% off does not keep 0")
if simplify(P * (1 - Rational(100, 100))) != 0:
    failures.append("100%% off does not collapse every price to 0")
collapsed = {sale_of(p, 100) for _, p in draw_domain}
if collapsed != {0}:
    failures.append("100%% off did not send every declared price to 0: %s" % collapsed)
# 0 / 0 is indeterminate, not an answer: sympy returns nan rather than raising,
# which is exactly the claim - the division names no starting price.
try:
    degenerate = undo_by_division(0, 100)
    if degenerate.is_number and degenerate.is_finite:
        failures.append("dividing by a keeper of 0 produced a definite price: %s" % degenerate)
except ZeroDivisionError:
    pass
# the real content of the claim: the map is not injective at d = 100, so no rule
# whatsoever could invert it - two different originals share one sale price
if sale_of(110, 100) != sale_of(250, 100):
    failures.append("100% off is injective, so it would be invertible after all")
# whereas at every discount in the taught domain it IS injective
collisions = [dd for dd in range(0, 100) if sale_of(110, dd) == sale_of(250, dd)]
if collisions:
    failures.append("two prices collided at discounts %s inside the taught domain" % collisions[:5])
# and 100 is correctly outside the stated domain 0 <= d < 100
if any(dd >= 100 for dd, _ in wide) or 10 in range(1, 10):
    failures.append("the declared domain admits d = 100")

print("worked example : 66 at 40%% off -> keep 6 tenths, 66 / 6 = 11, x10 = 110; "
      "direct 66 / (1 - 40/100) = %s" % recovered)
print("operands       : forced by the draws (k=4 -> 40% off, u=11 -> start 110), "
      "sale 66 computed, not chosen")
print("rule           : S/(1 - d/100) = P symbolically, and the tenths form is the same expression")
print("applicability  : exhaustive over the draw domain (%d pairs) -> %s; "
      "over d=0..99 x P=1..500 (%d pairs) -> %s"
      % (len(draw_domain), "pass" if not bad_draw else "FAIL",
         len(wide), "pass" if not bad_wide else "FAIL"))
print("presentation   : non-round prices still exact (63 at 40% off -> 37.80, /6 x10 = 63) - "
      "the multiple of 10 only keeps the tenth whole")
print("carry case 1   : add-back gives 66 + 26.40 = 92.40, short of 110 by 17.60; "
      "shortfall is P*d^2/10000, so it undershoots on all %d discounted pairs"
      % len([1 for dd, _ in wide if dd > 0]))
print("carry case 2   : at d = 100 every price collapses to 0 and the division has no answer")
for f in failures:
    print("FAILURE:", f)

print(json.dumps({
    "claim_id": CLAIM_ID,
    "computed": str(int(recovered)),
    "agrees": not failures,
}))
