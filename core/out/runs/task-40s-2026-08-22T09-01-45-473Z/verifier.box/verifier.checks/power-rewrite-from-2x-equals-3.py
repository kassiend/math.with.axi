import json
from sympy import symbols, solve, Eq, Rational, log, simplify, nsimplify

x = symbols('x', real=True)
# Solve 2^x = 3 for x
sol = solve(Eq(2**x, 3), x)

# Compute 4^x + 8^x for each solution and check they all give the same value
values = set()
for s in sol:
    expr = 4**s + 8**s
    val = simplify(expr)
    values.add(val)

# Also compute algebraically: let t = 2^x = 3; 4^x = t^2 = 9; 8^x = t^3 = 27; sum = 36
t = 3
algebraic = t**2 + t**3

# The stated answer
stated = 36

# Check that solution-based value equals algebraic value equals stated
computed = simplify(list(values)[0]) if values else algebraic
agrees = (simplify(computed - stated) == 0) and (algebraic == stated)

print(json.dumps({
    "task_id": "power-rewrite-from-2x-equals-3",
    "computed": str(computed),
    "agrees": bool(agrees)
}))
