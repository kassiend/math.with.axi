"""Check the mechanism of the story.

The story asserts that on a single-zero roulette wheel, the conditional
probability of black on the 27th spin given 26 previous blacks equals
18/37 (the same as any single spin), because the spins are independent.

Concretely, using independence:
    P(B27 | B1 & ... & B26) = P(B1 & ... & B27) / P(B1 & ... & B26)
                            = (18/37)^27 / (18/37)^26
                            = 18/37

We also cross-check the sequence probability used in the hook stat:
    2 * (18/37)^26 ~= 1 / 68.4e6
"""
import json
from sympy import Rational, simplify

STORY_ID = "monte-carlo-1913-gamblers-fallacy"

p_black = Rational(18, 37)  # single-zero European wheel: 18 black / 37 pockets

# Conditional probability of black on spin 27 given 26 previous blacks.
numerator = p_black ** 27         # P(B1 & ... & B27)
denominator = p_black ** 26       # P(B1 & ... & B26)
conditional = simplify(numerator / denominator)

memoryless_ok = simplify(conditional - p_black) == 0

# Sequence stat: 2 * (18/37)^26, quoted by Wikipedia as ~1 in 68.4 million.
sequence_prob = 2 * (p_black ** 26)
one_in = 1 / float(sequence_prob)
stat_ok = abs(one_in - 68.4e6) / 68.4e6 < 0.02  # within 2 %

agrees = bool(memoryless_ok and stat_ok)

computed = (
    f"P(B27|B1..B26) = (18/37)^27 / (18/37)^26 = {conditional} = 18/37; "
    f"2*(18/37)^26 ≈ 1 in {one_in:.3e} (Wikipedia: 1 in 68.4e6)"
)

print(json.dumps({"claim_id": STORY_ID, "computed": computed, "agrees": agrees}))
