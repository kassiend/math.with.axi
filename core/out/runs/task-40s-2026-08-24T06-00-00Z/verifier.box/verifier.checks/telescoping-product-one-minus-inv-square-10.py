import json
import sympy

k = sympy.symbols('k', positive=True, integer=True)

# Direct finite evaluation of the product for k = 2..10
direct = sympy.prod([1 - sympy.Rational(1, kk**2) for kk in range(2, 11)])
direct = sympy.nsimplify(direct)
direct = sympy.Rational(direct)

# Closed form derivation: 1 - 1/k^2 = (k-1)(k+1)/k^2, telescopes to (n+1)/(2n)
n = 10
closed = sympy.Rational(n + 1, 2 * n)

# Symbolic confirmation of the closed form via sympy.product
sym_prod = sympy.product(1 - 1/k**2, (k, 2, n))
sym_prod = sympy.simplify(sym_prod)

agrees = (direct == closed) and (sympy.Rational(sym_prod) == closed)

computed = str(direct)

import sys
print("direct =", direct, file=sys.stderr)
print("closed =", closed, file=sys.stderr)
print("sym_prod =", sym_prod, file=sys.stderr)

print(json.dumps({"claim_id": "telescoping-product-one-minus-inv-square-10", "computed": computed, "agrees": bool(agrees)}))
