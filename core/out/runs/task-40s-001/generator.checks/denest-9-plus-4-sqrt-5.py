import json
import sympy

# Verify the claim from the statement as written: sqrt(9 + 4*sqrt(5)).
# Do not replay the denesting by hand — let SymPy simplify the original expression
# and compare to the stated answer 2 + sqrt(5).
expr = sympy.sqrt(sympy.Integer(9) + sympy.Integer(4) * sympy.sqrt(5))
computed = sympy.sqrtdenest(expr)
computed = sympy.simplify(computed)

stated = sympy.Integer(2) + sympy.sqrt(5)

# Both an algebraic identity check and a numeric sanity check — either catches a swap.
agrees = bool(sympy.simplify(computed - stated) == 0) and \
    abs(float(computed) - float(stated)) < 1e-12

print(json.dumps({
    "task_id": "denest-9-plus-4-sqrt-5",
    "computed": str(computed),
    "agrees": agrees,
}))
