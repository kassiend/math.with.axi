"""
Verifier check — last two digits of 7^2024. Written blind of the generator.

Different method: reduce the exponent through the multiplicative order of 7 modulo 100 rather than
exponentiating. Find the order with sympy, reduce 2024 modulo it, then evaluate the small residual
power. The order is also confirmed by hand against the cycle 7, 49, 43, 01.
"""
import json
import sys

import sympy as sp

TASK = "last-two-digits-7-pow-2024"

n = 100
base = 7
exp = 2024

order = sp.n_order(base, n)                 # smallest k with 7^k ≡ 1 (mod 100)
assert order == 4, f"expected order 4, got {order}"

# Independent confirmation of the cycle the human solver spots.
cycle = [pow(base, k, n) for k in range(1, order + 1)]
assert cycle == [7, 49, 43, 1], f"unexpected cycle {cycle}"

residual = exp % order                       # 2024 mod 4 = 0  -> full cycle -> 7^order ≡ 1
last_two = pow(base, residual if residual else order, n)
computed = f"{last_two:02d}"
agrees = computed == "01"

print(f"order={order} residual={residual} value={last_two}", file=sys.stderr)
print(json.dumps({"task_id": TASK, "computed": computed, "agrees": bool(agrees)}))
