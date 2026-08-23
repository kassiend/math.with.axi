#!/usr/bin/env python
"""
Verify: given 2^x = 3, compute 4^x + 8^x.

We compute the target directly from the given, without replaying the
generator's algebra: solve 2^x = 3 for x symbolically, substitute, simplify.
"""
import json
from sympy import symbols, Eq, solve, log, simplify, nsimplify, Rational

x = symbols('x', real=True)

# Given
given = Eq(2**x, 3)

# Solve for x (the unique real solution).
sol = solve(given, x)
assert len(sol) == 1, f"expected one real solution, got {sol}"
x_val = sol[0]  # log(3)/log(2)

# Target expression, evaluated at x_val.
target = 4**x_val + 8**x_val
value = simplify(target)

# It should collapse to an integer.
value_int = nsimplify(value, rational=True)
computed = str(value_int)

expected = "36"
agrees = (value_int == Rational(36))

print(json.dumps({
    "task_id": "power-rewrite-from-2x-equals-3",
    "computed": computed,
    "agrees": bool(agrees),
}))
