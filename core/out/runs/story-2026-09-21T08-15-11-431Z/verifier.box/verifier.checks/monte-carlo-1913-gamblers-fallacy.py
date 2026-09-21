"""Independent verification for the gambler's fallacy claim.

Claim: P(B_27 | B_1 ∩ ... ∩ B_26) = 18/37, where each B_i is the
event that spin i lands on black on a single-zero roulette wheel
(37 pockets, 18 black). Spins are independent.

Verify:
  Step 1: P(B_27 | B_1 ∩ ... ∩ B_26)
          = P(B_1 ∩ ... ∩ B_27) / P(B_1 ∩ ... ∩ B_26)   (definition)
  Step 2: numerator = (18/37)^27, denominator = (18/37)^26 (independence)
  Step 3: ratio simplifies to 18/37.
"""

import json
from sympy import Rational, simplify, Symbol, Eq

p = Rational(18, 37)  # single-spin black probability

# --- Step 1: conditional probability by definition -------------------------
# P(A | B) = P(A ∩ B) / P(B). Here A = B_27, B = B_1 ∩ ... ∩ B_26,
# so A ∩ B = B_1 ∩ ... ∩ B_27.
# We simulate this symbolically by declaring joint probabilities and taking
# the ratio, without assuming the value yet.
P_joint_27 = Symbol('P27', positive=True)
P_joint_26 = Symbol('P26', positive=True)
step1_expr = P_joint_27 / P_joint_26  # generic conditional-probability form

# --- Step 2: independence collapses joints into powers of p ----------------
P_joint_27_val = p**27
P_joint_26_val = p**26
step2_expr = P_joint_27_val / P_joint_26_val

# Substitute step-2 identities into step 1 and check they are consistent.
step1_after_sub = step1_expr.subs({P_joint_27: P_joint_27_val,
                                   P_joint_26: P_joint_26_val})
step1_to_step2_ok = simplify(step1_after_sub - step2_expr) == 0

# --- Step 3: the ratio equals 18/37 ----------------------------------------
step3_val = simplify(step2_expr)
step2_to_step3_ok = (step3_val == p)

# --- Final claim: conditional probability equals 18/37 ---------------------
final_ok = (step3_val == Rational(18, 37))

# Sanity: also compute it via the definition of conditional probability
# using a fresh, independent product formulation.
n_black = 18
n_total = 37
# probability of black on any single spin (independence => conditional == marginal)
independent_marginal = Rational(n_black, n_total)
independence_check = (independent_marginal == p)

agrees = bool(step1_to_step2_ok and step2_to_step3_ok and final_ok
              and independence_check)

print(json.dumps({
    "claim_id": "monte-carlo-1913-gamblers-fallacy",
    "computed": str(step3_val),
    "agrees": agrees,
}))
