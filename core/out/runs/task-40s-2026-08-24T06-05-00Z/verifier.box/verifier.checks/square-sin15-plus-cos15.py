import json
import sympy as sp

# (sin 15deg + cos 15deg)^2, computed from scratch with exact values.
angle = sp.rad(15)
expr = (sp.sin(angle) + sp.cos(angle))**2
val = sp.nsimplify(sp.simplify(sp.expand_trig(expr)))
val = sp.simplify(val)

computed = str(val)
print("expr simplified:", val, file=__import__("sys").stderr)

print(json.dumps({"claim_id": "square-sin15-plus-cos15", "computed": computed, "agrees": val == sp.Rational(3, 2)}))
