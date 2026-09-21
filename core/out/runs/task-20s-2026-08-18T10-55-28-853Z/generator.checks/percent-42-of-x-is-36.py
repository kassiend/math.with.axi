"""Check for task percent-42-of-x-is-36.

Computed straight from the statement as rendered, not from the author's reasoning:
  statement  : 42% of x = 36
  description: What is 70% of x?

So: solve the equation for x with exact rationals, then evaluate 70% of that x.
No shortcut, no ratio trick - if the puzzle's claimed answer only works via the
intended insight, this independent route would disagree.
"""
import json

from sympy import Eq, Integer, Rational, solve, symbols, nsimplify

x = symbols("x", real=True)

# "42% of x = 36"
equation = Eq(Rational(42, 100) * x, Integer(36))

roots = solve(equation, x, dict=True)
assert len(roots) == 1, f"expected a unique x, got {roots}"
x_value = roots[0][x]

# "What is 70% of x?"
computed = nsimplify(Rational(70, 100) * x_value)

expected = Integer(60)
agrees = bool(computed == expected)

print(json.dumps({
    "task_id": "percent-42-of-x-is-36",
    "computed": str(computed),
    "agrees": agrees,
}))
