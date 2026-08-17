import json
from sympy import sqrt, Integer, simplify, Rational

task_id = "sqrt-12-times-27"
stated_answer = Integer(18)

# Compute sqrt(12 * 27) symbolically/exactly
value = sqrt(Integer(12) * Integer(27))
simplified = simplify(value)

# Check equality exactly
agrees = bool(simplify(simplified - stated_answer) == 0)

print(json.dumps({
    "task_id": task_id,
    "computed": str(simplified),
    "agrees": agrees
}))
