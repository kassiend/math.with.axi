import json
from sympy import Rational, Integer

# Statement: 1 + 3 + 5 + ... + 39
# The odd numbers from 1 to 39 inclusive.
terms = list(range(1, 40, 2))
assert terms[0] == 1 and terms[-1] == 39
computed = sum(Integer(t) for t in terms)

stated = Integer(400)
agrees = (computed == stated)

print(json.dumps({
    "task_id": "sum-first-20-odd-numbers",
    "computed": str(computed),
    "agrees": bool(agrees)
}))
