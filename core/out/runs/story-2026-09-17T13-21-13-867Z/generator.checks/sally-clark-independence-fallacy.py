"""
Check for the Sally Clark story.

The mechanism has two parts SymPy can settle numerically:

  (1) Meadow's number.  He assumed the two infant deaths were statistically
      independent and squared a single-SIDS base rate. The number cited in
      court was 1 in 73 million, obtained as 8543 x 8543. Confirm the
      arithmetic is inside the tolerance implied by the way it was quoted.

  (2) The correct identity, P(A n B) = P(A) * P(B | A), collapses to
      P(A) * P(B) only when P(B | A) = P(B). If P(B | A) > P(B) — as the
      Royal Statistical Society argued was likely for SIDS within one family
      — the joint probability is strictly larger than Meadow's independent
      estimate. Illustrate with a plausible P(B | A) = 1/100 (an order-of-
      magnitude figure cited in the case commentary): the true joint would
      be ~1/854,300, roughly 85x larger than Meadow's number and far short
      of his 1-in-73-million claim.

Whether SIDS deaths in a single family are truly dependent is an empirical
question SymPy cannot answer; that assertion is sourced separately in
facts[]. What SymPy CAN check is the arithmetic and the DIRECTION of the
inequality — which is what the mechanism narration is built on.
"""
import json
from sympy import Rational, Symbol, simplify

STORY_ID = "sally-clark-independence-fallacy"

# ---- (1) Meadow's squared estimate --------------------------------------
p_single = Rational(1, 8543)
meadow_joint = p_single * p_single                # = 1/72_982_849
inv_meadow = 1 / meadow_joint                     # = 72_982_849
target = 73_000_000                               # figure cited at trial
rel_error_pct = float(abs(inv_meadow - target)) / target * 100

# ---- (2) Correct identity vs. independence assumption -------------------
pA = Symbol('pA', positive=True)
pB = Symbol('pB', positive=True)
pBgA = Symbol('pBgA', positive=True)

joint_true = pA * pBgA                            # definition of conditional
joint_indep = pA * pB                             # false, unless pBgA == pB

# With plausible pBgA = 1/100 and pB = 1/8543, is the true joint larger?
diff = simplify(
    joint_true.subs(pBgA, Rational(1, 100))
    - joint_indep.subs(pB, Rational(1, 8543))
)
positive_when_pA_positive = bool(
    simplify(diff.subs(pA, Rational(1, 8543))) > 0
)

illust_joint = Rational(1, 8543) * Rational(1, 100)   # = 1/854_300
ratio = illust_joint / meadow_joint                    # = 85.43

meadow_ok = rel_error_pct < 0.1                        # court number is within 0.1%
agrees = meadow_ok and positive_when_pA_positive and ratio > 1

print(json.dumps({
    "claim_id": STORY_ID,
    "computed": (
        f"(1/8543)^2 = 1/{int(inv_meadow)} ({rel_error_pct:.3f}% below the "
        f"73,000,000 cited in court); with P(B|A)=1/100 the corrected joint "
        f"1/{int(1/illust_joint)} is about {float(ratio):.0f}x larger than "
        f"Meadow's independent product"
    ),
    "agrees": bool(agrees),
}))
