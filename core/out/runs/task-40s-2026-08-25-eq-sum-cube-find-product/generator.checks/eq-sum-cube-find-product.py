"""
Generator check — x + y = 5, x^3 + y^3 = 35, find xy.

Method: solve the system as written and read off the product, making NO use of the sum-of-cubes
identity the human solver uses. If the identity route and the brute solve disagree, the task
fails.
"""
import json
import sympy as sp

task_id = "eq-sum-cube-find-product"

x, y = sp.symbols("x y")
solutions = sp.solve([x + y - 5, x**3 + y**3 - 35], [x, y], dict=True)

# xy must be the same real value at every solution; collect the distinct products.
products = {sp.nsimplify(sp.simplify(s[x] * s[y])) for s in solutions}
assert len(products) == 1, f"xy is not single-valued across solutions: {products}"

value = products.pop()
computed = str(value)
agrees = sp.simplify(value - 6) == 0 and computed == "6"

print("solutions =", solutions, file=__import__("sys").stderr)
print("xy =", value, file=__import__("sys").stderr)
print(json.dumps({"task_id": task_id, "computed": computed, "agrees": bool(agrees)}))
