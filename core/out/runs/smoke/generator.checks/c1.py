import json, sympy
n, d = sympy.Integer(5004), sympy.Integer(4871)
computed = n**2 - d**2
print(json.dumps({"claim_id": "c1", "computed": str(computed), "agrees": computed == 1313375}))
