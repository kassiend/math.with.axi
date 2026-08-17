import json
import sympy as sp

# From the statement alone: compute sqrt(9 + 4*sqrt(5)) and check whether
# it equals the claimed answer 2 + sqrt(5).

expr = sp.sqrt(9 + 4 * sp.sqrt(5))
claimed = 2 + sp.sqrt(5)

# Symbolic simplification of the difference; if it simplifies to 0 the
# claim holds (and principal-branch sign matches, since sympy's sqrt
# returns the principal / non-negative real square root).
diff = sp.simplify(expr - claimed)
agrees = diff == 0

# Also cross-check the branch: 2 + sqrt(5) must be positive for it to be
# the principal square root of 9 + 4 sqrt(5).
positive = sp.simplify(claimed) > 0

computed = sp.sqrtdenest(expr)

print(json.dumps({
    "task_id": "denest-9-plus-4-sqrt-5",
    "computed": str(computed),
    "agrees": bool(agrees and positive),
}))
