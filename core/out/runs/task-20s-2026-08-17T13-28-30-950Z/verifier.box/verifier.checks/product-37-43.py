import json
from sympy import Integer

task_id = "product-37-43"
stated_answer = "1591"

computed = Integer(37) * Integer(43)
agrees = str(computed) == stated_answer

print(json.dumps({"task_id": task_id, "computed": str(computed), "agrees": agrees}))
