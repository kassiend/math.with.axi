import json
import sympy as sp

expr = sp.log(2, 6) + sp.log(3, 6)
simplified = sp.simplify(expr)
stated = sp.Integer(1)
agrees = bool(sp.simplify(simplified - stated) == 0)

print(json.dumps({
    "task_id": "log-6-sum-2-and-3",
    "computed": str(simplified),
    "agrees": agrees,
}))
