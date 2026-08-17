import json
import sympy

# Verify the claim from the statement as written: sqrt(12 * 27).
expr = sympy.sqrt(sympy.Integer(12) * sympy.Integer(27))
computed = sympy.nsimplify(sympy.simplify(expr))

stated = sympy.Integer(18)
print(json.dumps({
    "task_id": "sqrt-12-times-27",
    "computed": str(computed),
    "agrees": bool(sympy.simplify(computed - stated) == 0),
}))
