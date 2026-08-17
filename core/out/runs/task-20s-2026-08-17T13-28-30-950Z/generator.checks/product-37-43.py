"""Independent check for task `product-37-43`.

Statement (as rendered in the ring): "37 × 43 = ?"
Compute the product from the statement's literal operands, not by re-walking the
difference-of-squares insight the solution sketch uses. If both routes agree, the
answer is real; if they don't, the sketch is broken.
"""
import json
from sympy import Integer

TASK_ID = "product-37-43"

# Operands read straight off the statement.
a = Integer(37)
b = Integer(43)

computed = a * b
expected = Integer(1591)

print(json.dumps({
    "task_id": TASK_ID,
    "computed": str(computed),
    "agrees": computed == expected,
}))
