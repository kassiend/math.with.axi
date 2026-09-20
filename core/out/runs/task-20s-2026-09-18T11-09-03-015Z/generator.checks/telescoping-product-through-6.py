"""Independent check for telescoping-product-through-6.

Recomputes (1 - 1/2)(1 - 1/3)(1 - 1/4)(1 - 1/5)(1 - 1/6) directly from the
statement using exact rationals and compares against the claimed answer 1/6.
"""
import json
from sympy import Rational, prod, sympify

TASK_ID = "telescoping-product-through-6"
CLAIMED = Rational(1, 6)

factors = [Rational(1, 1) - Rational(1, n) for n in range(2, 7)]
computed = prod(factors)

agrees = sympify(computed) == sympify(CLAIMED)

print(json.dumps({
    "task_id": TASK_ID,
    "computed": str(computed),
    "agrees": bool(agrees),
}))
