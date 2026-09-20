"""Independent check for crt-smallest-mod-5-7.

Statement: find the smallest positive integer x with
    x ≡ 2 (mod 5)
    x ≡ 3 (mod 7)

We compute x directly from the two congruences (SymPy CRT) and also verify by
a small brute-force scan, then compare with the stated answer "17".
"""

import json

from sympy.ntheory.modular import crt

moduli = [5, 7]
residues = [2, 3]

# CRT-based smallest positive solution.
r, m = crt(moduli, residues)
x_crt = int(r) % int(m)
if x_crt == 0:
    x_crt = int(m)

# Independent brute-force cross-check from the raw congruences.
x_scan = next(
    n
    for n in range(1, int(m) + 1)
    if n % moduli[0] == residues[0] and n % moduli[1] == residues[1]
)

assert x_crt == x_scan, (x_crt, x_scan)

expected = "17"
computed = str(x_crt)

print(
    json.dumps(
        {
            "task_id": "crt-smallest-mod-5-7",
            "computed": computed,
            "agrees": computed == expected,
        }
    )
)
