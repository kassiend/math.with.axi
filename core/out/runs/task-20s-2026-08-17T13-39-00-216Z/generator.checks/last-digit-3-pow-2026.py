#!/usr/bin/env python
"""
Independent verification for task `last-digit-3-pow-2026`.

Statement: Last digit of 3^2026

We compute 3**2026 mod 10 directly (Python integers are arbitrary precision,
so no shortcut is required or used). The claimed answer is 9.
"""
import json
from sympy import Integer, Mod

task_id = "last-digit-3-pow-2026"
claimed = "9"

# Compute the last digit of 3^2026 from the statement, not from the solution sketch.
value = Mod(Integer(3) ** 2026, 10)
computed = str(value)

agrees = (computed == claimed)

print(json.dumps({
    "task_id": task_id,
    "computed": computed,
    "agrees": bool(agrees),
}))
