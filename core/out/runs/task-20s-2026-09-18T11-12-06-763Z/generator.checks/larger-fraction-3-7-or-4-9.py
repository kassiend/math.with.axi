"""Verify: which of 3/7, 4/9 is larger?

Computes both fractions from the statement, compares, and reports the larger
one in canonical 'p/q' form.
"""
import json
from sympy import Rational

a = Rational(3, 7)
b = Rational(4, 9)

if a > b:
    larger = a
elif b > a:
    larger = b
else:
    larger = None  # equal — would invalidate the puzzle

computed = f"{larger.p}/{larger.q}" if larger is not None else "equal"
expected = "4/9"

print(json.dumps({
    "task_id": "larger-fraction-3-7-or-4-9",
    "computed": computed,
    "agrees": computed == expected,
}))
