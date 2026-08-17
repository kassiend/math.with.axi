"""Independent SymPy check for task `sum-first-20-odd-numbers`.

Statement (as rendered in the ring): `1 + 3 + 5 + … + 39 = ?`
i.e. the sum of the odd integers from 1 up to and including 39.

We compute the value directly from the statement (a summation over the odd
integers in [1, 39]) — not from the "n^2" identity we happen to be exploiting
in the write-up. That way this script would still notice if the last term or
the range were misread.
"""

import json

from sympy import Integer, Rational, summation, symbols

k = symbols("k", integer=True)

# Odd integers 1, 3, 5, ..., 39 are (2k - 1) for k = 1..20.
computed = summation(2 * k - 1, (k, 1, 20))

# Cross-check with a literal enumeration of the terms shown in the statement.
literal = sum(Integer(n) for n in range(1, 40, 2))
assert computed == literal, (computed, literal)

expected = Integer(400)
agrees = computed == expected

print(
    json.dumps(
        {
            "task_id": "sum-first-20-odd-numbers",
            "computed": str(computed),
            "agrees": bool(agrees),
        }
    )
)
