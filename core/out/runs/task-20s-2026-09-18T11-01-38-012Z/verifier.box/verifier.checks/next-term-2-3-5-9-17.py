#!/usr/bin/env python
"""Independent check for sequence 2, 3, 5, 9, 17, ?

Derived from the statement alone: examine the first differences and see
whether they form a recognizable pattern that unambiguously determines the
next term.

Sequence a = [2, 3, 5, 9, 17]
First differences d1 = [1, 2, 4, 8]  -- geometric with ratio 2 (each is prior*2)
Next difference: 16, so next term: 17 + 16 = 33.

Cross-check via the closed form a_n = 2^(n-1) + 1 (for n = 1..):
  n=1: 1+1 = 2
  n=2: 2+1 = 3
  n=3: 4+1 = 5
  n=4: 8+1 = 9
  n=5: 16+1 = 17
  n=6: 32+1 = 33
"""
import json
from sympy import Rational, simplify, sympify

given = [2, 3, 5, 9, 17]

# First-difference / doubling method
diffs = [given[i+1] - given[i] for i in range(len(given)-1)]
# Check the ratios are all 2
ratios = [Rational(diffs[i+1], diffs[i]) for i in range(len(diffs)-1)]
doubling_ok = all(r == 2 for r in ratios)
next_from_diff = given[-1] + diffs[-1] * 2 if doubling_ok else None

# Closed-form method a_n = 2^(n-1) + 1
def closed(n):
    return 2**(n-1) + 1

closed_ok = all(closed(i+1) == given[i] for i in range(len(given)))
next_from_closed = closed(6) if closed_ok else None

# The two derivations must agree, and both must be exact integers.
if doubling_ok and closed_ok and next_from_diff == next_from_closed:
    computed = str(int(next_from_diff))
    agrees = (computed == "33")
else:
    computed = "ambiguous"
    agrees = False

print(json.dumps({"task_id": "next-term-2-3-5-9-17",
                  "computed": computed,
                  "agrees": agrees}))
