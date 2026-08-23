#!/usr/bin/env python3
"""Independent check for the task 'percent-84-of-25'.

Computes 84% of 25 straight from the statement's givens (no reuse
of the author's reasoning) and prints one line of JSON.
"""
import json
from sympy import Rational, Integer

task_id = "percent-84-of-25"

# Givens as they appear in the statement: "84% of 25 = ?"
percent = Rational(84, 100)
whole = Integer(25)

computed = percent * whole  # exact rational
claimed = Integer(21)

# Present the value cleanly: if it is an integer, show it as such
if computed == int(computed):
    computed_str = str(int(computed))
else:
    computed_str = str(computed)

print(json.dumps({
    "task_id": task_id,
    "computed": computed_str,
    "agrees": computed == claimed,
}))
