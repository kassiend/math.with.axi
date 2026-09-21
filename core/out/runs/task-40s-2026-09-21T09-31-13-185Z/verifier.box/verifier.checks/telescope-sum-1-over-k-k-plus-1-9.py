"""Independent check for task telescope-sum-1-over-k-k-plus-1-9.

Statement (from verifier.in.json):
    S = 1/(1*2) + 1/(2*3) + ... + 1/(9*10). Find S.
Claimed answer: 9/10.
"""

import json
from sympy import Rational, Symbol, summation, nsimplify

# Compute the sum directly, term-by-term, as exact rationals.
terms = [Rational(1, k * (k + 1)) for k in range(1, 10)]
S_direct = sum(terms, Rational(0))

# Independently compute using symbolic summation.
k = Symbol("k", integer=True, positive=True)
S_symbolic = summation(1 / (k * (k + 1)), (k, 1, 9))
S_symbolic = nsimplify(S_symbolic, rational=True)

claimed = Rational(9, 10)

agrees = (S_direct == claimed) and (S_symbolic == claimed)

# Report in canonical simplest-form rational (SymPy stores rationals reduced).
computed_str = f"{S_direct.p}/{S_direct.q}"

print(json.dumps({
    "task_id": "telescope-sum-1-over-k-k-plus-1-9",
    "computed": computed_str,
    "agrees": bool(agrees),
}))
