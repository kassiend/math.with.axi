"""
Independent check for task cube-power-sum-x-plus-inv-4.

Statement (as rendered in the ring): x + 1/x = 4
Question (as rendered in the title):  Find x^3 + 1/x^3

We solve the given equation for x and compute x^3 + 1/x^3 directly from the
statement — no re-walking of the intended algebraic identity. Both roots of
x + 1/x = 4 (namely 2 + sqrt(3) and 2 - sqrt(3)) must yield the same value
of x^3 + 1/x^3 because the target is symmetric in x <-> 1/x.
"""

import json
from sympy import symbols, solve, simplify, Rational

x = symbols("x", real=True)

# Solve the statement.
roots = solve(x + Rational(1) / x - 4, x)
assert len(roots) == 2, f"expected two real roots, got {roots}"

# Compute the target from each root; they must agree.
values = {simplify(r**3 + 1 / r**3) for r in roots}
assert len(values) == 1, f"roots disagree on x^3 + 1/x^3: {values}"

computed = simplify(next(iter(values)))
expected = 52
agrees = simplify(computed - expected) == 0

print(json.dumps({
    "task_id": "cube-power-sum-x-plus-inv-4",
    "computed": str(computed),
    "agrees": bool(agrees),
}))
