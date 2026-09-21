#!/usr/bin/env python3
"""Independent check for telescope-sum-1-over-k-k-plus-1-9.

Computes S = sum_{k=1}^{9} 1/(k*(k+1)) directly from the statement
(no reuse of the claimed telescoping identity) and compares to the
task's stated answer 9/10.
"""
import json
from sympy import Rational, Symbol, summation

k = Symbol("k", integer=True)
# Direct symbolic summation from the original statement, no shortcut.
computed = summation(Rational(1, 1) / (k * (k + 1)), (k, 1, 9))
computed = Rational(computed)  # ensure canonical rational form

expected = Rational(9, 10)
agrees = computed == expected

print(json.dumps({
    "task_id": "telescope-sum-1-over-k-k-plus-1-9",
    "computed": f"{computed.p}/{computed.q}",
    "agrees": bool(agrees),
}))
