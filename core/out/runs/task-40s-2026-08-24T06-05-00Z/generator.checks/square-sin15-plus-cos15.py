import json
import sympy as sp

task_id = "square-sin15-plus-cos15"

# Statement: ( sin 15deg + cos 15deg )^2
a = sp.rad(15)
expr = (sp.sin(a) + sp.cos(a))**2

# Evaluate exactly from the statement
value = sp.nsimplify(sp.simplify(expr))
computed = str(value)

answer = str(sp.Rational(3, 2))
agrees = sp.simplify(value - sp.Rational(3, 2)) == 0 and computed == answer

print("expr =", expr)
print("value =", value)
print(json.dumps({"claim_id": task_id, "computed": computed, "agrees": bool(agrees)}))
