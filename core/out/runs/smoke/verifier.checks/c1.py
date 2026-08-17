import json, sympy
computed = sympy.Integer(9875) * sympy.Integer(133)
print(json.dumps({"claim_id": "c1", "computed": str(computed), "agrees": computed == 1313375}))
