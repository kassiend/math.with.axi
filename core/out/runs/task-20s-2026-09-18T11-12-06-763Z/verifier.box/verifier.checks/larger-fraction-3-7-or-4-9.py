import json
from fractions import Fraction

a = Fraction(3, 7)
b = Fraction(4, 9)

if a > b:
    larger = a
elif b > a:
    larger = b
else:
    larger = None

computed = f"{larger.numerator}/{larger.denominator}" if larger is not None else "equal"
claimed = Fraction(4, 9)
agrees = (larger == claimed)

print(json.dumps({
    "task_id": "larger-fraction-3-7-or-4-9",
    "computed": computed,
    "agrees": agrees
}))
