import json
from sympy import Rational, Integer, prod

# Independent recomputation derived from the statement alone.
# Statement: (1 - 1/2)(1 - 1/3)(1 - 1/4)(1 - 1/5)(1 - 1/6)
factors = [Integer(1) - Rational(1, k) for k in (2, 3, 4, 5, 6)]
computed = prod(factors)

expected = Rational(1, 6)
agrees = (computed == expected)

# Also verify the printable form is in simplest form:
# gcd(numerator, denominator) must be 1, denominator positive.
p, q = computed.as_numer_denom()
simplest = (p.gcd(q) == 1) and (q > 0)

print(json.dumps({
    "task_id": "telescoping-product-through-6",
    "computed": f"{p}/{q}",
    "agrees": bool(agrees and simplest)
}))
