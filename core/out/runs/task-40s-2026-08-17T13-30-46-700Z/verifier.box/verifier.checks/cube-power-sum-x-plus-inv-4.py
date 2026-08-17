import json
from sympy import symbols, solve, simplify, Rational, nsimplify

x = symbols('x')
# Statement: x + 1/x = 4
sols = solve(x + 1/x - 4, x)

values = set()
for s in sols:
    val = simplify(s**3 + 1/s**3)
    values.add(simplify(val))

# All solutions should give the same value for x^3 + 1/x^3
if len(values) == 1:
    computed = list(values)[0]
else:
    computed = values

stated = 52
agrees = simplify(list(values)[0] - stated) == 0 if len(values) == 1 else False

print(json.dumps({
    "task_id": "cube-power-sum-x-plus-inv-4",
    "computed": str(computed),
    "agrees": bool(agrees)
}))
