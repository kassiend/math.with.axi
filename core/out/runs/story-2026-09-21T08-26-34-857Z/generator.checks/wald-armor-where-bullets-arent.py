"""Check: Bayes' theorem applied to Wald's survivorship problem.

    P(S | H_R) = P(H_R | S) * P(S) / P(H_R)

We instantiate a small joint distribution over two events -- S (a plane
survives) and H_R (a plane is hit at region R) -- and verify that the Bayes
identity holds symbolically, and that a region R with zero observed hits
among survivors (P(H_R | S) = 0) forces the posterior P(S | H_R) = 0 -- the
mechanism that told Wald to armor the engines, not the wings.
"""

import json

from sympy import Rational, simplify, symbols

STORY_ID = "wald-armor-where-bullets-arent"

# Symbolic joint probabilities. P_HS = P(H_R and S); P_HnS = P(H_R and not S).
P_HS, P_HnS, P_nHS, P_nHnS = symbols("P_HS P_HnS P_nHS P_nHnS", positive=True)

# Marginals from the joint.
P_S = P_HS + P_nHS               # P(survives)
P_HR = P_HS + P_HnS              # P(hit at R)

# Conditionals from the joint (definitions).
P_HR_given_S = P_HS / P_S        # P(H_R | S)
P_S_given_HR = P_HS / P_HR       # P(S | H_R)

# Bayes' theorem: P(S | H_R) should equal P(H_R | S) * P(S) / P(H_R).
bayes_rhs = P_HR_given_S * P_S / P_HR
identity_holds = simplify(P_S_given_HR - bayes_rhs) == 0

# Numerical case: 100 sorties. 60 survive, 40 lost. Of the 60 survivors,
# none were hit at region R (engines); of the 40 lost, 20 were hit at R.
subs = {P_HS: Rational(0, 100), P_HnS: Rational(20, 100),
        P_nHS: Rational(60, 100), P_nHnS: Rational(20, 100)}
survivors_hit_at_R = float(P_HR_given_S.subs(subs))          # 0.0
posterior_survive_given_hit_R = float(P_S_given_HR.subs(subs))  # 0.0
armor_signal_matches = survivors_hit_at_R == 0.0 and posterior_survive_given_hit_R == 0.0

computed = (
    f"Bayes identity P(S|H)=P(H|S)P(S)/P(H) simplifies to 0: {identity_holds}; "
    f"with no observed engine hits among survivors, P(S|hit_engine)={posterior_survive_given_hit_R}"
)
agrees = bool(identity_holds and armor_signal_matches)

print(json.dumps({"claim_id": STORY_ID, "computed": computed, "agrees": agrees}))
