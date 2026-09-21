"""
Verifier check — x + y = 5, x^3 + y^3 = 35, find xy. Written blind of the generator.

Different method: work purely in the elementary symmetric functions. With e1 = x + y and
p = xy, Newton's identity gives x^3 + y^3 = e1^3 - 3*e1*p. Solve that single linear equation for
p. No system is solved and x, y are never found individually.
"""
import json
import sys

import sympy as sp

TASK = "eq-sum-cube-find-product"

e1 = sp.Integer(5)          # x + y
cube_sum = sp.Integer(35)   # x^3 + y^3
p = sp.symbols("p")         # xy

# x^3 + y^3 = (x+y)^3 - 3(xy)(x+y)
eq = sp.Eq(e1**3 - 3 * p * e1, cube_sum)
sol = sp.solve(eq, p)
assert len(sol) == 1, f"expected a unique product, got {sol}"

xy = sp.nsimplify(sol[0])
computed = str(xy)

# Cross-witness the result: the roots of t^2 - e1 t + xy must actually satisfy x^3 + y^3 = 35.
t = sp.symbols("t")
roots = sp.solve(sp.Eq(t**2 - e1 * t + xy, 0), t)
assert sp.simplify(sum(r**3 for r in roots) - cube_sum) == 0, "reconstructed roots fail the givens"

agrees = sp.simplify(xy - 6) == 0 and computed == "6"

print("xy =", xy, "roots =", roots, file=sys.stderr)
print(json.dumps({"task_id": TASK, "computed": computed, "agrees": bool(agrees)}))
