"""Check for task exp-chain-3x4-4y9-xy.

Statement (as rendered in the ring):   3^x = 4 ,  4^y = 9
Question (card title):                 Find the value of xy
Claimed answer:                        2

The check works from the statement, not from the solution sketch: it solves each
exponential equation for its own unknown independently and only then forms the
product x*y. No step of the intended route (composing the two equations) is reused.
"""

import json

import sympy as sp

TASK_ID = "exp-chain-3x4-4y9-xy"
CLAIMED = sp.Integer(2)

x, y = sp.symbols("x y", real=True)

# Solve each given equation on its own terms.
sol_x = sp.solve(sp.Eq(3**x, 4), x)
sol_y = sp.solve(sp.Eq(4**y, 9), y)

assert len(sol_x) == 1, f"expected a unique x, got {sol_x}"
assert len(sol_y) == 1, f"expected a unique y, got {sol_y}"

product = sp.simplify(sp.expand_log(sp.simplify(sol_x[0] * sol_y[0]), force=True))
computed = sp.nsimplify(product)

# Independent numeric cross-check, so a symbolic simplification quirk cannot pass silently.
numeric_ok = bool(abs(sp.N(sol_x[0] * sol_y[0], 30) - sp.N(CLAIMED, 30)) < sp.Float("1e-25"))

agrees = bool(sp.simplify(computed - CLAIMED) == 0) and numeric_ok

print(json.dumps({"task_id": TASK_ID, "computed": str(computed), "agrees": agrees}))
