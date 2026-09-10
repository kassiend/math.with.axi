"""
Generator-side check for lesson `reverse-percentage-recover-original-price`.

Confirms, from the STATED RULE rather than by replaying the cards:
  1. the worked example - a sale price of GBP 68 after 80% off came from GBP 340 -
     computed directly in exact rationals, both forwards and backwards,
  2. the arithmetic actually printed on each of the five cards, including the
     "divide by 0.2 is the same as multiply by 5" step and the caveat card,
  3. the identity itself, symbolically, for all real P and all d != 100,
  4. the applicability claim exhaustively over the finite domain the draw came from
     (P = 10t, t in [3,40]; d = 10k, k in [1,9]) - 342 cases, exact arithmetic,
  5. the applicability claim over a far wider grid than was drawn from
     (d = 0..99, P = 1..500) - 50,000 cases - so the round-tens range cannot be
     hiding a failure,
  6. that the drawn range really is presentational: the sale price is a whole
     number of pounds for every pair in it,
  7. that carry_case is real: at d = 100 the keeper is 0, the division is
     undefined, and the map from ticket price to sale price collapses, so no
     method can invert it,
  8. that the trap the rule is phrased against - adding the discount back onto
     the sale price - fails for EVERY d in 1..99 and is never a rescue,
  9. that d = 100 is the exact edge: the rule holds at every d in [0,100) and
     only fails at 100.

Prints one JSON line: {"claim_id": ..., "computed": ..., "agrees": ...}
`computed` is the worked example's answer as a bare integer string of pounds,
which is what worked_example.result declares.
"""

import json
from sympy import Rational, symbols, simplify, nsimplify, Integer

CLAIM_ID = "reverse-percentage-recover-original-price"

# drawn: seed 369640847
#   k = 8  from spec {min:1, max:9}   -> d = 10k = 80  (percent off)
#   t = 34 from spec {min:3, max:40}  -> P = 10t = 340 (pounds, ticket price)
K_DRAW, T_DRAW = 8, 34
D = 10 * K_DRAW              # 80  percent off
P = 10 * T_DRAW              # 340 pounds, the answer
DECLARED_RESULT = "340"

CARRY_D = 100                # the carry case: 100% off

failures = []


def keeper(d):
    """The fraction of the price you still pay, exactly. 'What you keep'."""
    return 1 - Rational(d, 100)


def sale(p, d):
    """Forward direction: the shop's arithmetic."""
    return Rational(p) * keeper(d)


def undo(s, d):
    """THE RULE AS TAUGHT: divide the sale price by what you keep."""
    k = keeper(d)
    if k == 0:
        return None          # 'divide by what you keep' has nothing to divide by
    return Rational(s) / k


def add_back(s, d):
    """The trap the rule is phrased against: put the same percent back on."""
    return Rational(s) * (1 + Rational(d, 100))


def check(name, cond, detail=""):
    if not cond:
        failures.append(f"{name}: {detail}" if detail else name)
    return cond


# ---------------------------------------------------------------------------
# 1. the worked example, computed directly and both ways round
# ---------------------------------------------------------------------------
S = sale(P, D)                                   # 340 * 1/5 = 68
check("forward_sale_is_68", S == 68, f"got {S}")
check("sale_is_whole_pounds", S.q == 1, f"denominator {S.q}")

recovered = undo(S, D)                           # 68 / (1/5) = 340
check("rule_recovers_340", recovered == P, f"got {recovered}")
check("recovered_matches_declared_result",
      str(int(recovered)) == DECLARED_RESULT, f"got {recovered}")

# ---------------------------------------------------------------------------
# 2. every line printed on the five cards
# ---------------------------------------------------------------------------
# s1  "80% off -> GBP 68. Before?"
check("card_s1_pose", D == 80 and S == 68, f"d={D} S={S}")

# s2  "100 - 80 = 20% -> / 0.2"
check("card_s2_keeper_percent", 100 - D == 20, f"got {100 - D}")
check("card_s2_keeper_decimal", keeper(D) == Rational(2, 10), f"got {keeper(D)}")

# s3  "68 / 0.2 = 68 x 5 = 340"      (dividing by 0.2 IS multiplying by 5)
check("card_s3_div_equals_mul", Rational(68) / Rational(2, 10) == 68 * 5,
      "68/0.2 != 68*5")
check("card_s3_value", 68 * 5 == P, f"got {68 * 5}")

# s4  "GBP 340 - 80% = GBP 68"       (the restatement, recomputed forwards)
check("card_s4_restatement", P - Rational(P) * Rational(D, 100) == 68,
      f"got {P - Rational(P) * Rational(D, 100)}")

# s5  "keep = 0 -> GBP 0 / 0"        (the caveat card)
check("card_s5_keeper_zero", keeper(CARRY_D) == 0, f"got {keeper(CARRY_D)}")
check("card_s5_sale_is_zero", sale(P, CARRY_D) == 0, f"got {sale(P, CARRY_D)}")

# the number the caveat contrasts against, quoted in carry_case: 68 x 1.8 = 122.40
trap = add_back(S, D)
check("trap_value_is_122_40", trap == Rational(6120, 50), f"got {trap}")
check("trap_is_not_the_answer", trap != P, "adding 80% back somehow gave 340")

# ---------------------------------------------------------------------------
# 3. the identity, symbolically, for all real P and all d != 100
# ---------------------------------------------------------------------------
p_sym, d_sym = symbols("p d", real=True)
k_sym = 1 - d_sym / 100
identity = simplify(p_sym * k_sym / k_sym - p_sym)          # == 0 wherever k != 0
check("identity_symbolic", identity == 0, f"residual {identity}")

# and the trap, symbolically: S*(1 + d/100) = P*(1 - (d/100)^2), always short of P
trap_sym = simplify(p_sym * k_sym * (1 + d_sym / 100)
                    - p_sym * (1 - (d_sym / 100) ** 2))
check("trap_symbolic_form", trap_sym == 0, f"residual {trap_sym}")

# ---------------------------------------------------------------------------
# 4. exhaustive over the DRAWN domain: t in [3,40], k in [1,9]  (342 cases)
# ---------------------------------------------------------------------------
drawn_cases = 0
non_integer_sales = []
for t in range(3, 41):
    for k in range(1, 10):
        p, d = 10 * t, 10 * k
        s = sale(p, d)
        if s.q != 1:
            non_integer_sales.append((p, d, s))
        if undo(s, d) != p:
            failures.append(f"drawn_domain: P={p} d={d} did not recover")
        drawn_cases += 1
check("drawn_domain_exhaustive", drawn_cases == 342, f"ran {drawn_cases}")

# 6. the declared range is presentational: no pence anywhere in it
check("drawn_domain_no_pence", not non_integer_sales,
      f"{len(non_integer_sales)} non-integer sale prices")

# ---------------------------------------------------------------------------
# 5. exhaustive far outside the drawn range: d = 0..99, P = 1..500
# ---------------------------------------------------------------------------
wide_cases = 0
for d in range(0, 100):
    for p in range(1, 501):
        if undo(sale(p, d), d) != p:
            failures.append(f"wide_domain: P={p} d={d} did not recover")
        wide_cases += 1
check("wide_domain_exhaustive", wide_cases == 50000, f"ran {wide_cases}")

# non-integer and fractional prices too - the claim is for all real P > 0
for p in [Rational(1, 3), Rational(9995, 100), Rational(1, 1000), Rational(12345, 7)]:
    for d in [0, 1, 17, Rational(1, 2), Rational(200, 3), 99]:
        if undo(sale(p, d), d) != p:
            failures.append(f"non_integer_domain: P={p} d={d} did not recover")

# ---------------------------------------------------------------------------
# 7. carry_case is real: d = 100 breaks the rule, and irreparably
# ---------------------------------------------------------------------------
check("carry_keeper_is_zero", keeper(CARRY_D) == 0, f"got {keeper(CARRY_D)}")
check("carry_rule_undefined", undo(sale(P, CARRY_D), CARRY_D) is None,
      "the rule returned a value at 100% off")

# the collapse: distinct ticket prices become the same sale price, so no method inverts it
images = {sale(p, CARRY_D) for p in [1, 5, 340, 999]}
check("carry_map_collapses", images == {0}, f"images {images}")
check("carry_not_injective", sale(340, CARRY_D) == sale(5, CARRY_D) == 0,
      "100% off did not collapse both prices to 0")

# ---------------------------------------------------------------------------
# 8. the trap fails for EVERY discount, not just this one
# ---------------------------------------------------------------------------
trap_ok_anywhere = []
for d in range(1, 100):
    for p in range(1, 201):
        back = add_back(sale(p, d), d)
        if back == p:
            trap_ok_anywhere.append((p, d))
        if back >= p:                      # must always UNDERSHOOT
            failures.append(f"trap_not_short: P={p} d={d} gave {back}")
check("trap_never_works", not trap_ok_anywhere,
      f"add-back was right for {trap_ok_anywhere[:3]}")
# and it is exactly right at d = 0, where there was no discount to undo
check("trap_exact_at_zero", add_back(sale(77, 0), 0) == 77, "d=0 edge")

# ---------------------------------------------------------------------------
# 9. d = 100 is the EXACT edge of applicability, not an approximate one
# ---------------------------------------------------------------------------
holds = [d for d in range(0, 101) if keeper(d) != 0 and undo(sale(319, d), d) == 319]
breaks = [d for d in range(0, 101) if keeper(d) == 0]
check("edge_holds_below_100", holds == list(range(0, 100)),
      f"holds on {len(holds)} of 0..99")
check("edge_breaks_only_at_100", breaks == [100], f"breaks at {breaks}")
# just under the edge still works, in exact arithmetic
check("edge_just_under", undo(sale(340, Rational(9999, 100)), Rational(9999, 100)) == 340,
      "d = 99.99 failed")

# ---------------------------------------------------------------------------
print(json.dumps({
    "claim_id": CLAIM_ID,
    "computed": str(int(recovered)),
    "declared": DECLARED_RESULT,
    "agrees": not failures and str(int(recovered)) == DECLARED_RESULT,
    "checks": {
        "worked_example": f"{P} x (1 - {D}/100) = {S}; {S} / {keeper(D)} = {recovered}",
        "trap": f"{S} x 1.8 = {float(trap):.2f} != {P}",
        "drawn_domain_cases": drawn_cases,
        "wide_domain_cases": wide_cases,
        "carry_case": "d=100: keeper 0, division undefined, map collapses to 0",
    },
    "failures": failures,
}))
