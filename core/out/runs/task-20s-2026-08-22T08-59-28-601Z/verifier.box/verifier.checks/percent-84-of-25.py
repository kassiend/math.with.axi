import json
from sympy import Rational, nsimplify

# Statement: 84% of 25 = ?
# 84% = 84/100 = 21/25
# 21/25 * 25 = 21
value = Rational(84, 100) * Rational(25, 1)

stated = Rational(21)
computed_str = str(value) if value != int(value) else str(int(value))

agrees = (value == stated)

print(json.dumps({
    "task_id": "percent-84-of-25",
    "computed": computed_str,
    "agrees": agrees
}))
